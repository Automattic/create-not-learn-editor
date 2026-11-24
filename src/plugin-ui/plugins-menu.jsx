/**
 * The Plugins button: one control for everything plugins add to the editor.
 * It opens a list of them, each with its icon, its name and what it adds,
 * searchable once it is long. A plugin with a panel opens it beside the
 * page; one with only page settings opens those. Menu actions and preview
 * items follow. See `README.md`.
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	NavigableMenu,
	Notice,
	SearchControl,
} from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	plugins as pluginsIcon,
	settings as settingsIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	SETTINGS_SIDEBAR,
	getPinnedLimit,
	toggleSidebar,
	useActivePluginSidebar,
	usePinnedSidebars,
} from './sidebars';

/**
 * Moves focus into a panel just opened, once the menu has handed focus back
 * to its button, so a keyboard lands where the plugin is.
 *
 * @param {string} identifier The panel.
 */
function focusPanel( identifier ) {
	window.setTimeout( () => {
		document
			.querySelector(
				`[id="${ identifier.replace( '/', ':' ) }"] .interface-complementary-area-header`
			)
			?.parentElement?.querySelector(
				'.components-panel input, .components-panel textarea, .components-panel button, .components-panel select, .interface-complementary-area-header button'
			)
			?.focus();
		// After core's panel has slid in.
	}, 500 );
}

// A list longer than this gets a search field.
const SEARCH_FROM = 6;

function matches( plugin, search ) {
	const term = search.trim().toLowerCase();
	return (
		! term ||
		plugin.title.toLowerCase().includes( term ) ||
		plugin.adds.toLowerCase().includes( term )
	);
}

function PluginsList( { inventory, metaBoxes, onClose } ) {
	const [ search, setSearch ] = useState( '' );
	const activeSidebar = useActivePluginSidebar();
	const menuRef = useRef();
	const { plugins, unattributed } = inventory;
	const shown = plugins.filter( ( plugin ) => matches( plugin, search ) );
	const actions = [
		...plugins.flatMap( ( plugin ) =>
			plugin.actions.map( ( action ) => ( { ...action, plugin } ) )
		),
		...unattributed.actions,
	].filter(
		( action ) =>
			! search ||
			action.label.toLowerCase().includes( search.toLowerCase() )
	);

	const open = ( plugin ) => {
		const identifier = plugin.sidebars.length
			? plugin.sidebars[ 0 ].identifier
			: SETTINGS_SIDEBAR;
		const opens = activeSidebar !== identifier;
		toggleSidebar( identifier );
		onClose();
		if ( opens ) {
			focusPanel( identifier );
		}
	};

	return (
		<div className="cnl-plugins-menu__content">
			{ metaBoxes?.boxes?.length > 0 && (
				<Notice
					className="cnl-plugins-menu__meta-boxes"
					status="info"
					isDismissible={ false }
					actions={ [
						{
							label: __( 'Open in the full editor' ),
							url: metaBoxes.url,
							variant: 'link',
						},
					] }
				>
					{ sprintf(
						/* translators: %s: Names of the boxes, like "Legacy custom fields". */
						__(
							'Some settings for this only show in the full editor: %s.'
						),
						metaBoxes.boxes.map( ( box ) => box.title ).join( ', ' )
					) }
				</Notice>
			) }
			{ plugins.length > SEARCH_FROM && (
				<SearchControl
					__nextHasNoMarginBottom
					className="cnl-plugins-menu__search"
					label={ __( 'Search plugins' ) }
					placeholder={ __( 'Search plugins' ) }
					value={ search }
					onChange={ setSearch }
					onKeyDown={ ( event ) => {
						if ( event.key === 'ArrowDown' ) {
							event.preventDefault();
							menuRef.current
								?.querySelector( '[role^="menuitem"]' )
								?.focus();
						}
					} }
				/>
			) }
			<NavigableMenu
				ref={ menuRef }
				className="cnl-plugins-menu__list"
				aria-label={ __( 'Plugins' ) }
				cycle={ false }
			>
				{ inventory.hasDocumentSettings && ! search && (
					<MenuGroup>
						<MenuItem
							icon={ settingsIcon }
							iconPosition="left"
							info={ __(
								'What plugins add to this page’s settings'
							) }
							role="menuitemcheckbox"
							isSelected={ activeSidebar === SETTINGS_SIDEBAR }
							onClick={ () => {
								const opens =
									activeSidebar !== SETTINGS_SIDEBAR;
								toggleSidebar( SETTINGS_SIDEBAR );
								onClose();
								if ( opens ) {
									focusPanel( SETTINGS_SIDEBAR );
								}
							} }
						>
							{ __( 'Settings from plugins' ) }
						</MenuItem>
					</MenuGroup>
				) }
				{ shown.length > 0 && (
					<MenuGroup label={ __( 'Plugins' ) }>
						{ shown.map( ( plugin ) => {
							const sidebar = plugin.sidebars[ 0 ];
							const isOpen =
								!! sidebar &&
								activeSidebar === sidebar.identifier;
							return (
								<MenuItem
									key={ plugin.name }
									className="cnl-plugins-menu__item"
									icon={ sidebar?.icon || plugin.icon }
									iconPosition="left"
									info={ plugin.adds }
									role={
										sidebar
											? 'menuitemcheckbox'
											: 'menuitem'
									}
									isSelected={ sidebar ? isOpen : undefined }
									onClick={ () => open( plugin ) }
									disabled={
										! sidebar &&
										! plugin.documentPanels.length
									}
									accessibleWhenDisabled
								>
									{ plugin.title }
								</MenuItem>
							);
						} ) }
					</MenuGroup>
				) }
				{ actions.length > 0 && (
					<MenuGroup label={ __( 'Actions' ) }>
						{ actions.map( ( action ) => (
							<MenuItem
								key={ action.label + action.plugin?.name }
								icon={ action.icon }
								iconPosition="left"
								onClick={ ( event ) => {
									action.onClick?.( event );
									onClose();
								} }
								href={ action.href }
							>
								{ action.label }
							</MenuItem>
						) ) }
					</MenuGroup>
				) }
			</NavigableMenu>
			{ search && ! shown.length && ! actions.length && (
				<p className="cnl-plugins-menu__empty">
					{ __( 'No plugins found.' ) }
				</p>
			) }
		</div>
	);
}

