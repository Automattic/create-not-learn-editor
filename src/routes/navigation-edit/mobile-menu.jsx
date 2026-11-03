/**
 * The site preview's mobile menu, open as the site shows it once its menu
 * button is pressed.
 *
 * The preview is a read-only editor, so nothing in it can be pressed. Instead
 * the canvas opens the menu for whoever is looking: picking Mobile opens it,
 * and a switch in the toolbar opens and closes it.
 *
 * Core's own overlay is the Navigation block's, which only its menu button
 * opens, so the button is pressed for them. A custom overlay, the template
 * part a Navigation block can pick from WordPress 7.0, isn't drawn in the
 * editor at all: pressing the button there opens the part to edit it. So it is
 * drawn over the preview here instead, with the menu in it.
 */

/**
 * Internal dependencies
 */
import {
	BlockEditorProvider,
	BlockPreview,
	blockEditorStore,
	createPortal,
	select,
	useEditorSettings,
	useEffect,
	useMemo,
	useRegistry,
	useState,
} from '../../wordpress-packages';
import { showsNavigationMenu } from './preview-blocks';

const OPEN_BUTTON = '.wp-block-navigation__responsive-container-open';
const CLOSE_BUTTON = '.wp-block-navigation__responsive-container-close';
const CONTAINER = '.wp-block-navigation__responsive-container';

const CLOSED = {
	canOpen: false,
	frameBody: null,
	height: 0,
	overlay: '',
	width: 0,
};

/**
 * The Navigation block in the preview that shows the menu and collapses into
 * a menu button at the width it is shown at.
 *
 * @param {Document} doc          The preview's document.
 * @param {number}   navigationId The menu's ID.
 * @return {?Object} The block's element, container and attributes.
 */
function findCollapsedNavigation( doc, navigationId ) {
	const { getBlockAttributes } = select( blockEditorStore );

	for ( const element of doc.querySelectorAll(
		'.wp-block-navigation[data-block]'
	) ) {
		const attributes = getBlockAttributes( element.dataset.block );
		const container = element.querySelector( CONTAINER );

		if (
			! attributes ||
			! container ||
			! showsNavigationMenu( { attributes }, navigationId )
		) {
			continue;
		}

		// Its button only shows while the menu is closed.
		const button = element.querySelector( OPEN_BUTTON );
		const isMenuOpen = container.classList.contains( 'is-menu-open' );
		const isCollapsed =
			isMenuOpen ||
			( button &&
				doc.defaultView.getComputedStyle( button ).display !== 'none' );

		if ( isCollapsed ) {
			return { attributes, element, isMenuOpen };
		}
	}

	return null;
}

/**
 * Open or close the menu in the site preview, and say whether it has one.
 *
 * @param {Object}  props
 * @param {Object}  props.bodyRef      Ref to the element the preview is in.
 * @param {string}  props.device       The device shown, to look again when it
 *                                     changes.
 * @param {boolean} props.isEnabled    Whether the preview is on show.
 * @param {boolean} props.isOpen       Whether the menu should be open.
 * @param {number}  props.navigationId The menu's ID.
 * @return {Object} Whether the menu can be opened at this width, and, for a
 * custom overlay, its slug and where to draw it.
 */
export function usePreviewMobileMenu( {
	bodyRef,
	device,
	isEnabled,
	isOpen,
	navigationId,
} ) {
	const [ state, setState ] = useState( CLOSED );

	useEffect( () => {
		const body = bodyRef.current;

		if ( ! isEnabled || ! body ) {
			setState( CLOSED );
			return;
		}

		let watchedDocument = null;
		let frameRequest = null;
		const frameObserver = new window.MutationObserver( () => schedule() );
		const resizeObserver = new window.ResizeObserver( () => schedule() );
		const bodyObserver = new window.MutationObserver( () => schedule() );

		function sync() {
			frameRequest = null;

			const iframe = body.querySelector( 'iframe[name="editor-canvas"]' );
			const doc = iframe?.contentDocument;

			// The editor swaps its document as it loads: watch the new one.
			if ( doc?.documentElement && doc !== watchedDocument ) {
				watchedDocument = doc;
				frameObserver.disconnect();
				frameObserver.observe( doc.documentElement, {
					attributeFilter: [ 'class', 'style' ],
					attributes: true,
					childList: true,
					subtree: true,
				} );
				resizeObserver.disconnect();
				resizeObserver.observe( iframe );
				iframe.addEventListener( 'load', schedule );
			}

			const navigation =
				doc?.body && findCollapsedNavigation( doc, navigationId );

			if ( ! navigation ) {
				setState( CLOSED );
				return;
			}

			const overlay = navigation.attributes.overlay || '';

			setState( ( current ) => {
				const next = {
					canOpen: true,
					frameBody: overlay ? doc.body : null,
					height: doc.defaultView.innerHeight,
					overlay,
					width: doc.defaultView.innerWidth,
				};

				return Object.keys( next ).every(
					( key ) => next[ key ] === current[ key ]
				)
					? current
					: next;
			} );

			// A custom overlay is drawn over the preview instead.
			if ( overlay || isOpen === navigation.isMenuOpen ) {
				return;
			}

			navigation.element
				.querySelector( isOpen ? OPEN_BUTTON : CLOSE_BUTTON )
				?.click();
		}

		function schedule() {
			if ( ! frameRequest ) {
				frameRequest = window.requestAnimationFrame( sync );
			}
		}

		bodyObserver.observe( body, { childList: true, subtree: true } );
		schedule();

		return () => {
			window.cancelAnimationFrame( frameRequest );
			bodyObserver.disconnect();
			frameObserver.disconnect();
			resizeObserver.disconnect();
			body.querySelector(
				'iframe[name="editor-canvas"]'
			)?.removeEventListener( 'load', schedule );
		};
	}, [ bodyRef, device, isEnabled, isOpen, navigationId ] );

	return state;
}

