/**
 * The site canvas toolbar's controls: Edit, which expands the canvas, undo
 * and redo while editing, stepping through pages visited in Browse, the
 * Browse switch, the View menu with the device and the live page in a new
 * tab, and Zoom out for Compose. The way out to the full-screen editor is in
 * the Options menu after Save.
 */

/**
 * WordPress dependencies
 */
import { Tooltip as ComponentsTooltip } from '@wordpress/components';
import { store as keyboardShortcutsStore } from '@wordpress/keyboard-shortcuts';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	coreDataStore,
	desktopIcon,
	dispatch,
	fullscreenExitIcon,
	displayShortcut,
	isRTL,
	listViewIcon,
	Menu,
	mobileIcon,
	pencilIcon,
	redoIcon,
	select as selectFromStore,
	squareIcon,
	tabletIcon,
	ToggleControl,
	undoIcon,
	useDispatch,
	useSelect,
} from '../wordpress-packages';

const EDITOR_STORE = 'core/editor';

const DEVICE_ICONS = {
	desktop: desktopIcon,
	mobile: mobileIcon,
	tablet: tabletIcon,
};

function getDeviceOptions() {
	return [
		{
			description: __( 'How it looks on a computer.' ),
			label: __( 'Desktop' ),
			value: 'desktop',
		},
		{
			description: __( 'How it looks on a tablet.' ),
			label: __( 'Tablet' ),
			value: 'tablet',
		},
		{
			description: __( 'How it looks on a phone.' ),
			label: __( 'Mobile' ),
			value: 'mobile',
		},
	];
}

/**
 * Edit, which expands the canvas to fill the editor, and then a back arrow,
 * which puts it back beside the sidebar and the screen, as the back arrow of
 * boot's full-screen editor leaves that. In Browse it is Collapse instead, with
 * the arrows of leaving full screen, as a back arrow beside Browse's own back
 * and forward would read as one more step through the site's pages. Editing
 * is already on wherever Browse isn't, so all Edit adds is the room; from
 * Browse it edits too.
 *
 * @param {Object}   props
 * @param {boolean}  props.isBrowsing Whether Browse is on.
 * @param {boolean}  props.isExpanded Whether the canvas fills the editor.
 * @param {Function} props.onToggle   Expands the canvas or puts it back.
 * @return {Element} The button.
 */
export function ExpandButton( { isBrowsing, isExpanded, onToggle } ) {
	if ( isExpanded ) {
		let backIcon = isRTL() ? chevronRightIcon : chevronLeftIcon;
		if ( isBrowsing ) {
			backIcon = fullscreenExitIcon;
		}

		return (
			<Button
				__next40pxDefaultSize
				className="cnl-site-canvas__expand-toggle is-back"
				icon={ backIcon }
				label={ isBrowsing ? __( 'Collapse' ) : __( 'Back' ) }
				onClick={ onToggle }
				showTooltip
			/>
		);
	}

	return (
		<Button
			__next40pxDefaultSize
			className="cnl-site-canvas__expand-toggle"
			// Named by the word on it, so it can be asked for by that word,
			// as voice control does. What it does is its description, and
			// its tooltip.
			description={ __( 'Change this page with more room' ) }
			icon={ pencilIcon }
			label={ __( 'Edit' ) }
			onClick={ onToggle }
			showTooltip
			variant="primary"
		>
			{ __( 'Edit' ) }
		</Button>
	);
}

/**
 * Browse, a switch beside the device: on, the canvas shows the saved site
 * as visitors see it, with links to follow; off, the page is open to change.
 * Compose is editing too, so Browse is off while it is on. Controlled, so a
 * switch the canvas holds back, to ask about unsaved changes first, leaves
 * it where it was.
 *
 * @param {Object}   props
 * @param {boolean}  props.canEdit    Whether what is on show can be edited.
 *                                    Browse can't be turned off without.
 * @param {boolean}  props.isBrowsing Whether Browse is on.
 * @param {Function} props.onChange   Called with whether to browse.
 * @return {Element} The switch.
 */
