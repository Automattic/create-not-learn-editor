/**
 * The Pages canvas: the page being worked on, always in view.
 *
 * It is a site canvas: Browse shows the saved page as visitors see it, Edit
 * changes it in place, and Compose works on its sections. Following a link in
 * the preview to another page opens that page in the sidebar, and picking a
 * page there moves the preview. The list of pages only ever browses: editing
 * opens the page in the sidebar, and going back to the list browses again.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { settings } from '../../../settings';
import {
	MODE_BROWSE,
	MODE_EDIT,
	setCanvasMode,
	useCanvasMode,
} from '../../../site-canvas/mode';
import { DocumentTitle, SiteCanvas, useSiteCanvas } from '../../../site-canvas';
import { getErrorMessage } from '../../../records';
import { getPageTitle, PAGE_TEMPLATES_QUERY, PAGES_QUERY } from './data';
import { getHomepageSummary, parseTarget, useHomepageState } from './homepage';
import { HOMEPAGE, isIndexTemplateId } from './homepage-state';
import { RenamePageModal } from './page-options';
import { getPagePreviewUrl } from './preview-url';
import {
	__,
	Button,
	chevronDownIcon,
	coreDataStore,
	Dropdown,
	EmptyState,
	externalIcon,
	homeIcon,
	Icon,
	layoutIcon,
	linkIcon,
	MenuGroup,
	MenuItem,
	noticesStore,
	pageIcon,
	pencilIcon,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';

/**
 * A page as the sidebar's list has it, with its address, status and layout,
 * if the list has loaded.
 *
 * @param {Function} select Registry `select`.
 * @param {number}   pageId Page ID.
 * @return {?Object} The page, or `null`.
 */
function getListedPage( select, pageId ) {
	const pages = select( coreDataStore ).getEntityRecords(
		'postType',
		'page',
		PAGES_QUERY
	);

	return pages?.find( ( listed ) => listed.id === pageId ) || null;
}

function getStatusLabel( status ) {
	switch ( status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		default:
			return '';
	}
}

/**
 * The part of a page's address after the domain, as visitors would type it.
 *
 * @param {string} link Page URL.
 * @return {string} The path, or an empty string without a link.
 */
function getPagePath( link ) {
	if ( ! link ) {
		return '';
	}

	try {
		const url = new URL( link );

		return decodeURI( url.pathname + url.search ) || '/';
	} catch {
		return link;
	}
}

/**
 * The layout a page is shown in: the homepage's own, when the theme has one,
 * as it always wins, then the one the page picked, then the one it gets by
 * default. The page's unsaved pick counts, so the layout opened is the one on
 * show.
 *
 * @param {number}  pageId     Page ID.
 * @param {boolean} isHomepage Whether the page is the homepage.
 * @return {?string} The layout's ID, or `null` until it is known.
 */
function usePageLayoutId( pageId, isHomepage ) {
	return useSelect(
		( select ) => {
			const store = select( coreDataStore );

			if ( isHomepage ) {
				const frontId = store.getDefaultTemplateId( {
					slug: 'front-page',
				} );
				const front = frontId
					? store.getEntityRecord(
							'postType',
							'wp_template',
							frontId
						)
					: null;

				if ( front?.slug === 'front-page' ) {
					return front.id;
				}
			}

			// Not known until the page has loaded, or every page would get
			// the default layout for a moment.
			if ( ! store.getEntityRecord( 'postType', 'page', pageId ) ) {
				return null;
			}

			const page = store.getEditedEntityRecord(
				'postType',
				'page',
				pageId
			);
			const picked =
				page?.template && page.template !== 'default'
					? page.template
					: '';

			if ( picked ) {
				const layouts = store.getEntityRecords(
					'postType',
					'wp_template',
					PAGE_TEMPLATES_QUERY
				);
				const layout = layouts?.find( ( { slug } ) => slug === picked );

				// Not known until the page's layouts have loaded.
				if ( ! layouts || layout ) {
					return layout?.id || null;
				}
			}

			return (
				store.getDefaultTemplateId( {
					slug: page?.slug ? `page-${ page.slug }` : 'page',
				} ) || null
			);
		},
		[ isHomepage, pageId ]
	);
}

/**
 * Edit layout, in the page's menu: opens the layout the page is shown in on
 * Pages' Layouts, in Edit, with a way back to the page. Only looked up once
 * the menu opens.
 *
 * @param {Object}     props            Component props.
 * @param {boolean}    props.isHomepage Whether the page is the homepage.
 * @param {() => void} props.onClose    Closes the menu.
 * @param {number}     props.pageId     Page ID.
 * @return {Element} The menu item.
 */
