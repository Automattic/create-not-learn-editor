/**
 * One home for plugin UI: the Plugins button, the panels it docks beside the
 * page, and plugins' publish panels in CnL's own save flow. Registered as a
 * plugin itself, so it renders inside boot's slots and can read and render
 * other plugins' fills. See `README.md`.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Button, Fill, Modal, PanelBody } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import {
	PluginDocumentSettingPanel,
	PluginPostPublishPanel,
	PluginPostStatusInfo,
	PluginPrePublishPanel,
	PluginSidebar,
	store as editorStore,
} from '@wordpress/editor';
import {
	createPortal,
	useCallback,
	useEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	pin as pinIcon,
	plugins as pluginsIcon,
	settings as settingsIcon,
} from '@wordpress/icons';
import { registerPlugin } from '@wordpress/plugins';
import { Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { useIsEditCanvas } from '../editor-layer/canvas-mode';
import { PluginsMenu } from './plugins-menu';
import {
	isPublishingCurrentPost,
	setHasPluginPublishChecks,
	usePrePublishHost,
} from './publish-host';
import {
	MAX_PINNED,
	SETTINGS_SIDEBAR,
	togglePinned,
	useActivePluginSidebar,
	usePinnedSidebars,
} from './sidebars';
import { getText } from './action-items';
import {
	OWN_PLUGIN,
	SLOTS,
	SlotProbe,
	usePluginInventory,
} from './use-plugin-inventory';

const CANVAS_HOST = '.cnl-site-canvas__plugins';

/**
 * The first element matching a selector, kept up to date as the page changes.
 *
 * @param {string} selector CSS selector.
 * @return {?Element} The element.
 */
function useElement( selector ) {
	const [ element, setElement ] = useState( () =>
		document.querySelector( selector )
	);
	useEffect( () => {
		let frame;
		const update = () => {
			frame = null;
			setElement( document.querySelector( selector ) );
		};
		const observer = new window.MutationObserver( () => {
			if ( ! frame ) {
				frame = window.requestAnimationFrame( update );
			}
		} );
		observer.observe( document.body, { childList: true, subtree: true } );
		update();
		return () => {
			observer.disconnect();
			window.cancelAnimationFrame( frame );
		};
	}, [ selector ] );
	return element;
}

/**
 * The open post's classic meta boxes, which only the full editor shows.
 *
 * @return {?Object} `{ boxes, url }`, once known.
 */
function useMetaBoxes() {
	const postId = useSelect(
		( select ) => select( editorStore ).getCurrentPostId(),
		[]
	);
	const [ result, setResult ] = useState( {} );

	useEffect( () => {
		if ( ! postId || typeof postId !== 'number' || result[ postId ] ) {
			return;
		}
		apiFetch( {
			path: `/create-not-learn-editor/v1/meta-boxes/${ postId }`,
		} )
			.then( ( data ) =>
				setResult( ( previous ) => ( {
					...previous,
					[ postId ]: data,
				} ) )
			)
			.catch( () => {} );
	}, [ postId, result ] );

	return result[ postId ] ?? null;
}

/**
 * An element before the header's close button to render the pin into,
 * added once, as moving it would take focus from the pin.
 *
 * @param {Element} header The panel's header.
 * @return {Element} The host.
 */
function getPinHost( header ) {
	let host = header.querySelector( ':scope > .cnl-plugins-menu__pin-host' );
	if ( ! host ) {
		host = document.createElement( 'span' );
		host.className = 'cnl-plugins-menu__pin-host';
		header.insertBefore( host, header.lastElementChild );
	}
	return host;
}

/**
 * Pin for the open plugin panel, in its header where core has its star,
 * which `_style.scss` hides: CnL pins to its own toolbar, at most two.
 *
 * @param {Object} props
 * @param {Object} props.inventory From `usePluginInventory()`.
 * @return {?Element} The button, portalled into the panel's header.
 */