export function BrowseToggle( { canEdit, isBrowsing, onChange } ) {
	return (
		<ComponentsTooltip
			placement="bottom"
			text={ __( 'View your site as visitors see it' ) }
		>
			<div className="cnl-site-canvas__browse-toggle">
				<ToggleControl
					__nextHasNoMarginBottom
					checked={ isBrowsing }
					disabled={ isBrowsing && ! canEdit }
					label={ __( 'Browse' ) }
					onChange={ onChange }
				/>
			</div>
		</ComponentsTooltip>
	);
}

/**
 * Undo and redo, as in the editor's own header. The history is core's, so
 * changes made in Edit and in Compose are stepped through alike.
 *
 * @return {Element} The buttons.
 */
export function EditHistory() {
	const { hasRedo, hasUndo } = useSelect(
		( select ) => ( {
			hasRedo: select( coreDataStore ).hasRedo(),
			hasUndo: select( coreDataStore ).hasUndo(),
		} ),
		[]
	);
	const { redo, undo } = useDispatch( coreDataStore );

	return (
		<HistoryGroup
			label={ __( 'Edit history' ) }
			back={ {
				disabled: ! hasUndo,
				icon: isRTL() ? redoIcon : undoIcon,
				label: __( 'Undo' ),
				onClick: undo,
				shortcut: displayShortcut.primary( 'z' ),
			} }
			forward={ {
				disabled: ! hasRedo,
				icon: isRTL() ? undoIcon : redoIcon,
				label: __( 'Redo' ),
				onClick: redo,
				shortcut: displayShortcut.primaryShift( 'z' ),
			} }
		/>
	);
}

/**
 * Close Document Overview's list, if it is open.
 */
export function closeDocumentOverview() {
	if ( selectFromStore( EDITOR_STORE )?.isListViewOpened?.() ) {
		dispatch( EDITOR_STORE ).setIsListViewOpened( false );
	}
}

/**
 * Document Overview, core's own toggle for its list view, as its editor's
 * header has it after undo and redo. The list opens in the editor's own
 * sidebar, at the canvas's left.
 *
 * The open state is core's, so the full-screen editor and the canvas share it,
 * as core's editors do. The canvas only offers it while expanded, and closes
 * the list with `closeDocumentOverview` when it goes back.
 *
 * @return {Element} The button.
 */
export function DocumentOverviewToggle() {
	const { isOpen, shortcut, toggleRef } = useSelect( ( select ) => {
		const editor = select( EDITOR_STORE );

		return {
			isOpen: Boolean( editor?.isListViewOpened?.() ),
			shortcut: select(
				keyboardShortcutsStore
			).getShortcutRepresentation( 'core/editor/toggle-list-view' ),
			// Core hands focus back here when the list is closed from inside.
			toggleRef: editor && unlock( editor ).getListViewToggleRef?.(),
		};
	}, [] );
	return (
		<Button
			__next40pxDefaultSize
			aria-expanded={ isOpen }
			className="cnl-site-canvas__document-overview-toggle"
			icon={ listViewIcon }
			isPressed={ isOpen }
			label={ __( 'Document Overview' ) }
			onClick={ () =>
				dispatch( EDITOR_STORE )?.setIsListViewOpened?.( ! isOpen )
			}
			ref={ toggleRef }
			shortcut={ shortcut }
			showTooltip
		/>
	);
}

/**
 * The device the page is shown on, in a menu as core's editor has it. The
 * button shows the device's icon. Below the devices, as core's preview menu
 * ends, the live page opens in a new tab.
 *
 * Compose lays the page out as on a desktop, so it shows Desktop picked, and
 * picking a device zooms back in, as core resets its zoom on a device change.
 *
 * @param {Object}    props
 * @param {string}    props.device      The device picked.
 * @param {boolean}   props.isComposing Whether Compose is on.
 * @param {Function}  props.onChange    Called with the device picked.
 * @param {?Function} props.onZoomIn    Zooms back in to Edit.
 * @param {string}    props.liveUrl     The live page's URL. Empty when there
 *                                      isn't one.
 * @return {Element} The menu.
 */
