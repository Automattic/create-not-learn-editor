/**
 * WordPress dependencies
 */
import { Tooltip as ComponentsTooltip } from '@wordpress/components';
import { useNavigate, useParams } from '@wordpress/route';
import {
	Preview as LazyEditorPreview,
	useEditorAssets,
} from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { requestBlockSelection } from '../../editor-layer/block-request';
import { getErrorMessage } from '../../records';
import { DocumentTitle } from '../../site-canvas/document-title';
import {
	Button,
	chevronDownIcon,
	compassIcon,
	coreDataStore,
	desktopIcon,
	dispatch,
	Dropdown,
	Icon,
	layoutIcon,
	MenuGroup,
	MenuItem,
	mobileIcon,
	noticesStore,
	Spinner,
	sprintf,
	tabletIcon,
	ToggleControl,
	ToggleGroupControl,
	ToggleGroupControlOption,
	ToggleGroupControlOptionIcon,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useState,
	__,
} from '../../wordpress-packages';
import {
	DEFAULT_CANVAS_VIEW_DEVICE,
	getCanvasViewDevice,
	getMenuLocationsSummary,
} from './canvas-view';
import {
	createEditorBlocksFromNavigationBlocks,
	getNavigationBlocksFromEditedRecord,
} from './navigation-blocks';
import {
	assignNavigationMenuToFirstBlock,
	NAVIGATION_OVERLAY_AREA,
	removeNavigationMenuFromFirstBlock,
	templatePartHasNavigationBlock,
} from '../navigation/navigation-locations';
import {
	NavigationSitePreview,
	NavigationSitePreviewNotice,
} from '../navigation/site-preview';
import { ChooseLocationModal } from '../navigation/choose-location-modal';
import {
	NavigationLocationsEmptyState,
	NavigationNoMenuSelectedEmptyState,
} from './empty-states';
import { LocationsNotice, OverlayDesignNotice } from './locations-notice';
import {
	PreviewOverlay,
	usePreviewMobileMenu,
	usePreviewSettled,
} from './mobile-menu';
import {
	findOverlayPart,
	getMobileMenuLocation,
	getTemplatePartPreviewBlocks,
} from './preview-blocks';
import { useNavigationLocations } from './use-navigation-locations';
import { EMPTY_ARRAY, getMenuTitle } from './shared';

function getCanvasViewDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'Desktop' },
		{ icon: tabletIcon, label: __( 'Tablet view' ), value: 'Tablet' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'Mobile' },
	];
}

function CanvasDeviceSwitcher( { device, onChange } ) {
	return (
		<ToggleGroupControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			className="routes-navigation-canvas-toolbar__devices"
			hideLabelFromVision
			label={ __( 'Preview device' ) }
			onChange={ onChange }
			value={ device }
		>
			{ getCanvasViewDeviceOptions().map( ( option ) => (
				<ToggleGroupControlOptionIcon
					icon={ option.icon }
					key={ option.value }
					label={ option.label }
					value={ option.value }
				/>
			) ) }
		</ToggleGroupControl>
	);
}

const VIEW_PREVIEW = 'preview';
const VIEW_LOCATIONS = 'locations';

/**
 * See the menu on the site, or in each place it is shown: Preview or
 * Locations. Drawn as the site canvas's Browse | Edit toggle was, at the left of
 * the toolbar, as it switches the whole canvas rather than acting on what is in
 * it.
 *
 * @param {Object}   props
 * @param {boolean}  props.isPreviewVisible Whether the site preview is on show.
 * @param {Function} props.onChange         Called with whether to show it.
 * @return {Element} The toggle.
 */