function EditLayoutItem( { isHomepage, onClose, pageId } ) {
	const navigate = useNavigate();
	const layoutId = usePageLayoutId( pageId, isHomepage );

	return (
		<MenuItem
			disabled={ ! layoutId }
			icon={ layoutIcon }
			onClick={ async () => {
				onClose();
				await navigate( {
					search: {
						content: 'templates',
						layoutFor: isHomepage ? HOMEPAGE : pageId,
						postIds: [ String( layoutId ) ],
					},
					to: LIST_PATH,
				} );
				// Only once the page's canvas has gone, as it would take
				// Edit to mean opening the page.
				setCanvasMode( MODE_EDIT );
			} }
		>
			{ __( 'Edit layout' ) }
		</MenuItem>
	);
}

/**
 * The menu on the page's name: Rename for any page, as its title isn't on
 * every layout, Edit layout, and its address once it has one.
 *
 * @param {Object}  props            Component props.
 * @param {boolean} props.isHomepage Whether the page is the homepage.
 * @param {string}  props.link       The page's address, when it has one to
 *                                   show.
 * @param {?number} props.pageId     The page, when there is one to rename.
 * @return {?Element} The menu.
 */
function PageOptions( { isHomepage, link, pageId } ) {
	const { createSuccessNotice } = useDispatch( noticesStore );
	const [ isRenaming, setIsRenaming ] = useState( false );
	const canRename = Boolean( pageId );

	if ( ! link && ! canRename ) {
		return null;
	}

	return (
		<>
			<Dropdown
				className="cnl-editor-homepage-options"
				contentClassName="cnl-editor-homepage-options__content"
				popoverProps={ { placement: 'bottom' } }
				renderContent={ ( { onClose } ) => (
					<MenuGroup className="cnl-editor-homepage-options__menu">
						{ canRename && (
							<MenuItem
								icon={ pencilIcon }
								onClick={ () => {
									onClose();
									setIsRenaming( true );
								} }
							>
								{ __( 'Rename' ) }
							</MenuItem>
						) }
						{ pageId > 0 && (
							<EditLayoutItem
								isHomepage={ isHomepage }
								onClose={ onClose }
								pageId={ pageId }
							/>
						) }
						{ link && (
							<MenuItem
								icon={ externalIcon }
								onClick={ () => {
									onClose();
									window.open(
										link,
										'_blank',
										'noopener,noreferrer'
									);
								} }
							>
								{ __( 'View on your site' ) }
							</MenuItem>
						) }
						{ link && (
							<MenuItem
								icon={ linkIcon }
								onClick={ async () => {
									onClose();
									await window.navigator.clipboard?.writeText(
										link
									);
									createSuccessNotice( __( 'Link copied.' ), {
										type: 'snackbar',
									} );
								} }
							>
								{ __( 'Copy link' ) }
							</MenuItem>
						) }
					</MenuGroup>
				) }
				renderToggle={ ( { isOpen, onToggle } ) => (
					<Button
						aria-expanded={ isOpen }
						className="cnl-editor-homepage-options__toggle"
						icon={ chevronDownIcon }
						label={ __( 'Page options' ) }
						onClick={ onToggle }
						showTooltip
						size="compact"
					/>
				) }
			/>
			{ isRenaming && (
				<RenamePageModal
					onClose={ () => setIsRenaming( false ) }
					pageId={ pageId }
				/>
			) }
		</>
	);
}

