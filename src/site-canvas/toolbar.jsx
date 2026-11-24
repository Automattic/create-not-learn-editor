/**
 * The site canvas toolbar's controls: Edit while the page is on view, and
 * Exit beside Save while editing, undo and redo while editing, stepping
 * through pages visited while viewing, the View menu with the device and the
 * live page in a new tab, and Zoom out for Compose. The way out to the full-screen editor is in
 * the Options menu after Save.
 */

/**
 * WordPress dependencies
 */
import { store as keyboardShortcutsStore } from '@wordpress/keyboard-shortcuts';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import { rememberEditUsed } from './edit-hint';
import { openRoute } from '../open-route';
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	coreDataStore,
	desktopIcon,
	dispatch,
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
 * Edit, at the end of the toolbar while the page is only on view. It opens
 * the page to change, filling the editor, where Save and Exit take its place.
 * Using it is remembered, for the hint pointing to it (`edit-hint.jsx`).
 *
 * @param {Object}   props
 * @param {boolean}  props.isPulsing Whether it pulses, to be noticed.
 * @param {Function} props.onEdit    Starts editing.
 * @return {Element} The button.
 */
export function EditButton( { isPulsing = false, onEdit } ) {
	return (
		<Button
			__next40pxDefaultSize
			className={ `cnl-site-canvas__edit${
				isPulsing ? ' is-pulsing' : ''
			}` }
			description={ __( 'Change this page' ) }
			icon={ pencilIcon }
			onClick={ () => {
				rememberEditUsed();
				onEdit();
			} }
			variant="primary"
		>
			{ __( 'Edit' ) }
		</Button>
	);
}

/**
 * Exit, beside Save while editing. It leaves without saving: unsaved changes
 * are discarded, the page is on view again and the sidebar comes back.
 *
 * @param {Object}   props
 * @param {Function} props.onExit Stops editing.
 * @return {Element} The button.
 */
export function ExitButton( { onExit } ) {
	return (
		<Button
			__next40pxDefaultSize
			className="cnl-site-canvas__exit"
			description={ __( 'Stop editing without saving' ) }
			onClick={ onExit }
			variant="secondary"
		>
			{ __( 'Exit' ) }
		</Button>
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
 * ends, the ways to open the page somewhere else: the live page in a new tab,
 * and the full-screen editor, for anything the canvas doesn't suit.
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
 * @param {?Object}   props.editRoute   Where the full-screen editor opens
 *                                      what the canvas shows, `{ to,
 *                                      search }`, if anywhere.
 * @return {Element} The menu.
 */
export function ViewMenu( {
	device,
	isComposing,
	onChange,
	onZoomIn,
	liveUrl,
	editRoute,
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
					{ editRoute && (
						<Menu.Item
							onClick={ () =>
								openRoute( editRoute.to, editRoute.search )
							}
						>
							<Menu.ItemLabel>
								{ __( 'Open in advanced editor' ) }
							</Menu.ItemLabel>
						</Menu.Item>
					) }
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
