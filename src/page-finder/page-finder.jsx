/**
 * Page finder: a short list of the site's pages, with a field to narrow it,
 * for moving from page to page without going through the Pages screen.
 *
 * Picking a page opens it on the Pages screen, as the command palette does.
 * Below the list, "Add a page" opens the Add page modal and "Manage pages"
 * the Pages screen's list.
 *
 * The field keeps focus while the arrow keys move through the list, so typing
 * and picking work together, as in a combobox.
 *
 * Opened from the top bar's Go to page. Imported package by package rather
 * than through `src/wordpress-packages`, as the top bar is mounted from app
 * init.
 */

/**
 * WordPress dependencies
 */
import { Dropdown } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import {
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __, _n, sprintf } from '@wordpress/i18n';
import { pages as pagesIcon, plus, search } from '@wordpress/icons';
import { Badge, Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { HOMEPAGE } from '../routes/content/pages/homepage-state';
import { MODE_EDIT, setCanvasMode } from '../site-canvas/mode';
import { getMainPageIds, useMainMenuTopLevel } from './main-pages';

const PAGES_PATH = '/types/page/list/all';

/*
 * The Pages screen's own query (`PAGES_QUERY` in
 * `src/routes/content/pages/data.js`), so the two share what core-data has
 * fetched. Copied rather than imported, as that module brings the editor's
 * packages with it, and this loads with app init.
 */
const PAGES_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: 'publish,draft,pending,private,future',
	_fields: 'id,title,status,parent,menu_order,link,modified,slug,template',
};

const EMPTY_ARRAY = [];

// The most the list opens with, the homepage included, so it fits in view.
const MAIN_LIMIT = 8;

const ROLE_HOMEPAGE = 'homepage';
const ROLE_POSTS = 'posts';

function getRoleLabel( role ) {
	switch ( role ) {
		case ROLE_HOMEPAGE:
			return __( 'Homepage' );
		case ROLE_POSTS:
			return __( 'Latest posts' );
		default:
			return '';
	}
}

/**
 * Open a page on the Pages screen, in Edit, as the command palette does.
 *
 * @param {number|string} pageId Page ID, or `HOMEPAGE`.
 */
export function openPage( pageId ) {
	setCanvasMode( MODE_EDIT );
	openRoute( PAGES_PATH, { postId: pageId, previewId: pageId } );
}

function getStatusLabel( status ) {
	switch ( status ) {
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
 * The page open on the Pages screen, read from the address, or the homepage
 * on Home, which starts there.
 *
 * @return {string|number} `HOMEPAGE`, a page ID, or 0.
 */
function getCurrentPageId() {
	const route =
		new URL( window.location.href ).searchParams.get( 'p' ) || '/';
	const [ path, query = '' ] = route.split( '?' );

	if ( path === '/' ) {
		return HOMEPAGE;
	}

	if ( ! path.startsWith( '/types/page/' ) ) {
		return 0;
	}

	const postId = new URLSearchParams( query ).get( 'postId' );

	return postId === HOMEPAGE ? HOMEPAGE : Number( postId ) || 0;
}

/**
 * Pages in the order the Pages screen lists them: by menu order, each
 * followed by the pages under it.
 *
 * @param {Object[]} records Page records.
 * @return {Object[]} `{ page, depth }` for each.
 */
function getPageTree( records ) {
	const ids = new Set( records.map( ( page ) => page.id ) );
	const childrenOf = new Map();

	records.forEach( ( page ) => {
		// A page whose parent isn't listed sits at the top.
		const parent = ids.has( page.parent ) ? page.parent : 0;

		if ( ! childrenOf.has( parent ) ) {
			childrenOf.set( parent, [] );
		}

		childrenOf.get( parent ).push( page );
	} );

	const tree = [];
	const add = ( parent, depth ) =>
		( childrenOf.get( parent ) || [] ).forEach( ( page ) => {
			tree.push( { page, depth } );
			add( page.id, depth + 1 );
		} );

	add( 0, 0 );

	return tree;
}

function getTitle( page ) {
	return (
		decodeEntities( page.title?.raw ?? page.title?.rendered ?? '' ) ||
		__( '(no title)' )
	);
}

/**
 * The pages, as entries for the list: every page, the homepage first and the
 * rest as the Pages screen nests them, and the main pages the finder opens
 * on (see `main-pages.js`).
 *
 * The homepage and the page that lists the latest posts are marked with what
 * they are (`role`), as visitors know them by that more than by their names.
 *
 * @return {Object} `{ all, main, homepageId, isLoading }`.
 */
function usePageEntries() {
	const { homepageId, isLoading, postsPageId, records } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const site = store.getEditedEntityRecord( 'root', 'site' );
			const args = [ 'postType', 'page', PAGES_QUERY ];
			const isStaticFront = site?.show_on_front === 'page';

			return {
				homepageId: isStaticFront
					? Number( site.page_on_front ) || 0
					: 0,
				isLoading: ! store.hasFinishedResolution(
					'getEntityRecords',
					args
				),
				postsPageId: isStaticFront
					? Number( site.page_for_posts ) || 0
					: 0,
				records: store.getEntityRecords( ...args ) ?? EMPTY_ARRAY,
			};
		},
		[]
	);
	const menuItems = useMainMenuTopLevel();

	return useMemo( () => {
		const pagesById = new Map(
			records.map( ( page ) => [ page.id, page ] )
		);
		const homepage = pagesById.get( homepageId );
		const tree = getPageTree(
			records.filter( ( page ) => page.id !== homepageId )
		);
		const titles = new Map(
			records.map( ( page ) => [ page.id, getTitle( page ) ] )
		);

		// With no page picked, the homepage lists the latest posts.
		const homepageEntry = {
			id: HOMEPAGE,
			depth: 0,
			role: ROLE_HOMEPAGE,
			status: homepage?.status,
			title: homepage ? titles.get( homepage.id ) : __( 'Latest posts' ),
		};
		const toEntry = ( page, depth ) => ( {
			id: page.id,
			depth,
			parentTitle: depth ? titles.get( page.parent ) : '',
			role: page.id === postsPageId ? ROLE_POSTS : undefined,
			status: page.status,
			title: titles.get( page.id ),
		} );

		const all = [
			homepageEntry,
			...tree.map( ( { page, depth } ) => toEntry( page, depth ) ),
		];
		const main = [
			homepageEntry,
			...getMainPageIds( menuItems, pagesById, tree, homepageId ).map(
				( id ) => toEntry( pagesById.get( id ), 0 )
			),
		].slice( 0, MAIN_LIMIT );

		return { all, main, homepageId, isLoading };
	}, [ homepageId, isLoading, menuItems, postsPageId, records ] );
}