function CanvasEmptyState() {
	return (
		<section className="cnl-pages-canvas cnl-pages-canvas--empty">
			<EmptyState.Root>
				<EmptyState.Icon icon={ pageIcon } />
				<EmptyState.Title>
					{ __( 'Your page will show here' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Add a page and you will see it take shape as you work.'
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</section>
	);
}

/**
 * Whether the preview shows an unsaved change: a page whose only edits are its
 * layout or publishing it, or the site's whose only edits are what the
 * homepage shows, all of which `getPagePreviewUrl` passes along.
 *
 * @param {Object}   change Unsaved change, from `useChanges`.
 * @param {Function} select The registry's `select`.
 * @return {boolean} Whether the preview shows it.
 */
function isPassedToPreview( change, select ) {
	const { kind, name, key } = change;
	let shown;

	if ( kind === 'postType' && name === 'page' ) {
		shown = [ 'status', 'template' ];
	} else if ( kind === 'root' && name === 'site' ) {
		shown = [ 'page_on_front', 'posts_per_page', 'show_on_front' ];
	} else {
		return false;
	}

	const edits = Object.keys(
		select( coreDataStore ).getEntityRecordNonTransientEdits(
			kind,
			name,
			key
		) || {}
	);

	return (
		edits.length > 0 && edits.every( ( edit ) => shown.includes( edit ) )
	);
}

/**
 * The search part of the route in the browser's address, rather than the
 * router's. See `getOpenedInAddress` for why.
 *
 * @return {URLSearchParams} The route's search.
 */
function getAddressSearch() {
	const route =
		new URL( window.location.href ).searchParams.get( 'p' ) || '/';

	return new URLSearchParams( route.split( '?' )[ 1 ] || '' );
}

/**
 * The page open in the sidebar according to the browser's address, rather
 * than the router. Opening a page from `/types/page` moves to the list's own
 * route, and the old route's canvas stays on show for a moment with the old
 * address, which has no page open. Switching to Edit in that moment would
 * otherwise open the homepage over the page just opened.
 *
 * @return {string|number} `HOMEPAGE`, a page ID, or 0.
 */
function getOpenedInAddress() {
	return parseTarget( getAddressSearch().get( 'postId' ) );
}

/**
 * Whether the browser's address is already on Pages' Layouts, where a page's
 * Edit layout goes, in Edit, while this canvas is still on show.
 *
 * @return {boolean} Whether Layouts is in the address.
 */
function isLayoutsInAddress() {
	return getAddressSearch().get( 'content' ) === 'templates';
}

function PageDocument( { homepage, page } ) {
	const isPublished = page?.status === 'publish';
	let link = page?.link;
	let path = isPublished ? getPagePath( link ) : '';
	let heading = getPageTitle( page );
	let meta = [ __( 'Page' ), getStatusLabel( page?.status ) ]
		.filter( Boolean )
		.join( ' · ' );

	if ( homepage ) {
		link = settings.homeUrl;
		path = getPagePath( link );
		heading = __( 'Homepage' );
		const { badge, summary } = getHomepageSummary( homepage );

		meta = summary || badge?.label || '';
	}

	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ homepage ? homeIcon : pageIcon }
					/>
					<DocumentTitle hint={ path } title={ heading } />
				</div>
				<p className="cnl-editor-homepage-document__meta">{ meta }</p>
			</div>
			<PageOptions
				isHomepage={ Boolean( homepage ) }
				link={ path ? link : '' }
				pageId={ page?.id }
			/>
		</div>
	);
}

/**
 * The layout the canvas edits while the homepage lists the latest posts.
 *
 * Without a `home` layout, WordPress lists them in `index`, which every other
 * list of posts uses too, like categories and search results. Editing that in
 * place would change all of them, so as soon as the canvas opens it to edit,
 * the homepage gets a `home` layout of its own, copied from `index`, and the
 * canvas moves on to it once it is there. Nothing looks different until it
 * is changed, and only the homepage changes then.
 *
 * @param {Object}  args
 * @param {string}  args.templateId The layout WordPress uses, if known.
 * @param {boolean} args.isEditing  Whether the canvas is open to edit.
 * @return {string|undefined} The layout to edit.
 */
function useLatestPostsLayout( { templateId, isEditing } ) {
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const isCopying = useRef( false );
	const indexContent = useSelect(
		( select ) =>
			isIndexTemplateId( templateId )
				? select( coreDataStore ).getEntityRecord(
						'postType',
						'wp_template',
						templateId
					)?.content?.raw
				: undefined,
		[ templateId ]
	);

	useEffect( () => {
		if (
			! isEditing ||
			typeof indexContent !== 'string' ||
			isCopying.current
		) {
			return;
		}

		isCopying.current = true;
		saveEntityRecord(
			'postType',
			'wp_template',
			{
				content: indexContent,
				slug: 'home',
				status: 'publish',
				title: __( 'Blog Home' ),
			},
			{ throwOnError: true }
		)
			.then( () =>
				invalidateResolution( 'getDefaultTemplateId', [
					{ slug: 'front-page' },
				] )
			)
			.catch( ( error ) =>
				createErrorNotice( getErrorMessage( error ), {
					type: 'snackbar',
				} )
			)
			.finally( () => {
				isCopying.current = false;
			} );
	}, [
		createErrorNotice,
		indexContent,
		invalidateResolution,
		isEditing,
		saveEntityRecord,
	] );

	return templateId;
}