/**
 * @param {Object} props
 * @param {Object} props.inventory From `usePluginInventory()`.
 * @param {Array}  props.metaBoxes The post's classic meta boxes, if any.
 * @param {string} props.surface   `canvas` or `full-screen`.
 * @return {?Element} The button, any pinned plugins beside it, or nothing
 *                    when no plugin adds anything to open.
 */
export function PluginsMenu( { inventory, metaBoxes, surface } ) {
	const activeSidebar = useActivePluginSidebar();
	const pinned = usePinnedSidebars();
	const toggleRef = useRef();
	const [ width, setWidth ] = useState( window.innerWidth );
	const previousSidebar = useRef( activeSidebar );

	useEffect( () => {
		const onResize = () => setWidth( window.innerWidth );
		window.addEventListener( 'resize', onResize );
		return () => window.removeEventListener( 'resize', onResize );
	}, [] );

	// A panel closed from inside it hands focus back to the button, rather
	// than leaving it on the page's body.
	useEffect( () => {
		const wasOpen = previousSidebar.current;
		previousSidebar.current = activeSidebar;
		if ( ! wasOpen || activeSidebar ) {
			return;
		}
		// Once core's panel has slid out, taking focus with it.
		const timer = window.setTimeout( () => {
			const focused = toggleRef.current?.ownerDocument.activeElement;
			if ( ! focused || focused === focused.ownerDocument.body ) {
				toggleRef.current?.focus();
			}
		}, 400 );
		return () => window.clearTimeout( timer );
	}, [ activeSidebar ] );

	if ( ! inventory.hasEditorUi && ! metaBoxes?.boxes?.length ) {
		return null;
	}

	const sidebars = inventory.plugins.flatMap( ( plugin ) =>
		plugin.sidebars.map( ( sidebar ) => ( { ...sidebar, plugin } ) )
	);
	const pinnedSidebars = pinned
		.map( ( id ) => sidebars.find( ( s ) => s.identifier === id ) )
		.filter( Boolean )
		.slice( 0, getPinnedLimit( width ) );
	const openPlugin = sidebars.find(
		( sidebar ) => sidebar.identifier === activeSidebar
	);

	const count = inventory.plugins.length;
	const hasUnpinnedPanel =
		!! activeSidebar &&
		! pinnedSidebars.some(
			( pinnedSidebar ) => pinnedSidebar.identifier === activeSidebar
		);

	return (
		<div className={ `cnl-plugins-menu is-${ surface }` }>
			<Dropdown
				className="cnl-plugins-menu__dropdown"
				contentClassName="cnl-plugins-menu__popover"
				popoverProps={ {
					placement: 'bottom-end',
					offset: 8,
					shift: true,
				} }
				renderToggle={ ( { isOpen, onToggle } ) => (
					<Button
						ref={ toggleRef }
						__next40pxDefaultSize
						icon={ pluginsIcon }
						label={ __( 'Plugins' ) }
						description={
							activeSidebar
								? sprintf(
										/* translators: %s: Plugin name. */
										__( '%s is open' ),
										openPlugin?.title ??
											__( 'Settings from plugins' )
									)
								: sprintf(
										/* translators: %d: Number of plugins. */
										_n(
											'%d plugin adds to the editor',
											'%d plugins add to the editor',
											count
										),
										count
									)
						}
						showTooltip
						tooltipPosition="bottom"
						aria-expanded={ isOpen }
						aria-haspopup="true"
						// Shown, not announced, while a panel is open: the
						// button opens a menu, so it says whether that is
						// open, and its description names the panel.
						className={ `cnl-plugins-menu__toggle${
							isOpen || hasUnpinnedPanel ? ' is-pressed' : ''
						}` }
						onClick={ onToggle }
					/>
				) }
				renderContent={ ( { onClose } ) => (
					<PluginsList
						inventory={ inventory }
						metaBoxes={ metaBoxes }
						onClose={ onClose }
					/>
				) }
			/>
			{ pinnedSidebars.map( ( sidebar ) => (
				<Button
					key={ sidebar.identifier }
					__next40pxDefaultSize
					className="cnl-plugins-menu__pinned"
					icon={ sidebar.icon || sidebar.plugin.icon }
					label={ sidebar.title }
					showTooltip
					tooltipPosition="bottom"
					aria-expanded={ activeSidebar === sidebar.identifier }
					isPressed={ activeSidebar === sidebar.identifier }
					onClick={ () => toggleSidebar( sidebar.identifier ) }
				/>
			) ) }
		</div>
	);
}
