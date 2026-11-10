/**
 * Zoom the editor out while the canvas is in Compose, and back in after.
 *
 * Core's zoom-out is used for its zoom alone: the canvas scaling down to fit,
 * keeping its place on the page. Core can't scale the canvas without also
 * turning on the rest of its zoom-out mode, its own section toolbars and
 * inserters, so the section layer keeps every click off the canvas to keep
 * those from ever firing, and the stylesheet hides what they draw.
 *
 * Core lays the zoomed-out page out at the width the canvas had before
 * zooming, and only scales it down to fit. The canvas is narrower than a
 * desktop screen, so on its own the page would barely shrink, and be laid out
 * as on a tablet. So the editor is widened to a desktop's width for the few
 * frames core takes to measure it, then zoomed out, then let go. Core's own
 * zoom-out works the same way the other way round: the inserter opening
 * beside it is what narrows the canvas.
 *
 * The canvas's mode decides. Should core zoom back in by itself, Compose
 * zooms it out again.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	useEffect,
	useRegistry,
} from '../../wordpress-packages';
import { getCanvasFrame } from './use-block-rects';

const ZOOMED_OUT = 'auto-scaled';

// Sets the editor to a desktop's width while core measures it.
const WIDENING_CLASS = 'is-compose-widening';

// What sits beside the canvas in the editor, like the Document Overview, and
// the property its width is handed to the widening in.
const SECONDARY_SIDEBAR = '.interface-interface-skeleton__secondary-sidebar';
const SIDEBAR_WIDTH_PROPERTY = '--cnl-compose-sidebar-width';

// Narrows the editor by a pixel, for core to measure it again once zoomed out.
const REMEASURE_CLASS = 'is-compose-remeasuring';

// Frames for core to measure the widened canvas, and to start zooming
// before it is let go.
const MEASURE_FRAMES = 3;
const RELEASE_FRAMES = 2;

let pending = [];

/**
 * Do something once Compose has zoomed the editor back in, such as select a
 * block to edit. Selecting while zoomed out would leave core's zoom-out mode
 * to decide what to do with it.
 *
 * @param {Function} callback Called with the registry.
 */
export function afterZoomIn( callback ) {
	pending.push( callback );
}

// Core's class on the canvas's page while it animates the zoom.
const ANIMATING_CLASS = 'zoom-out-animation';

// Frames to wait for core to start animating, with motion reduced, before
// taking it that it won't.
const ANIMATION_START_FRAMES = 10;

/**
 * Do something once core has finished animating the zoom, such as scroll to
 * a block. Core sets the canvas's scroll as the animation ends, so a scroll
 * before then is lost.
 *
 * @param {Object}   editorRef Ref to the editor's container.
 * @param {Function} callback  Called once the canvas is still.
 */
export function whenZoomSettles( editorRef, callback ) {
	let frames = 0;
	let hasStarted = false;

	const tick = () => {
		const doc = getCanvasFrame( editorRef.current )?.contentDocument;
		const isAnimating =
			!! doc?.documentElement.classList.contains( ANIMATING_CLASS );

		hasStarted ||= isAnimating;

		if (
			isAnimating ||
			( ! hasStarted && frames++ < ANIMATION_START_FRAMES )
		) {
			window.requestAnimationFrame( tick );
			return;
		}

		callback();
	};

	window.requestAnimationFrame( tick );
}

/**
 * @param {boolean} isComposing Whether the canvas is in Compose.
 * @param {Object}  editorRef   Ref to the editor's container.
 */
export function useComposeZoom( isComposing, editorRef ) {
	const registry = useRegistry();

	useEffect( () => {
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const selectors = unlock( registry.select( blockEditorStore ) );

		if ( ! isComposing ) {
			if ( selectors.isZoomOut() ) {
				actions.resetZoomLevel();
			}

			const callbacks = pending;
			pending = [];
			callbacks.forEach( ( callback ) => callback( registry ) );

			return undefined;
		}

		/*
		 * Nothing stays selected or entered: core's zoom-out would pick the
		 * section around a selected block and draw its own toolbar over it.
		 * The layer takes the selection over instead.
		 */
		actions.stopEditingContentOnlySection();
		actions.clearSelectedBlock();

		let isCancelled = false;
		let isZoomed = false;
		let request;
		let widened = null;
		let remeasured = null;

		const zoomOut = () => {
			if ( selectors.getZoomLevel() !== ZOOMED_OUT ) {
				actions.setZoomLevel( ZOOMED_OUT );
			}
		};
		const whenReady = ( isReady, then ) => {
			const tick = () => {
				if ( isCancelled ) {
					return;
				}

				if ( isReady() ) {
					then();
				} else {
					request = window.requestAnimationFrame( tick );
				}
			};

			tick();
		};
		const afterFrames = ( count, then ) => {
			let left = count;

			whenReady( () => left-- <= 0, then );
		};

		/*
		 * Core works its scale out as the zoom starts, for the widened
		 * editor, and puts that one back as the zoom ends. Where the canvas
		 * is let go narrower than core's widest zoomed-out page, as with the
		 * Document Overview open beside it, that scale is too big for it and
		 * the page is cut off. A resize once the zoom has settled has core
		 * work it out again, for the canvas as it is.
		 */
		const remeasure = () => {
			if ( isCancelled || ! editorRef.current ) {
				return;
			}

			remeasured = editorRef.current;
			remeasured.classList.add( REMEASURE_CLASS );
			afterFrames( RELEASE_FRAMES, () =>
				remeasured.classList.remove( REMEASURE_CLASS )
			);
		};

		// Zoomed out already, by a canvas before this one, core has no
		// unzoomed width to start from.
		if ( selectors.isZoomOut() ) {
			actions.resetZoomLevel();
		}

		whenReady(
			() => getCanvasFrame( editorRef.current )?.contentDocument?.body,
			() => {
				widened = editorRef.current;
				// The page gets a desktop's width beside the Document
				// Overview, when it is open, too.
				widened.style.setProperty(
					SIDEBAR_WIDTH_PROPERTY,
					`${
						widened
							.querySelector( SECONDARY_SIDEBAR )
							?.getBoundingClientRect().width || 0
					}px`
				);
				widened.classList.add( WIDENING_CLASS );
				afterFrames( MEASURE_FRAMES, () => {
					isZoomed = true;
					zoomOut();
					afterFrames( RELEASE_FRAMES, () => {
						widened.classList.remove( WIDENING_CLASS );
						whenZoomSettles( editorRef, remeasure );
					} );
				} );
			}
		);

		const unsubscribe = registry.subscribe( () => {
			if ( isZoomed ) {
				zoomOut();
			}
		}, blockEditorStore );

		return () => {
			isCancelled = true;
			window.cancelAnimationFrame( request );
			widened?.classList.remove( WIDENING_CLASS );
			remeasured?.classList.remove( REMEASURE_CLASS );
			unsubscribe();
		};
	}, [ editorRef, isComposing, registry ] );

	// The zoom is the block editor's, shared by every editor. Leaving the
	// canvas mid-Compose mustn't leave the full-screen editor zoomed out.
	useEffect(
		() => () => {
			if ( unlock( registry.select( blockEditorStore ) ).isZoomOut() ) {
				unlock(
					registry.dispatch( blockEditorStore )
				).resetZoomLevel();
			}

			pending = [];
		},
		[ registry ]
	);
}
