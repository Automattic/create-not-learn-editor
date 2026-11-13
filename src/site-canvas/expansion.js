/**
 * Expanding the site canvas to fill the editor, and putting it back.
 *
 * The canvas's Edit button expands it, and so does a section's More
 * control, as both are for getting on with changing the page. Whether it is
 * expanded is kept in the mode's store (`mode.js`), and published on the body
 * for the stylesheet, which hides the sidebar and the screen beside the
 * canvas (`src/styles/_stage.scss`).
 */

/**
 * Internal dependencies
 */
import { useEffect } from '../wordpress-packages';
import { setCanvasExpanded, useIsCanvasExpanded } from './mode';

const EXPANDED_CLASS = 'cnl-canvas-is-expanded';
const TRANSITION_CLASS = 'cnl-canvas-is-transitioning';

/**
 * Change the page's shape as a view transition where the browser can, so
 * the canvas grows into the room rather than jumping to it.
 *
 * @param {() => void} update Changes the shape.
 */
function withTransition( update ) {
	if (
		! document.startViewTransition ||
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ||
		document.activeViewTransition
	) {
		update();
		return;
	}

	// Timed by `src/styles/_stage.scss` while the class is on.
	const root = document.documentElement;
	root.classList.add( TRANSITION_CLASS );

	const transition = document.startViewTransition( update );
	transition.ready.catch( () => {} );
	transition.finished.finally( () =>
		root.classList.remove( TRANSITION_CLASS )
	);
}

/**
 * Expand the canvas, or put it back beside the sidebar and the screen,
 * animated. Does nothing if it is already that way.
 *
 * @param {boolean} next Whether to expand it.
 */
export function expandCanvas( next ) {
	if ( next === document.body.classList.contains( EXPANDED_CLASS ) ) {
		setCanvasExpanded( next );
		return;
	}

	withTransition( () => {
		setCanvasExpanded( next );
		// Applied at once, so the transition's after picture has it.
		document.body.classList.toggle( EXPANDED_CLASS, next );
	} );
}

/**
 * Whether the canvas fills the editor, kept on the body for the stylesheet.
 * Leaving the canvas puts it back, so no screen is left without its sidebar.
 *
 * @return {boolean} Whether the canvas is expanded.
 */
export function useCanvasExpansion() {
	const isExpanded = useIsCanvasExpanded();

	useEffect( () => {
		document.body.classList.toggle( EXPANDED_CLASS, isExpanded );
	}, [ isExpanded ] );

	useEffect(
		() => () => {
			document.body.classList.remove( EXPANDED_CLASS );
			setCanvasExpanded( false );
		},
		[]
	);

	return isExpanded;
}