function PinToggle( { inventory } ) {
	const active = useActivePluginSidebar();
	const pinned = usePinnedSidebars();
	const header = useElement(
		active
			? `[id="${ active.replace( '/', ':' ) }"] .interface-complementary-area-header`
			: '#cnl-no-panel'
	);
	const sidebar = inventory.plugins
		.flatMap( ( plugin ) => plugin.sidebars )
		.find( ( item ) => item.identifier === active );

	if ( ! header || ! sidebar ) {
		return null;
	}

	const isPinned = pinned.includes( active );
	const replaces =
		! isPinned && pinned.length >= MAX_PINNED
			? inventory.plugins
					.flatMap( ( plugin ) => plugin.sidebars )
					.find( ( item ) => item.identifier === pinned[ 0 ] )
			: null;

	return createPortal(
		<Button
			className="cnl-plugins-menu__pin"
			icon={ pinIcon }
			size="compact"
			isPressed={ isPinned }
			label={
				isPinned
					? __( 'Unpin from the toolbar' )
					: __( 'Pin to the toolbar' )
			}
			description={
				replaces
					? sprintf(
							/* translators: %s: Plugin name. */
							__( 'Takes the place of %s.' ),
							replaces.title
						)
					: undefined
			}
			onClick={ () => togglePinned( active ) }
		/>,
		getPinHost( header )
	);
}

/**
 * What plugins add to a page's settings, in one panel of CnL's own, docked
 * like any plugin's. Core shows these in its sidebar's Post tab, which the
 * site canvas leaves out for its page settings popover.
 *
 * @return {Element} The panel.
 */
function SettingsSidebar() {
	return (
		<PluginSidebar
			name="settings"
			title={ __( 'Settings from plugins' ) }
			icon={ settingsIcon }
			isPinnable={ false }
		>
			<PluginPostStatusInfo.Slot>
				{ ( fills ) =>
					fills.length > 0 && (
						<PanelBody className="cnl-plugins-settings__summary">
							{ fills }
						</PanelBody>
					)
				}
			</PluginPostStatusInfo.Slot>
			<PluginDocumentSettingPanel.Slot />
		</PluginSidebar>
	);
}

/**
 * Plugins' pre-publish panels, in the review dialog when saving publishes
 * the open page or post.
 *
 * @param {Object}  props
 * @param {boolean} props.hasPrePublish Whether any plugin has one.
 * @return {?Element} The panels, in the dialog's host.
 */
function PrePublishChecks( { hasPrePublish } ) {
	const host = usePrePublishHost();
	if ( ! host || ! hasPrePublish ) {
		return null;
	}
	return createPortal(
		<section className="cnl-plugins-publish">
			<Text
				className="cnl-plugins-publish__title"
				render={ <h3 /> }
				variant="heading-sm"
			>
				{ __( 'Before it’s published' ) }
			</Text>
			<div className="cnl-plugins-publish__panels">
				<PluginPrePublishPanel.Slot />
			</div>
		</section>,
		host
	);
}

/**
 * Plugins' post-publish panels, like sharing, once the site canvas has
 * published the open page or post. The full-screen editor has core's own.
 *
 * @param {Object}  props
 * @param {boolean} props.hasPostPublish Whether any plugin has one.
 * @param {boolean} props.isFullScreen   Whether the full-screen editor is on.
 * @return {?Element} The dialog.
 */