function PagesCanvas() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const homepage = useHomepageState();
	const drilled = parseTarget( searchParams.postId );
	let target = drilled || parseTarget( searchParams.previewId ) || HOMEPAGE;

	// The homepage's page is only ever shown as the homepage.
	if ( target === homepage.pageId && homepage.pageId ) {
		target = HOMEPAGE;
	}

	const isHomepage = target === HOMEPAGE;
	const pageId = isHomepage ? homepage.pageId : target;
	// With no page behind it, the homepage lists the latest posts, or is
	// whatever the theme's layout makes it.
	const showsLatestPosts = isHomepage && ! pageId;
	const editorRef = useRef();
	/*
	 * Only what the canvas shows of the page. The edited record is new on
	 * every keystroke, as the editor writes the page's blocks back to it.
	 * Until the page's own record has loaded, the sidebar's list has what
	 * the preview needs, so a page picked there starts loading at once.
	 */
	const { id, link, status, template, title } = useSelect(
		( select ) => {
			const record = pageId
				? select( coreDataStore ).getEditedEntityRecord(
						'postType',
						'page',
						pageId
					) || getListedPage( select, pageId )
				: null;

			return {
				id: record?.id,
				link: record?.link,
				status: record?.status,
				template: record?.template,
				title: record?.title,
			};
		},
		[ pageId ]
	);
	const page = useMemo(
		() =>
			link || status || title
				? { id, link, status, template, title }
				: null,
		[ id, link, status, template, title ]
	);
	const saved = useSelect(
		( select ) => {
			const record = pageId
				? select( coreDataStore ).getEntityRecord(
						'postType',
						'page',
						pageId
					) || getListedPage( select, pageId )
				: null;

			return {
				status: record?.status,
				template: record?.template || '',
			};
		},
		[ pageId ]
	);
	const site = useSelect(
		( select ) =>
			select( coreDataStore ).getEditedEntityRecord( 'root', 'site' ),
		[]
	);
	const isEditing = useCanvasMode() !== MODE_BROWSE;
	const latestPostsTemplateId = useLatestPostsLayout( {
		isEditing: showsLatestPosts && isEditing,
		templateId: showsLatestPosts
			? homepage.latestPostsTemplateId
			: undefined,
	} );
	const pinnedEntity = useMemo( () => {
		if ( showsLatestPosts ) {
			return latestPostsTemplateId
				? { postId: latestPostsTemplateId, postType: 'wp_template' }
				: null;
		}

		return pageId ? { postId: pageId, postType: 'page' } : null;
	}, [ latestPostsTemplateId, pageId, showsLatestPosts ] );
	const isShownInPreview = useCallback( isPassedToPreview, [] );
	const canvas = useSiteCanvas( {
		isShownInPreview,
		pinnedEntity,
		url: getPagePreviewUrl( {
			homeUrl: settings.homeUrl,
			isHomepage,
			page: showsLatestPosts ? null : page,
			savedSite: homepage.saved || site,
			savedStatus: saved.status,
			savedTemplate: saved.template,
			site,
		} ),
	} );
	const previewPageId =
		canvas.previewEntity?.postType === 'page'
			? Number( canvas.previewEntity.postId )
			: 0;

	// A link followed in the preview to another page picks it in the sidebar,
	// and opens it there if a page was already open.
	useEffect( () => {
		if (
			previewPageId &&
			previewPageId !== pageId &&
			canvas.isPreviewing
		) {
			const next =
				previewPageId === homepage.pageId ? HOMEPAGE : previewPageId;

			navigate( {
				search: {
					...searchParams,
					postId: drilled ? next : undefined,
					previewId: next,
				},
				to: LIST_PATH,
			} );
		}
		// Only the preview arriving on a page should open it, not the sidebar
		// moving on from the page the preview is still showing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ previewPageId ] );

	// The sidebar follows the canvas's mode. Editing the page on show opens
	// it in the sidebar, and going back to the list browses again, as does
	// arriving at the list from another screen while editing. A change made
	// in the list, to the menu say, shows in the editor without taking the
	// list away.
	const wasEditing = useRef( isEditing );
	useEffect( () => {
		if (
			isEditing &&
			! drilled &&
			! getOpenedInAddress() &&
			! isLayoutsInAddress()
		) {
			if ( wasEditing.current ) {
				canvas.requestMode( MODE_BROWSE );
			} else if ( ! canvas.isShowingChange() ) {
				navigate( {
					search: {
						...searchParams,
						postId: target,
						previewId: target,
					},
					to: LIST_PATH,
				} );
			}
		}

		wasEditing.current = isEditing;
		// Only a move between the list and a page, or between modes, should
		// switch the other.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ drilled, isEditing ] );

	if ( homepage.isLoading ) {
		return null;
	}

	if ( ! pageId && ! isHomepage ) {
		return <CanvasEmptyState />;
	}

	return (
		<SiteCanvas
			canvas={ canvas }
			className={ `cnl-pages-canvas${ drilled ? ' is-drilled' : '' }` }
			document={
				<PageDocument
					homepage={ isHomepage ? homepage : null }
					page={ page }
				/>
			}
			editorRef={ editorRef }
		/>
	);
}

export default PagesCanvas;