/**
 * The finder's contents: the field, the pages and the two ways onward.
 *
 * @param {Object}   props
 * @param {Function} props.onClose Closes the finder.
 * @return {Element} The panel.
 */
export function PageFinderPanel( { onClose } ) {
	const id = useId();
	const listId = `cnl-page-finder-list-${ id }`;
	const [ filter, setFilter ] = useState( '' );
	const [ activeIndex, setActiveIndex ] = useState( -1 );
	const [ isShowingAll, setIsShowingAll ] = useState( false );
	const { all, main, homepageId, isLoading } = usePageEntries();
	// Read once, as the finder opens: picking a page closes it.
	const [ opened ] = useState( getCurrentPageId );
	const currentId = homepageId && opened === homepageId ? HOMEPAGE : opened;

	const term = filter.trim().toLocaleLowerCase();
	const canShowAll = ! term && all.length > main.length;

	/*
	 * Searching looks through every page. The pages found are listed flat,
	 * as their parents may not be among them, each with its parent's name
	 * beside it instead.
	 */
	const shown = useMemo( () => {
		if ( ! term ) {
			return isShowingAll ? all : main;
		}

		return all
			.filter( ( entry ) =>
				[ entry.title, getRoleLabel( entry.role ) ]
					.join( ' ' )
					.toLocaleLowerCase()
					.includes( term )
			)
			.map( ( entry ) => ( { ...entry, depth: 0, showsParent: true } ) );
	}, [ all, isShowingAll, main, term ] );

	let heading = __( 'Main pages' );

	if ( term ) {
		heading = __( 'Pages' );
	} else if ( isShowingAll ) {
		heading = __( 'All pages' );
	}

	// The button goes once clicked, so typing carries on in the field.
	const inputRef = useRef();
	const toggleShowingAll = () => {
		setIsShowingAll( ( isShowing ) => ! isShowing );
		setActiveIndex( -1 );
		listRef.current?.parentElement?.scrollTo( { top: 0 } );
		inputRef.current?.focus();
	};

	// Keep the page the arrow keys mark in view, but not one pointed at.
	const listRef = useRef();
	const isMovingByKey = useRef( false );
	useEffect( () => {
		if ( ! isMovingByKey.current ) {
			return;
		}

		isMovingByKey.current = false;
		listRef.current?.children[ activeIndex ]?.scrollIntoView( {
			block: 'nearest',
		} );
	}, [ activeIndex ] );

	const pick = ( entry ) => {
		onClose();
		openPage( entry.id );
	};

	const onKeyDown = ( event ) => {
		if ( event.key === 'ArrowDown' || event.key === 'ArrowUp' ) {
			event.preventDefault();

			if ( ! shown.length ) {
				return;
			}

			const step = event.key === 'ArrowDown' ? 1 : -1;

			isMovingByKey.current = true;
			setActiveIndex(
				( index ) => ( index + step + shown.length ) % shown.length
			);
		} else if ( event.key === 'Enter' ) {
			// What's typed matches one page, or one is marked.
			const entry =
				shown[ activeIndex ] ?? ( shown.length === 1 && shown[ 0 ] );

			if ( entry ) {
				event.preventDefault();
				pick( entry );
			}
		}
	};

	const optionId = ( index ) => `${ listId }-${ index }`;

	return (
		<div className="cnl-page-finder">
			<div className="cnl-page-finder__search">
				<Icon
					className="cnl-page-finder__search-icon"
					icon={ search }
				/>
				<input
					aria-activedescendant={
						activeIndex >= 0 ? optionId( activeIndex ) : undefined
					}
					aria-autocomplete="list"
					aria-controls={ listId }
					aria-expanded
					aria-label={ __( 'Find or go to any page…' ) }
					className="cnl-page-finder__input"
					onChange={ ( event ) => {
						setFilter( event.target.value );
						setActiveIndex( -1 );
					} }
					onKeyDown={ onKeyDown }
					placeholder={ __( 'Find or go to any page…' ) }
					ref={ inputRef }
					role="combobox"
					type="search"
					value={ filter }
				/>
			</div>
			<div className="cnl-page-finder__group">
				<div className="cnl-page-finder__heading">
					<h2 id={ `${ listId }-h` }>{ heading }</h2>
					{ /* Kept in reach while the long list scrolls. */ }
					{ isShowingAll && ! term && (
						<button
							className="cnl-page-finder__more"
							onClick={ toggleShowingAll }
							type="button"
						>
							{ __( 'Show fewer' ) }
						</button>
					) }
				</div>
				<ul
					aria-labelledby={ `${ listId }-h` }
					className="cnl-page-finder__list"
					id={ listId }
					ref={ listRef }
					role="listbox"
				>
					{ shown.map( ( entry, index ) => {
						const status = getStatusLabel( entry.status );

						return (
							// Picked with the pointer here, and with the
							// keyboard from the field, which keeps focus.
							// eslint-disable-next-line jsx-a11y/click-events-have-key-events
							<li
								aria-selected={ index === activeIndex }
								className={ [
									'cnl-page-finder__option',
									index === activeIndex && 'is-active',
									entry.id === currentId && 'is-current',
								]
									.filter( Boolean )
									.join( ' ' ) }
								id={ optionId( index ) }
								key={ entry.id }
								onClick={ () => pick( entry ) }
								onMouseMove={ () => setActiveIndex( index ) }
								role="option"
								style={ {
									'--cnl-page-finder-depth': entry.depth,
								} }
							>
								<span className="cnl-page-finder__title">
									{ entry.title }
								</span>
								{ entry.role && (
									<span className="cnl-page-finder__role">
										{ sprintf(
											/* translators: %s: What the page is, like Homepage. */
											__( '(%s)' ),
											getRoleLabel( entry.role )
										) }
									</span>
								) }
								{ entry.showsParent && entry.parentTitle && (
									<span className="cnl-page-finder__parent">
										{ entry.parentTitle }
									</span>
								) }
								{ status && (
									<Badge
										className="cnl-page-finder__status"
										intent="draft"
									>
										{ status }
									</Badge>
								) }
							</li>
						);
					} ) }
				</ul>
				{ canShowAll && ! isShowingAll && (
					<button
						className="cnl-page-finder__more cnl-page-finder__more--row"
						onClick={ toggleShowingAll }
						type="button"
					>
						{ sprintf(
							/* translators: %d: The number of pages. */
							_n(
								'Show all %d page',
								'Show all %d pages',
								all.length
							),
							all.length
						) }
					</button>
				) }
				{ ! shown.length && (
					<p className="cnl-page-finder__empty">
						{ isLoading
							? __( 'Loading pages…' )
							: __( 'No pages found.' ) }
					</p>
				) }
			</div>
			<div className="cnl-page-finder__footer">
				<button
					className="cnl-page-finder__action"
					onClick={ () => {
						onClose();
						openRoute( PAGES_PATH, { add: 1 } );
					} }
					type="button"
				>
					{ __( 'Add a page' ) }
					<Icon icon={ plus } />
				</button>
				<button
					className="cnl-page-finder__action"
					onClick={ () => {
						onClose();
						openRoute( PAGES_PATH );
					} }
					type="button"
				>
					{ __( 'Manage pages' ) }
					<Icon icon={ pagesIcon } />
				</button>
			</div>
		</div>
	);
}

/**
 * The finder in a popover, opened by whatever `renderToggle` draws.
 *
 * @param {Object}   props
 * @param {string}   props.className    Class for the dropdown's wrapper.
 * @param {Object}   props.popoverProps Passed on to the popover.
 * @param {Function} props.renderToggle Draws the toggle, given
 *                                      `{ isOpen, onToggle }`.
 * @return {Element} The dropdown.
 */
export function PageFinder( { className, popoverProps, renderToggle } ) {
	return (
		<Dropdown
			className={ className }
			contentClassName="cnl-page-finder__popover"
			focusOnMount="firstInputElement"
			popoverProps={ { placement: 'bottom', offset: 8, ...popoverProps } }
			renderContent={ ( { onClose } ) => (
				<PageFinderPanel onClose={ onClose } />
			) }
			renderToggle={ renderToggle }
		/>
	);
}