function CanvasViewToggle( { isPreviewVisible, onChange } ) {
	return (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			className="cnl-site-canvas__mode-toggle"
			hideLabelFromVision
			// Each option as wide as its own label, so Locations isn't squeezed
			// to Preview's width.
			isAdaptiveWidth
			label={ __( 'View' ) }
			onChange={ ( value ) => onChange( value === VIEW_PREVIEW ) }
			value={ isPreviewVisible ? VIEW_PREVIEW : VIEW_LOCATIONS }
		>
			{ /* A word or two on what each shows, beyond its name. */ }
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'See your site with this menu' ) }
			>
				<ToggleGroupControlOption
					label={ __( 'Preview' ) }
					value={ VIEW_PREVIEW }
				/>
			</ComponentsTooltip>
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'See each place this menu is shown' ) }
			>
				<ToggleGroupControlOption
					label={ __( 'Locations' ) }
					value={ VIEW_LOCATIONS }
				/>
			</ComponentsTooltip>
		</ToggleGroupControl>
	);
}

/**
 * The menu's name and where it is shown, in the middle of the toolbar, as
 * every other canvas names what it shows. Its chevron offers where to show it.
 *
 * @param {Object}    props
 * @param {boolean}   props.hasLocations     Whether the menu is shown anywhere.
 * @param {string}    props.locationsSummary Where it is shown.
 * @param {string}    props.menuTitle        The menu's name.
 * @param {Function}  props.onChooseLocation Opens the locations dialog.
 * @param {?Function} props.onEditMobileMenu Opens where the mobile menu is
 *                                           edited, if the menu has one.
 * @return {Element} The document title.
 */
function NavigationDocument( {
	hasLocations,
	locationsSummary,
	menuTitle,
	onChooseLocation,
	onEditMobileMenu,
} ) {
	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ compassIcon }
					/>
					<DocumentTitle title={ menuTitle } />
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ locationsSummary }
				</p>
			</div>
			<Dropdown
				className="cnl-editor-homepage-options"
				contentClassName="cnl-editor-homepage-options__content"
				popoverProps={ { placement: 'bottom' } }
				renderContent={ ( { onClose } ) => (
					<MenuGroup className="cnl-editor-homepage-options__menu">
						<MenuItem
							icon={ layoutIcon }
							onClick={ () => {
								onClose();
								onChooseLocation();
							} }
						>
							{ hasLocations
								? __( 'Update locations' )
								: __( 'Choose location' ) }
						</MenuItem>
						{ onEditMobileMenu && (
							<MenuItem
								icon={ mobileIcon }
								onClick={ () => {
									onClose();
									onEditMobileMenu();
								} }
							>
								{ __( 'Edit mobile menu' ) }
							</MenuItem>
						) }
					</MenuGroup>
				) }
				renderToggle={ ( { isOpen, onToggle } ) => (
					<Button
						aria-expanded={ isOpen }
						className="cnl-editor-homepage-options__toggle"
						icon={ chevronDownIcon }
						label={ __( 'Menu options' ) }
						onClick={ onToggle }
						showTooltip
						size="compact"
					/>
				) }
			/>
		</div>
	);
}

function NavigationCanvasHeader( {
	canOpenMenu,
	device,
	document,
	isMenuOpen,
	isPreviewVisible,
	onChangeDevice,
	onToggleMenu,
	onTogglePreview,
} ) {
	return (
		<header className="cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar">
			<div className="cnl-editor-homepage-toolbar__left">
				<CanvasViewToggle
					isPreviewVisible={ isPreviewVisible }
					onChange={ onTogglePreview }
				/>
			</div>
			<div className="cnl-editor-homepage-toolbar__center">
				{ document }
			</div>
			<div className="cnl-editor-homepage-toolbar__right">
				{ isPreviewVisible && canOpenMenu && (
					<ToggleControl
						__nextHasNoMarginBottom
						checked={ isMenuOpen }
						className="routes-navigation-canvas-toolbar__menu-toggle"
						label={ __( 'Menu open' ) }
						onChange={ onToggleMenu }
					/>
				) }
				{ isPreviewVisible && (
					<CanvasDeviceSwitcher
						device={ device }
						onChange={ onChangeDevice }
					/>
				) }
			</div>
		</header>
	);
}