function PostPublish( { hasPostPublish, isFullScreen } ) {
	const { postId, status, link, title } = useSelect( ( select ) => {
		const editor = select( editorStore );
		return {
			postId: editor.getCurrentPostId(),
			status: editor.getCurrentPostAttribute( 'status' ),
			link: editor.getCurrentPostAttribute( 'link' ),
			title: editor.getEditedPostAttribute( 'title' ),
		};
	}, [] );
	const previous = useRef( { postId, status } );
	const [ isOpen, setIsOpen ] = useState( false );

	useEffect( () => {
		const was = previous.current;
		previous.current = { postId, status };
		if (
			was.postId === postId &&
			was.status !== status &&
			status === 'publish' &&
			hasPostPublish &&
			! isFullScreen
		) {
			setIsOpen( true );
		}
	}, [ postId, status, hasPostPublish, isFullScreen ] );

	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Published' ) }
			onRequestClose={ () => setIsOpen( false ) }
			className="cnl-plugins-post-publish"
			size="medium"
		>
			<p>
				{ sprintf(
					/* translators: %s: Page or post title. */
					__( '“%s” is live.' ),
					title
				) }{ ' ' }
				<a href={ link } target="_blank" rel="noreferrer">
					{ __( 'View it' ) }
				</a>
			</p>
			<div className="cnl-plugins-publish__panels">
				<PluginPostPublishPanel.Slot />
			</div>
		</Modal>
	);
}

/**
 * The elements a probe reads, kept while they say the same, as a slot hands
 * over new ones each time it renders.
 *
 * @return {[Array, Function]} The elements, and the probe's `onChange`.
 */
function useProbed() {
	const [ state, setState ] = useState( { key: '', elements: [] } );
	const onChange = useCallback( ( elements ) => {
		const key = elements
			.map( ( element ) =>
				[
					element?.props?.[ 'aria-controls' ],
					element?.props?.panelName,
					getText( element?.props?.children ),
					getText( element?.props?.label ),
				].join( '|' )
			)
			.join( '\n' );
		setState( ( previous ) =>
			previous.key === key ? previous : { key, elements }
		);
	}, [] );
	return [ state.elements, onChange ];
}

function PluginUiRoot() {
	const [ moreMenu, onMoreMenu ] = useProbed();
	const [ panelOptions, onPanelOptions ] = useProbed();
	const inventory = usePluginInventory( { moreMenu, panelOptions } );
	const isFullScreen = useIsEditCanvas();
	const canvasHost = useElement( CANVAS_HOST );
	const activeSidebar = useActivePluginSidebar();
	const metaBoxes = useMetaBoxes();
	const isPublishing = useSelect( isPublishingCurrentPost, [] );

	// Read by the stylesheet, which shows the editor's sidebar in the site
	// canvas while a plugin's panel is open in it.
	useEffect( () => {
		if ( activeSidebar ) {
			document.body.dataset.cnlPluginSidebar = activeSidebar;
		} else {
			delete document.body.dataset.cnlPluginSidebar;
		}
	}, [ activeSidebar ] );

	useEffect( () => {
		setHasPluginPublishChecks( inventory.hasPrePublish );
	}, [ inventory.hasPrePublish ] );

	return (
		<>
			<SlotProbe name={ SLOTS.moreMenu } onChange={ onMoreMenu } />
			<SlotProbe
				name={ SLOTS.documentPanelOption }
				onChange={ onPanelOptions }
			/>
			{ isFullScreen && (
				<Fill name="PinnedItems/core">
					<PluginsMenu
						inventory={ inventory }
						metaBoxes={ metaBoxes }
						surface="full-screen"
					/>
				</Fill>
			) }
			{ canvasHost &&
				createPortal(
					<PluginsMenu
						inventory={ inventory }
						metaBoxes={ metaBoxes }
						surface="canvas"
					/>,
					canvasHost
				) }
			<SettingsSidebar />
			<PinToggle inventory={ inventory } />
			<PrePublishChecks
				hasPrePublish={ inventory.hasPrePublish && isPublishing }
			/>
			<PostPublish
				hasPostPublish={ inventory.hasPostPublish }
				isFullScreen={ isFullScreen }
			/>
		</>
	);
}

export function registerPluginUi() {
	registerPlugin( OWN_PLUGIN, {
		icon: pluginsIcon,
		render: PluginUiRoot,
	} );
}

export { SETTINGS_SIDEBAR };
