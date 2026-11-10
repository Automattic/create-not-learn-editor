/**
 * The site canvas toolbar's controls: Browse or Edit, undo and redo while
 * editing, stepping through pages visited in Browse, the View menu with the
 * device, Zoom out for Compose, and the way out to the full-screen editor.
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
	codeIcon,
	coreDataStore,
	desktopIcon,
	dispatch,
	displayShortcut,
	externalIcon,
	isRTL,
	listViewIcon,
	Menu,
	mobileIcon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	redoIcon,
	squareIcon,
	tabletIcon,
	ToggleGroupControl,
	ToggleGroupControlOption,
	undoIcon,
	useDispatch,
	useSelect,
} from '../wordpress-packages';
import { MODE_BROWSE, MODE_EDIT } from './mode';

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
 * Look at the site or change it: Browse or Edit.
 *
 * Compose is editing from further away, so it isn't a choice here; while it
 * is on, the toggle stays on Edit. Controlled, so a switch the canvas holds
 * back, to ask about unsaved changes first, leaves it where it was.
 *
 * @param {Object}   props
 * @param {boolean}  props.canEdit  Whether what is on show can be edited.
 * @param {string}   props.mode     The current mode.
 * @param {Function} props.onChange Called with the mode picked.
 * @return {Element} The toggle.
 */
export function ModeToggle( { canEdit, mode, onChange } ) {
	return (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			className="cnl-site-canvas__mode-toggle"
			hideLabelFromVision
			label={ __( 'Mode' ) }
			onChange={ onChange }
			value={ mode === MODE_BROWSE ? MODE_BROWSE : MODE_EDIT }
		>
			{ /* A word or two on what each does, beyond its name. */ }
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'View your site' ) }
			>
				<ToggleGroupControlOption
					label={ __( 'Browse' ) }
					value={ MODE_BROWSE }
				/>
			</ComponentsTooltip>
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'Change this page' ) }
			>
				<ToggleGroupControlOption
					disabled={ ! canEdit }
					label={ __( 'Edit' ) }
					value={ MODE_EDIT }
				/>
			</ComponentsTooltip>
		</ToggleGroupControl>
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
 * Document Overview, core's own toggle for its list view, as its editor's
 * header has it after undo and redo. The list opens in the editor's own
 * sidebar, at the canvas's left.
 *
 * The open state is core's, so the full-screen editor and the canvas share it,
 * as core's editors do.
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
 * button shows the device's icon.
 *
 * Compose lays the page out as on a desktop, so it shows Desktop picked, and
 * picking a device zooms back in, as core resets its zoom on a device change.
 *
 * @param {Object}    props
 * @param {string}    props.device      The device picked.
 * @param {boolean}   props.isComposing Whether Compose is on.
 * @param {Function}  props.onChange    Called with the device picked.
 * @param {?Function} props.onZoomIn    Zooms back in to Edit.
 * @return {Element} The menu.
 */
export function ViewMenu( { device, isComposing, onChange, onZoomIn } ) {
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

/**
 * Less common ways to view the canvas, tucked behind a menu so the toolbar's
 * everyday controls keep the room.
 *
 * @param {Object}    props
 * @param {string}    props.liveUrl      The live site's URL, to open in a new
 *                                       tab. Empty when there isn't one.
 * @param {?Function} props.onOpenEditor Opens the page on show in the
 *                                       full-screen editor, for changes the
 *                                       canvas doesn't suit. Missing when
 *                                       there is nothing to open.
 * @return {Element} The menu.
 */
export function CanvasMoreMenu( { liveUrl, onOpenEditor } ) {
	return (
		<DropdownMenu
			className="cnl-site-canvas__more-menu"
			icon={ moreVerticalIcon }
			label={ __( 'More options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ {
				className: 'cnl-site-canvas__more-menu-toggle',
				showTooltip: true,
			} }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						disabled={ ! onOpenEditor }
						icon={ codeIcon }
						onClick={ () => {
							onClose();
							onOpenEditor();
						} }
					>
						{ __( 'Open in advanced editor' ) }
					</MenuItem>
					<MenuItem
						disabled={ ! liveUrl }
						href={ liveUrl || undefined }
						icon={ externalIcon }
						onClick={ onClose }
						rel="noreferrer"
						target="_blank"
					>
						{ __( 'Open in a new tab' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
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