/**
 * A place the menu is shown, previewed with the menu in it.
 *
 * @param {Object}   props
 * @param {Object[]} props.blocks The place's blocks, with the menu in.
 * @param {Object}   props.icon   Icon for the place.
 * @param {string}   props.label  The place's name.
 * @param {Function} props.onEdit Opens the place to edit it.
 * @return {Element} The card.
 */
function LocationCard( { blocks, icon = layoutIcon, label, onEdit } ) {
	return (
		<section className="routes-navigation-locations-canvas__card">
			<div className="routes-navigation-locations-canvas__card-header">
				<div className="routes-navigation-locations-canvas__card-title">
					<Icon
						className="routes-navigation-locations-canvas__card-icon"
						icon={ icon }
					/>
					<span>{ label }</span>
				</div>
				<Button onClick={ onEdit } variant="link">
					{ __( 'Edit' ) }
				</Button>
			</div>
			<div className="routes-navigation-locations-canvas__preview">
				<LazyEditorPreview
					blocks={ blocks || EMPTY_ARRAY }
					description={ label }
				/>
			</div>
		</section>
	);
}

export default function NavigationEditCanvas() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isResolvingTemplateParts, locations, menu, templateParts } =
		useNavigationLocations( navigationId );
	const [ locationModalMode, setLocationModalMode ] = useState( null );
	const [ isSavingLocations, setIsSavingLocations ] = useState( false );
	const [ isPreviewVisible, setIsPreviewVisible ] = useState( true );
	const [ device, setDevice ] = useState( DEFAULT_CANVAS_VIEW_DEVICE );
	// Open on a phone, where a menu is hidden behind its button until it is.
	const [ isMenuOpen, setIsMenuOpen ] = useState(
		DEFAULT_CANVAS_VIEW_DEVICE === 'Mobile'
	);
	const bodyRef = useRef();
	const selectedLocationIds = useMemo(
		() => locations.map( ( location ) => location.id ),
		[ locations ]
	);
	const menuTitle = menu ? getMenuTitle( menu ) : __( 'Navigation' );
	const mobileMenu = usePreviewMobileMenu( {
		bodyRef,
		device,
		isEnabled: isPreviewVisible,
		isOpen: isMenuOpen,
		navigationId,
	} );

	/*
	 * The editor store registers with the editor's own assets, which the preview
	 * loads lazily, so the store is absent until it has. The editor opens at the
	 * current device either way: it reads `initialViewport` on mount, and this
	 * carries every later change to it.
	 */
	useEffect( () => {
		if ( ! isPreviewVisible ) {
			return;
		}

		dispatch( 'core/editor' )?.setDeviceType?.( device );
	}, [ device, isPreviewVisible ] );
	/*
	 * The menu's blocks, for the location previews and a custom overlay open
	 * over the site preview: built only while one of those is on show, and once
	 * the editor's assets have registered WordPress's blocks, which building
	 * them needs.
	 */
	const { isReady: hasBlockTypes } = useEditorAssets();
	const showsLocations = ! isPreviewVisible && hasBlockTypes;
	const openOverlayPart =
		isPreviewVisible &&
		isMenuOpen &&
		mobileMenu.overlay &&
		findOverlayPart( templateParts, mobileMenu.overlay );
	const isPreviewSettled = usePreviewSettled( isPreviewVisible );
	const showsOverlay = Boolean( openOverlayPart ) && hasBlockTypes;
	const menuBlocks = useMemo(
		() =>
			showsLocations || showsOverlay
				? createEditorBlocksFromNavigationBlocks(
						getNavigationBlocksFromEditedRecord( menu )
					)
				: EMPTY_ARRAY,
		[ menu, showsLocations, showsOverlay ]
	);
	const overlayPreviewBlocks = useMemo(
		() =>
			showsOverlay
				? getTemplatePartPreviewBlocks(
						openOverlayPart,
						navigationId,
						menuBlocks
					)
				: EMPTY_ARRAY,
		[ menuBlocks, navigationId, openOverlayPart, showsOverlay ]
	);

	// Each location's part, with this menu in it. Parsed only while the
	// locations are on show, and kept from render to render so the previews
	// aren't rebuilt each time.
	const locationPreviewBlocks = useMemo(
		() =>
			new Map(
				! showsLocations
					? []
					: locations.map( ( location ) => [
							location.id,
							getTemplatePartPreviewBlocks(
								location.part,
								navigationId,
								menuBlocks
							),
						] )
			),
		[ locations, menuBlocks, navigationId, showsLocations ]
	);

	// Where the mobile menu is edited, for the document's options.
	const mobileMenuLocation = useMemo(
		() => getMobileMenuLocation( locations, navigationId ),
		[ locations, navigationId ]
	);

	const editTemplatePartContent = ( part, content ) =>
		editEntityRecord( 'postType', 'wp_template_part', part.id, {
			content,
		} );

	const applyLocationAssignments = async (
		selectedCandidates,
		candidates
	) => {
		setIsSavingLocations( true );

		try {
			const selectedIds = new Set(
				selectedCandidates.map( ( candidate ) => candidate.id )
			);
			const currentIds = new Set( selectedLocationIds );

			for ( const candidate of selectedCandidates ) {
				const content = assignNavigationMenuToFirstBlock(
					candidate.part,
					navigationId
				);

				if ( ! content ) {
					throw new Error(
						sprintf(
							/* translators: %s: location label. */
							__( 'Could not update %s.' ),
							candidate.label
						)
					);
				}

				editTemplatePartContent( candidate.part, content );
			}

			if ( locationModalMode === 'update' ) {
				for ( const candidate of candidates ) {
					if (
						! currentIds.has( candidate.id ) ||
						selectedIds.has( candidate.id )
					) {
						continue;
					}

					const content = removeNavigationMenuFromFirstBlock(
						candidate.part,
						navigationId
					);

					if ( ! content ) {
						throw new Error(
							sprintf(
								/* translators: %s: location label. */
								__( 'Could not update %s.' ),
								candidate.label
							)
						);
					}

					editTemplatePartContent( candidate.part, content );
				}
			}

			setLocationModalMode( null );
			createSuccessNotice(
				__(
					'Menu locations updated. Review and save changes when you are ready.'
				),
				{ type: 'snackbar' }
			);
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update menu locations (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSavingLocations( false );
		}
	};
	if ( ! navigationId ) {
		return (
			<section className="cnl-editor-canvas routes-navigation-locations-canvas-shell">
				<div className="routes-navigation-locations-canvas is-top-centered">
					<NavigationNoMenuSelectedEmptyState />
				</div>
			</section>
		);
	}

	// A custom overlay opens to edit its design. Otherwise the place the menu
	// collapses in opens with its Navigation block picked, as core's own
	// overlay is set up in its settings.
	const editMobileMenu = ( { isOverlay, location } ) =>
		isOverlay
			? navigate( {
					to: `/wp_template_part?postId=${ encodeURIComponent(
						location.part.id
					) }`,
				} )
			: editTemplatePart( location.part );

	// Opens a place the menu is shown, with its Navigation block picked.
	const editTemplatePart = ( part ) => {
		requestBlockSelection( {
			attributes: { ref: navigationId },
			blockName: 'core/navigation',
			postId: part.id,
			postType: 'wp_template_part',
		} );
		navigate( {
			to: `/wp_template_part?postId=${ encodeURIComponent( part.id ) }`,
		} );
	};

	const locationsView = ! isPreviewVisible && (
		<div className="routes-navigation-locations-canvas__content">
			{ isResolvingTemplateParts && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ ! isResolvingTemplateParts && locations.length === 0 && (
				<NavigationLocationsEmptyState
					disabled={ isResolvingTemplateParts }
					onChooseLocation={ () => setLocationModalMode( 'choose' ) }
				/>
			) }
			{ ! isResolvingTemplateParts && locations.length > 0 && (
				<div className="routes-navigation-locations-canvas__previews">
					<LocationsNotice
						canAddLocation={
							templateParts.filter( ( part ) =>
								templatePartHasNavigationBlock( part )
							).length > locations.length
						}
						locations={ locations }
						onChangeLocation={ () =>
							setLocationModalMode( 'update' )
						}
					/>
					{ locations.map( ( location ) => (
						<LocationCard
							blocks={ locationPreviewBlocks.get( location.id ) }
							// An overlay opens from a menu button, mostly on
							// phones.
							icon={
								location.area === NAVIGATION_OVERLAY_AREA
									? mobileIcon
									: layoutIcon
							}
							key={ location.id }
							label={ location.label }
							onEdit={ () => editTemplatePart( location.part ) }
						/>
					) ) }
				</div>
			) }
		</div>
	);

	return (
		<section className="cnl-editor-canvas routes-navigation-canvas">
			<NavigationCanvasHeader
				canOpenMenu={ mobileMenu.canOpen }
				device={ device }
				document={
					<NavigationDocument
						hasLocations={ locations.length > 0 }
						locationsSummary={ getMenuLocationsSummary(
							locations.length
						) }
						menuTitle={ menuTitle }
						onChooseLocation={ () =>
							setLocationModalMode(
								locations.length > 0 ? 'update' : 'choose'
							)
						}
						onEditMobileMenu={
							mobileMenuLocation
								? () => editMobileMenu( mobileMenuLocation )
								: null
						}
					/>
				}
				isMenuOpen={ isMenuOpen }
				isPreviewVisible={ isPreviewVisible }
				onChangeDevice={ ( value ) => {
					const next = getCanvasViewDevice( value );

					setDevice( next );
					setIsMenuOpen( next === 'Mobile' );
				} }
				onToggleMenu={ setIsMenuOpen }
				onTogglePreview={ setIsPreviewVisible }
			/>
			{ isPreviewVisible &&
				! isResolvingTemplateParts &&
				locations.length === 0 && (
					<NavigationSitePreviewNotice
						onChooseLocation={ () =>
							setLocationModalMode( 'choose' )
						}
					/>
				) }
			{ showsOverlay && isPreviewSettled && (
				<div className="routes-navigation-canvas__notice">
					<OverlayDesignNotice
						onEditDesign={ () =>
							navigate( {
								to: `/wp_template_part?postId=${ encodeURIComponent(
									openOverlayPart.id
								) }`,
							} )
						}
					/>
				</div>
			) }
			<div className="routes-navigation-canvas__body" ref={ bodyRef }>
				{ isPreviewVisible ? (
					<NavigationSitePreview device={ device } />
				) : (
					locationsView
				) }
			</div>
			{ showsOverlay && isPreviewSettled && (
				<PreviewOverlay
					blocks={ overlayPreviewBlocks }
					frameBody={ mobileMenu.frameBody }
					height={ mobileMenu.height }
					width={ mobileMenu.width }
				/>
			) }
			{ locationModalMode && (
				<ChooseLocationModal
					/*
					 * Seeded once, when it opens. Re-seeding as the locations
					 * change would undo what has been ticked since.
					 */
					key={ locationModalMode }
					initialSelectedLocationIds={
						locationModalMode === 'update'
							? selectedLocationIds
							: EMPTY_ARRAY
					}
					isSaving={ isSavingLocations }
					mode={ locationModalMode }
					onApply={ applyLocationAssignments }
					onClose={ () => {
						if ( ! isSavingLocations ) {
							setLocationModalMode( null );
						}
					} }
					templateParts={ templateParts }
				/>
			) }
		</section>
	);
}
