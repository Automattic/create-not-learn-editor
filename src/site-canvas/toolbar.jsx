/**
 * The site canvas toolbar's controls: Edit, which expands the canvas, undo
 * and redo while editing, stepping through pages visited in Browse, the
 * Browse switch, the View menu with the device, Zoom out for Compose, and the
 * way out to the full-screen editor.
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
	closeSmallIcon,
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
	pencilIcon,
	redoIcon,
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
 * Edit, which expands the canvas to fill the editor, and Exit, which puts it
 * back beside the sidebar and the screen. Editing is already on wherever
 * Browse isn't, so all Edit adds is the room; from Browse it edits too.
 *
 * @param {Object}   props
 * @param {boolean}  props.isExpanded Whether the canvas fills the editor.
 * @param {Function} props.onToggle   Expands the canvas or puts it back.
 * @return {Element} The button.
 */
export function ExpandButton( { isExpanded, onToggle } ) {
	return (
		<Button
			__next40pxDefaultSize
			className="cnl-site-canvas__expand-toggle"
			icon={ isExpanded ? closeSmallIcon : pencilIcon }
			label={
				isExpanded
					? __( 'Back to the sidebar' )
					: __( 'Change this page with more room' )
			}
			onClick={ onToggle }
			showTooltip
			variant={ isExpanded ? 'secondary' : 'primary' }
		>
			{ isExpanded ? __( 'Exit' ) : __( 'Edit' ) }
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
