/**
 * The Site parts screens: a short list of the parts every page shares, the
 * header and the footer, each leading to its own screen. Reached from the
 * sidebar and from "Home".
 *
 * Like a page on the Pages screen: the stage holds what can be changed about
 * the part as a whole, and the canvas shows the homepage with the part in the
 * spotlight, editable in place.
 *
 * Each thing that can be changed opens as a view of the same screen, rather
 * than another screen, so the part stays in the spotlight throughout, with
 * what the view changes outlined in it.
 */

/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { cnlEditorStore, getTitleText } from '../../records';
import ScreenLinks from '../../screen-links';
import { settings } from '../../settings';
import {
	PageSwitcher,
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../site-canvas';
import { expandCanvas } from '../../site-canvas/expansion';
import { withCanvasRecovery } from '../../canvas-recovery';
import { GlobalScope } from '../../global-scope';
import { withUiTheme } from '../../theme';
import { getPatternTitle } from '../content/page-layouts';
import { getCurrentEditorPath } from '../static/screens';
import { withScreenKey } from '../../screen-key';
import { useMenuItemsEditor } from '../navigation-edit/menu-items-editor';
import { SiteIdentityFields, useSiteIdentity } from '../../pickers/identity';
import { SitePartLayouts } from '../../pickers/site-part-layouts';
import {
	SITE_PART_PATHS,
	SITE_PARTS_PATH,
	getSiteParts,
	getSitePartMenus,
	useSitePart,
	useSitePartContents,
	useSitePartLayouts,
	getLinkCount,
} from './data';
import {
	getSocialLinksDescription,
	useSocialLinks,
	withSocialLinks,
} from './social-links';
import { SocialLinks } from './social-links-editor';
import { useSitePartSpotlight } from './spotlight';
import {
	blockEditorStore,
	Breadcrumbs,
	Button,
	Modal,
	noticesStore,
	Page,
	RadioControl,
	Spinner,
	Stack,
	Text,
	__,
	_n,
	compassIcon,
	coreDataStore,
	footerIcon,
	headerIcon,
	layoutIcon,
	shareIcon,
	siteLogoIcon,
	sprintf,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

// The search params that open a part's views, over the same canvas.
const LAYOUTS_VIEW = 'layouts';
const IDENTITY_VIEW = 'identity';
const MENU_VIEW = 'menu';
const SOCIAL_VIEW = 'social';

// What each view is called, and the line under its heading.
const VIEWS = {
	[ IDENTITY_VIEW ]: {
		description: () =>
			__(
				'Change them here, and see them on the right. Save to keep them.',
				'create-not-learn-editor'
			),
		title: () => __( 'Name & logo', 'create-not-learn-editor' ),
	},
	[ LAYOUTS_VIEW ]: {
		description: () =>
			__(
				'Pick one to try it on the right. Save to keep it.',
				'create-not-learn-editor'
			),
		title: () => __( 'Layouts', 'create-not-learn-editor' ),
	},
	[ MENU_VIEW ]: {
		description: () =>
			__(
				'The links in your menu. Change them here, and see them on the right. Save to keep them.',
				'create-not-learn-editor'
			),
		title: () => __( 'Menu', 'create-not-learn-editor' ),
	},
	[ SOCIAL_VIEW ]: {
		description: () =>
			__(
				'Your social profiles. Change them here, and see them on the right. Save to keep them.',
				'create-not-learn-editor'
			),
		title: () => __( 'Social links', 'create-not-learn-editor' ),
	},
};

const SITE_PARTS = {
	footer: {
		allDescription: __(
			'Every footer your site has.',
			'create-not-learn-editor'
		),
		allTitle: __( 'See all footers', 'create-not-learn-editor' ),
		choice: __(
			'Choose how the bottom of every page looks.',
			'create-not-learn-editor'
		),
		description: __(
			'Shown at the bottom of every page. Pick Edit design or Edit content on it, on the right, to change it.',
			'create-not-learn-editor'
		),
		icon: footerIcon,
		linksLabel: __( 'Footer options', 'create-not-learn-editor' ),
		missing: __(
			'Your homepage doesn’t have a footer.',
			'create-not-learn-editor'
		),
		noOptions: __(
			'Your footer has no name, logo, menu or social links, and your theme offers no other layouts for it.',
			'create-not-learn-editor'
		),
		title: __( 'Footer', 'create-not-learn-editor' ),
	},
	header: {
		allDescription: __(
			'Every header your site has.',
			'create-not-learn-editor'
		),
		allTitle: __( 'See all headers', 'create-not-learn-editor' ),
		choice: __(
			'Choose how the top of every page looks.',
			'create-not-learn-editor'
		),
		description: __(
			'Shown at the top of every page. Pick Edit design or Edit content on it, on the right, to change it.',
			'create-not-learn-editor'
		),
		icon: headerIcon,
		linksLabel: __( 'Header options', 'create-not-learn-editor' ),
		missing: __(
			'Your homepage doesn’t have a header.',
			'create-not-learn-editor'
		),
		noOptions: __(
			'Your header has no name, logo, menu or social links, and your theme offers no other layouts for it.',
			'create-not-learn-editor'
		),
		title: __( 'Header', 'create-not-learn-editor' ),
	},
};

// The screen listing the parts, and the first crumb back on each.
const SITE_PARTS_TITLE = __( 'Site parts', 'create-not-learn-editor' );

function getSitePartsCrumb() {
	return { label: SITE_PARTS_TITLE, to: SITE_PARTS_PATH };
}

function Note( { children } ) {
	return (
		<Text className="routes-styles__muted" variant="body-md">
			{ children }
		</Text>
	);
}

function Loading() {
	return (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);
}

/**
 * The menus the part shows: for each of its Navigation blocks, the one it
 * names, or, as the block does without one, the site's first.
 *
 * @param {Object[]} menus The part's menus, from `useSitePartContents`.
 * @return {Object[]} `{ clientId, index, menuId, title }` for each. `menuId`
 *                    is undefined when the site has no menus.
 */
function usePartMenus( menus ) {
	// Joined, so the selector returns a value that only changes with them.
	const json = useSelect(
		( select ) => {
			const firstId =
				select( cnlEditorStore ).getNavigationMenus()?.[ 0 ]?.id;

			const items = menus.map( ( { clientId, index, ref } ) => {
				const id = ref || firstId;
				const menu = id
					? select( coreDataStore ).getEditedEntityRecord(
							'postType',
							'wp_navigation',
							id
						)
					: null;

				return {
					clientId,
					index,
					menuId: id,
					title: getTitleText( menu?.title ),
				};
			} );

			return JSON.stringify( items );
		},
		[ menus ]
	);

	return useMemo( () => JSON.parse( json ), [ json ] );
}

function getLayoutsDescription( { currentName, layouts } ) {
	const current = layouts.find( ( pattern ) => pattern.name === currentName );

	return current
		? getPatternTitle( current )
		: sprintf(
				/* translators: %d: Number of layouts. */
				_n(
					'%d to pick from',
					'%d to pick from',
					layouts.length,
					'create-not-learn-editor'
				),
				layouts.length
			);
}

// Each row says what it does, adding what isn't there yet or changing it.
function getIdentityLink( { hasLogo, hasSiteTitle }, site ) {
	if ( ! hasSiteTitle ) {
		return site.site_logo
			? {
					description: __(
						'Swap in a different image.',
						'create-not-learn-editor'
					),
					title: __( 'Change logo', 'create-not-learn-editor' ),
				}
			: {
					description: __(
						'Upload one, or pick an image you have.',
						'create-not-learn-editor'
					),
					title: __( 'Add a logo', 'create-not-learn-editor' ),
				};
	}

	if ( ! site.title ) {
		return {
			description: __(
				'Your site has no name yet.',
				'create-not-learn-editor'
			),
			title: hasLogo
				? __( 'Add a name & logo', 'create-not-learn-editor' )
				: __( 'Name your site', 'create-not-learn-editor' ),
		};
	}

	return {
		description: site.title,
		title: hasLogo
			? __( 'Change name & logo', 'create-not-learn-editor' )
			: __( 'Change site name', 'create-not-learn-editor' ),
	};
}

/**
 * What can be changed about the part, each a row leading to its own view:
 * its layouts, then the site's name and logo, the menu and the social links,
 * when it shows them.
 *
 * @param {Object} props
 * @param {string} props.area     `header` or `footer`.
 * @param {string} props.clientId The part's client ID in the editor.
 * @param {string} props.id       The part's template part ID.
 * @return {Element} The rows, or a note when there are none.
 */
function SitePartLinks( { area, clientId, id } ) {
	const part = SITE_PARTS[ area ];
	const contents = useSitePartContents( clientId );
	const layouts = useSitePartLayouts( area, id );
	const identity = useSiteIdentity();
	const menus = usePartMenus( contents.menus ).filter(
		( menu ) => menu.menuId
	);
	const social = useSocialLinks( area );

	if ( identity.isLoading ) {
		return <Loading />;
	}

	const links = [];

	// The theme's patterns can be slow to arrive, so the row shows while
	// they load and goes if the theme turns out to have none.
	if ( ! layouts.hasResolved || layouts.layouts.length ) {
		links.push( {
			description: layouts.hasResolved
				? getLayoutsDescription( layouts )
				: __( 'Finding layouts…', 'create-not-learn-editor' ),
			icon: layoutIcon,
			search: { view: LAYOUTS_VIEW },
			title: __( 'Change layout', 'create-not-learn-editor' ),
			to: SITE_PART_PATHS[ area ],
		} );
	}

	if ( contents.hasSiteTitle || contents.hasLogo ) {
		links.push( {
			...getIdentityLink( contents, identity.site ),
			icon: siteLogoIcon,
			search: { view: IDENTITY_VIEW },
			to: SITE_PART_PATHS[ area ],
		} );
	}

	// A row for each menu, as a footer often has several.
	menus.forEach( ( menu, position ) => {
		links.push( {
			description:
				menu.title || __( 'Your menu', 'create-not-learn-editor' ),
			icon: compassIcon,
			search: { view: MENU_VIEW, menu: menu.index },
			title:
				menus.length > 1
					? sprintf(
							/* translators: %d: The menu's place in the part, from 1. */
							__( 'Edit menu %d', 'create-not-learn-editor' ),
							position + 1
						)
					: __( 'Edit menu', 'create-not-learn-editor' ),
			to: SITE_PART_PATHS[ area ],
		} );
	} );

	if ( contents.hasSocialLinks && social.links ) {
		links.push( {
			description: getSocialLinksDescription(
				social.links,
				social.services
			),
			icon: shareIcon,
			search: { view: SOCIAL_VIEW },
			title: __( 'Social links', 'create-not-learn-editor' ),
			to: SITE_PART_PATHS[ area ],
		} );
	}

	return (
		<>
			{ links.length ? (
				<ScreenLinks label={ part.linksLabel } links={ links } />
			) : (
				<Note>{ part.noOptions }</Note>
			) }
			<ScreenLinks
				label={ part.allTitle }
				links={ [
					{
						description: part.allDescription,
						icon: part.icon,
						search: { area },
						title: part.allTitle,
						to: '/template-parts',
					},
				] }
			/>
		</>
	);
}

/**
 * The other parts on the homepage that show the same menu, so the screen can
 * say a change to its links shows there too.
 *
 * @param {string}  clientId The Navigation block on screen.
 * @param {?number} menuId   The menu it shows.
 * @return {string[]} Areas, `header` or `footer`, once each.
 */
function useMenuSharedWith( clientId, menuId ) {
	const areas = useSelect(
		( select ) => {
			const theme = select( coreDataStore ).getCurrentTheme()?.stylesheet;

			if ( ! theme || ! menuId ) {
				return '';
			}

			const store = select( blockEditorStore );
			const firstId =
				select( cnlEditorStore ).getNavigationMenus()?.[ 0 ]?.id;

			return getSiteParts( store, theme )
				.filter( ( part ) =>
					getSitePartMenus(
						store,
						store.getClientIdsOfDescendants( part.clientId )
					).some(
						( menu ) =>
							menu.clientId !== clientId &&
							( menu.ref || firstId ) === menuId
					)
				)
				.map( ( part ) => part.area )
				.filter( ( area, index, all ) => all.indexOf( area ) === index )
				.join( ',' );
		},
		[ clientId, menuId ]
	);

	return useMemo( () => ( areas ? areas.split( ',' ) : [] ), [ areas ] );
}

function getSharedWithText( areas, area ) {
	if ( ! areas.length ) {
		return null;
	}

	const others = areas.filter( ( other ) => other !== area );

	if ( ! others.length ) {
		return sprintf(
			/* translators: %s: A part of the site, like "footer". */
			__( 'Also shown elsewhere in your %s', 'create-not-learn-editor' ),
			SITE_PARTS[ area ].title.toLowerCase()
		);
	}

	return sprintf(
		/* translators: %s: A part of the site, like "header". */
		__( 'Also shown in your %s', 'create-not-learn-editor' ),
		SITE_PARTS[ others[ 0 ] ].title.toLowerCase()
	);
}

/**
 * Asks which menu to show instead. Switching is deliberate: a different menu
 * has to be picked and confirmed, and the one shown now stays as it is.
 *
 * @param {Object}     props
 * @param {string}     props.area     `header` or `footer`.
 * @param {string}     props.clientId The Navigation block's client ID.
 * @param {?number}    props.menuId   The menu it shows now.
 * @param {Object[]}   props.menus    Every menu the site has.
 * @param {() => void} props.onClose  Closes the dialog.
 * @return {Element} The dialog.
 */
function SwitchMenuDialog( { area, clientId, menuId, menus, onClose } ) {
	const [ selected, setSelected ] = useState( String( menuId ) );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const partName = SITE_PARTS[ area ].title.toLowerCase();
	const current = menus.find( ( menu ) => menu.id === menuId );

	const onConfirm = () => {
		const next = menus.find( ( menu ) => String( menu.id ) === selected );

		updateBlockAttributes( clientId, { ref: next.id } );
		createSuccessNotice(
			sprintf(
				/* translators: 1: Menu title. 2: A part of the site, like "footer". */
				__(
					'Your %2$s now shows %1$s. Save to keep it.',
					'create-not-learn-editor'
				),
				getTitleText( next.title ) ||
					__( 'the menu', 'create-not-learn-editor' ),
				partName
			),
			{ type: 'snackbar' }
		);
		onClose();
	};

	return (
		<Modal
			className="cnl-site-part__switch-menu"
			onRequestClose={ onClose }
			size="medium"
			title={ sprintf(
				/* translators: %s: A part of the site, like "footer". */
				__( 'Switch the menu in your %s', 'create-not-learn-editor' ),
				partName
			) }
		>
			<Stack direction="column" gap="lg">
				<Text
					className="routes-styles__muted"
					render={ <p /> }
					variant="body-md"
				>
					{ sprintf(
						/* translators: %s: Menu title. */
						__(
							'Pick another menu to show here. %s stays as it is, and nothing changes on your site until you save.',
							'create-not-learn-editor'
						),
						getTitleText( current?.title ) ||
							__( 'Your menu', 'create-not-learn-editor' )
					) }
				</Text>
				<RadioControl
					hideLabelFromVision
					label={ __( 'Menus', 'create-not-learn-editor' ) }
					onChange={ setSelected }
					options={ menus.map( ( menu ) => ( {
						description:
							menu.id === menuId
								? sprintf(
										/* translators: %s: Number of links, like "2 links". */
										__(
											'%s · Shown here now',
											'create-not-learn-editor'
										),
										getLinkCount( menu )
									)
								: getLinkCount( menu ),
						label:
							getTitleText( menu.title ) ||
							__( '(no title)', 'create-not-learn-editor' ),
						value: String( menu.id ),
					} ) ) }
					selected={ selected }
				/>
				<div className="cnl-site-part__switch-menu-actions">
					<Button
						__next40pxDefaultSize
						onClick={ onClose }
						variant="tertiary"
					>
						{ __( 'Cancel', 'create-not-learn-editor' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						disabled={ selected === String( menuId ) }
						onClick={ onConfirm }
						variant="primary"
					>
						{ __( 'Show this menu', 'create-not-learn-editor' ) }
					</Button>
				</div>
			</Stack>
		</Modal>
	);
}

/**
 * The menu a Navigation block shows, named first so it is clear which one
 * the links below belong to, with a quiet way to show another.
 *
 * @param {Object}  props
 * @param {string}  props.area     `header` or `footer`.
 * @param {string}  props.clientId The Navigation block's client ID.
 * @param {?number} props.menuId   The menu it shows.
 * @param {string}  props.title    That menu's title.
 * @return {Element} The menu in use.
 */
function MenuInUse( { area, clientId, menuId, title } ) {
	const [ isSwitching, setIsSwitching ] = useState( false );
	const { menu, menus } = useSelect(
		( select ) => ( {
			menu: select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'wp_navigation',
				menuId
			),
			menus: select( cnlEditorStore ).getNavigationMenus() || [],
		} ),
		[ menuId ]
	);
	const sharedWith = getSharedWithText(
		useMenuSharedWith( clientId, menuId ),
		area
	);

	return (
		<div className="cnl-site-part__menu-in-use">
			<div className="cnl-site-part__menu-in-use-text">
				<Text className="routes-styles__muted" variant="body-sm">
					{ sprintf(
						/* translators: %s: A part of the site, like "footer". */
						__( 'Menu in your %s', 'create-not-learn-editor' ),
						SITE_PARTS[ area ].title.toLowerCase()
					) }
				</Text>
				<Text render={ <p /> } variant="heading-md">
					{ title || __( 'Your menu', 'create-not-learn-editor' ) }
				</Text>
				<Text className="routes-styles__muted" variant="body-sm">
					{ [ getLinkCount( menu ), sharedWith ]
						.filter( Boolean )
						.join( ' · ' ) }
				</Text>
			</div>
			{ menus.length > 1 && (
				<Button
					className="cnl-site-part__menu-switch"
					onClick={ () => setIsSwitching( true ) }
					size="compact"
					variant="link"
				>
					{ __( 'Switch menu', 'create-not-learn-editor' ) }
				</Button>
			) }
			{ isSwitching && (
				<SwitchMenuDialog
					area={ area }
					clientId={ clientId }
					menuId={ menuId }
					menus={ menus }
					onClose={ () => setIsSwitching( false ) }
				/>
			) }
		</div>
	);
}

/**
 * One of the menus the part shows, its items edited in place. Changes wait
 * for the save, like any other.
 *
 * @param {Object} props
 * @param {string} props.area     `header` or `footer`.
 * @param {string} props.clientId The part's client ID in the editor.
 * @param {number} props.index    The menu's place among the part's
 *                                Navigation blocks.
 * @return {Element} The menu's items.
 */
function PartMenu( { area, clientId, index } ) {
	const contents = useSitePartContents( clientId );
	const menu = usePartMenus( contents.menus ).find(
		( item ) => item.index === index
	);
	const { editor, isMenuReady } = useMenuItemsEditor( menu?.menuId );

	if ( ! menu?.menuId ) {
		return (
			<Note>
				{ __(
					'Your site doesn’t have a menu yet.',
					'create-not-learn-editor'
				) }
			</Note>
		);
	}

	return (
		<Stack direction="column" gap="lg">
			<MenuInUse area={ area } { ...menu } />
			{ isMenuReady ? (
				<div className="cnl-site-part__menu">{ editor }</div>
			) : (
				<Loading />
			) }
		</Stack>
	);
}

// The menu a view is about, from its search params.
function getMenuIndex( menu ) {
	const index = Number( menu );

	return Number.isInteger( index ) && index >= 0 ? index : 0;
}

/**
 * The theme's layouts for the part, from the shared layout picker. The
 * site's social links go into any layout that has a place for them. They are
 * remembered while the layouts are open, so passing through one without
 * social links doesn't lose them.
 *
 * @param {Object} props
 * @param {string} props.area `header` or `footer`.
 * @param {string} props.id   The part's template part ID.
 * @return {Element} The layouts.
 */
function Layouts( { area, id } ) {
	const { links: socialLinks } = useSocialLinks( area );
	const socialLinksRef = useRef();
	if ( socialLinks?.length ) {
		socialLinksRef.current = socialLinks;
	}

	return (
		<SitePartLayouts
			area={ area }
			id={ id }
			prepareBlocks={ ( blocks ) =>
				socialLinksRef.current
					? withSocialLinks( blocks, socialLinksRef.current )
					: blocks
			}
			Preview={ LazyEditorPreview }
		/>
	);
}

function SitePartView( { area, clientId, id, menu, view } ) {
	if ( view === LAYOUTS_VIEW ) {
		return <Layouts area={ area } id={ id } />;
	}

	if ( view === IDENTITY_VIEW ) {
		return <SiteIdentityFields />;
	}

	if ( view === MENU_VIEW ) {
		return (
			<PartMenu
				area={ area }
				clientId={ clientId }
				index={ getMenuIndex( menu ) }
			/>
		);
	}

	if ( view === SOCIAL_VIEW ) {
		return <SocialLinks area={ area } />;
	}

	return <SitePartLinks area={ area } clientId={ clientId } id={ id } />;
}

function createStage( area ) {
	const part = SITE_PARTS[ area ];

	return function SitePartStage() {
		const { menu, view: viewName } = useSearch( { strict: false } );
		const { clientId, id, isEditorReady } = useSitePart( area );
		const view = Object.hasOwn( VIEWS, viewName )
			? VIEWS[ viewName ]
			: null;

		return (
			<Page
				breadcrumbs={
					<Breadcrumbs
						items={
							view
								? [
										getSitePartsCrumb(),
										{
											label: part.title,
											to: SITE_PART_PATHS[ area ],
										},
										{ label: view.title() },
									]
								: [ getSitePartsCrumb(), { label: part.title } ]
						}
					/>
				}
				className="cnl-editor-stage cnl-editor-content-page"
				hasPadding={ false }
				headingLevel={ 2 }
				subTitle={ view ? view.description() : part.description }
			>
				<div className="cnl-editor-stage routes-styles cnl-site-part">
					{ ! isEditorReady && <Loading /> }
					{ isEditorReady && ! id && <Note>{ part.missing }</Note> }
					{ id && (
						<SitePartView
							area={ area }
							clientId={ clientId }
							id={ id }
							menu={ menu }
							view={ view && viewName }
						/>
					) }
				</div>
			</Page>
		);
	};
}

/*
 * The parts every page shares, a row for each leading on to its own screen.
 * Only the main ones: each part's screen leads on to the rest in its area.
 */
function SitePartsStage() {
	const links = [ 'header', 'footer' ].map( ( area ) => ( {
		description: SITE_PARTS[ area ].choice,
		icon: SITE_PARTS[ area ].icon,
		title: SITE_PARTS[ area ].title,
		to: SITE_PART_PATHS[ area ],
	} ) );

	return (
		<Page
			className="cnl-editor-stage cnl-editor-content-page"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ __(
				'The parts every page shares. Pick one to change it everywhere.',
				'create-not-learn-editor'
			) }
			title={ SITE_PARTS_TITLE }
		>
			<div className="cnl-editor-stage routes-styles cnl-site-part">
				<ScreenLinks label={ SITE_PARTS_TITLE } links={ links } />
			</div>
		</Page>
	);
}

// The bar pages have, marked as shared, as the part is on every page. It
// doesn't go to other pages, as the screen is about the part.
function PartDocument( { title } ) {
	return (
		<div className="cnl-editor-homepage-document">
			<PageSwitcher
				canSwitch={ false }
				meta={ __( 'Every page', 'create-not-learn-editor' ) }
				shared={ sprintf(
					/* translators: %s: Header or Footer. */
					__(
						'The %s is the same on every page. Changes show on all of them.',
						'create-not-learn-editor'
					),
					title
				) }
				title={ title }
			/>
		</div>
	);
}

function createCanvas( area ) {
	return function SitePartCanvas() {
		const { view } = useSearch( { strict: false } );
		const canvas = useSiteCanvas( { url: settings.homeUrl } );
		const editorRef = useRef();
		const { clientId, id } = useSitePart( area );
		const canvasDocument = useCanvasDocument(
			editorRef,
			canvas.editorEntity?.postId
		);

		useSitePartSpotlight( {
			area,
			canvasDocument,
			clientId,
			focus: view,
			frame: canvas.frame,
			isPreviewing: canvas.isPreviewing,
		} );

		// The full editor opens the part itself.
		const editRoute = id
			? { search: { postId: id }, to: '/wp_template_part' }
			: null;

		return (
			<SiteCanvas
				// The screen is about one part, not the page's sections.
				canCompose={ false }
				canvas={ { ...canvas, editRoute } }
				className={ `cnl-site-part-canvas is-${ area }` }
				document={ <PartDocument title={ SITE_PARTS[ area ].title } /> }
				editorRef={ editorRef }
				// The part is all Edit offers, the rest of the page dimmed.
				focusId={ clientId }
			/>
		);
	};
}

/*
 * The homepage, with its header and footer, before either is picked. Edit
 * offers both, and the page's sections, as on any page.
 */
function SitePartsCanvas() {
	const canvas = useSiteCanvas( { url: settings.homeUrl } );

	/*
	 * The screen is for picking a part, so its list always shows, even when
	 * the canvas was left filling the editor in Edit. Runs after the
	 * canvas's own effect, which expands it in Edit.
	 */
	useEffect( () => {
		expandCanvas( false );
	}, [] );

	return (
		<SiteCanvas
			canCompose={ false }
			canvas={ canvas }
			className="cnl-site-part-canvas"
			document={ <PartDocument title={ SITE_PARTS_TITLE } /> }
		/>
	);
}

/**
 * Everything on the screen edits a part every page shares, so all of it is
 * in purple. See `src/global-scope`.
 *
 * @param {Function} Component The stage or canvas.
 * @return {Function} The component, in purple.
 */
function withGlobalScope( Component ) {
	return function GlobalSitePart( props ) {
		return (
			<GlobalScope>
				<Component { ...props } />
			</GlobalScope>
		);
	};
}

export const sitePartsStage = withUiTheme( withGlobalScope( SitePartsStage ) );
export const sitePartsCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( SitePartsCanvas ) )
);
export const headerStage = withUiTheme(
	withGlobalScope( createStage( 'header' ) )
);
export const headerCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( createCanvas( 'header' ) ) )
);
export const footerStage = withUiTheme(
	withGlobalScope( createStage( 'footer' ) )
);
export const footerCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( createCanvas( 'footer' ) ) )
);