export function ViewMenu( {
	device,
	isComposing,
	onChange,
	onZoomIn,
	liveUrl,
} ) {
	const shown = isComposing ? 'desktop' : device;

	return (
		<Menu.Root modal={ false }>
			<Menu.Trigger
				render={
					<Button
						__next40pxDefaultSize
						className="cnl-site-canvas__view-menu-toggle"
						icon={ DEVICE_ICONS[ shown ] }
						label={ __( 'View' ) }
						showTooltip
					/>
				}
			/>
			<Menu.Popup positioner={ <Menu.Positioner align="end" /> }>
				<Menu.RadioGroup
					value={ shown }
					onValueChange={ ( value ) => {
						onChange( value );

						if ( isComposing ) {
							onZoomIn?.();
						}
					} }
				>
					<Menu.Group>
						{ getDeviceOptions().map( ( option ) => (
							<Menu.RadioItem
								key={ option.value }
								value={ option.value }
							>
								<Menu.ItemLabel>
									{ option.label }
								</Menu.ItemLabel>
								<Menu.ItemDescription>
									{ option.description }
								</Menu.ItemDescription>
							</Menu.RadioItem>
						) ) }
					</Menu.Group>
				</Menu.RadioGroup>
				<Menu.Separator />
				<Menu.Group>
					<Menu.Item
						disabled={ ! liveUrl }
						onClick={ () =>
							window.open( liveUrl, '_blank', 'noreferrer' )
						}
					>
						<Menu.ItemLabel>
							{ __( 'Open in a new tab' ) }
						</Menu.ItemLabel>
					</Menu.Item>
				</Menu.Group>
			</Menu.Popup>
		</Menu.Root>
	);
}

/**
 * Zoom out, which is Compose: core's own toggle, beside the View menu, and
 * pressed while it is on. Offered while editing a page with sections.
 *
 * @param {Object}   props
 * @param {boolean}  props.isComposing Whether Compose is on.
 * @param {Function} props.onToggle    Turns Compose on or off.
 * @return {Element} The button.
 */
export function ZoomOutToggle( { isComposing, onToggle } ) {
	return (
		<Button
			__next40pxDefaultSize
			className="cnl-site-canvas__zoom-out-toggle"
			icon={ squareIcon }
			isPressed={ isComposing }
			label={ __( 'Zoom out' ) }
			onClick={ onToggle }
			showTooltip
		/>
	);
}

function HistoryGroup( { label, back, forward } ) {
	return (
		<div
			aria-label={ label }
			className="cnl-editor-homepage-toolbar__history"
			role="group"
		>
			{ [ back, forward ].map( ( button ) => (
				<Button
					accessibleWhenDisabled
					className="cnl-editor-homepage-toolbar__history-button"
					disabled={ button.disabled }
					icon={ button.icon }
					key={ button.label }
					label={ button.label }
					onClick={ button.onClick }
					shortcut={ button.shortcut }
					showTooltip
					variant="tertiary"
				/>
			) ) }
		</div>
	);
}

/**
 * Step back and forward through the pages visited in the preview.
 *
 * @param {Object}   props
 * @param {Object}   props.history `{ canGoBack, canGoForward }`.
 * @param {Function} props.onMove  Called with `back` or `forward`.
 * @return {Element} The buttons.
 */
export function PreviewHistory( { history, onMove } ) {
	return (
		<HistoryGroup
			label={ __( 'Preview history' ) }
			back={ {
				disabled: ! history.canGoBack,
				icon: chevronLeftIcon,
				label: __( 'Back in preview' ),
				onClick: () => onMove( 'back' ),
			} }
			forward={ {
				disabled: ! history.canGoForward,
				icon: chevronRightIcon,
				label: __( 'Forward in preview' ),
				onClick: () => onMove( 'forward' ),
			} }
		/>
	);
}