// How long the preview's blocks must go unchanged to count as settled.
const QUIET_TIME = 1000;

// How long to wait for that before drawing an overlay anyway.
const SETTLE_TIMEOUT = 5000;

/**
 * Whether the site preview has finished loading: its template parts have
 * their blocks, and nothing has changed them for a moment.
 *
 * As the preview loads, core swaps the patterns in its parts for their
 * blocks, and points Navigation blocks with no menu at the site's, with
 * changes it marks as not ones to save. A block preview starting up while it
 * does can make one count as an edit, so the part shows as changed. An
 * overlay waits until the preview is done.
 *
 * @param {boolean} isEnabled Whether the preview is on show.
 * @return {boolean} Whether the preview has settled.
 */
export function usePreviewSettled( isEnabled ) {
	const registry = useRegistry();
	const [ isSettled, setIsSettled ] = useState( false );

	useEffect( () => {
		setIsSettled( false );

		if ( ! isEnabled ) {
			return;
		}

		let quiet;
		const settle = () => setIsSettled( true );
		const deadline = window.setTimeout( settle, SETTLE_TIMEOUT );
		const check = () => {
			const { getBlockCount, getBlocksByName } =
				registry.select( blockEditorStore );

			if (
				getBlocksByName( 'core/template-part' ).every(
					( clientId ) => getBlockCount( clientId ) > 0
				)
			) {
				settle();
			}
		};
		const wait = () => {
			window.clearTimeout( quiet );
			quiet = window.setTimeout( check, QUIET_TIME );
		};
		const unsubscribe = registry.subscribe( wait, blockEditorStore );

		wait();

		return () => {
			unsubscribe();
			window.clearTimeout( quiet );
			window.clearTimeout( deadline );
		};
	}, [ isEnabled, registry ] );

	return isSettled;
}

/**
 * A custom overlay, drawn over the whole of the preview's screen as the site
 * draws it, at the preview's width. Draw it once `usePreviewSettled()` says
 * the preview has loaded.
 *
 * @param {Object}      props
 * @param {Object[]}    props.blocks    The overlay's blocks, with the menu in.
 * @param {HTMLElement} props.frameBody The preview's body, to draw it in.
 * @param {number}      props.height    The preview's height, which an overlay
 *                                      fills at least, as it fills the screen.
 * @param {number}      props.width     The preview's width.
 * @return {?Element} The overlay.
 */
export function PreviewOverlay( { blocks, frameBody, height, width } ) {
	const { isReady, editorSettings } = useEditorSettings( {} );
	const settings = useMemo(
		() => ( { ...editorSettings, isPreviewMode: true } ),
		[ editorSettings ]
	);

	if ( ! isReady || ! frameBody ) {
		return null;
	}

	return createPortal(
		<div
			className="cnl-navigation-preview-overlay"
			// The preview's document doesn't have the editor's stylesheets.
			style={ {
				position: 'fixed',
				inset: 0,
				zIndex: 100000,
				overflowY: 'auto',
				background: '#fff',
			} }
		>
			<BlockEditorProvider settings={ settings }>
				<BlockPreview
					blocks={ blocks }
					minHeight={ height }
					viewportWidth={ width }
				/>
			</BlockEditorProvider>
		</div>,
		frameBody
	);
}