/**
 * The Site parts screen and each part's screen share one module, so each
 * screen's stage and canvas is picked by its path.
 *
 * @param {Object} screens Components keyed by screen path.
 * @return {string} The path of the screen on show.
 */
function getScreenPath( screens ) {
	const path = getCurrentEditorPath();

	return screens[ path ] ? path : SITE_PARTS_PATH;
}

/**
 * Each screen's route mounts its own stage, so the stage keeps the screen
 * it was mounted for, even while it makes way for the next one.
 *
 * @param {Object} screens Stages keyed by screen path.
 * @return {Function} The stage.
 */
function stageByScreen( screens ) {
	return function SitePartStage() {
		const [ Screen ] = useState(
			() => screens[ getScreenPath( screens ) ]
		);

		return <Screen />;
	};
}

/**
 * Boot keeps the canvas mounted from one of these screens to the next, so
 * it follows the path, and is mounted afresh for each screen.
 *
 * @param {Object} screens Canvases keyed by screen path.
 * @return {Function} The canvas.
 */
function canvasByScreen( screens ) {
	return withScreenKey(
		function SitePartCanvas() {
			const Screen = screens[ getScreenPath( screens ) ];

			return <Screen />;
		},
		() => getScreenPath( screens )
	);
}

export const stage = stageByScreen( {
	[ SITE_PARTS_PATH ]: sitePartsStage,
	[ SITE_PART_PATHS.header ]: headerStage,
	[ SITE_PART_PATHS.footer ]: footerStage,
} );
export const canvas = canvasByScreen( {
	[ SITE_PARTS_PATH ]: sitePartsCanvas,
	[ SITE_PART_PATHS.header ]: headerCanvas,
	[ SITE_PART_PATHS.footer ]: footerCanvas,
} );
