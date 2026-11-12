/**
 * Internal dependencies
 */
import { useStyleOverride } from '../wordpress-packages';

/**
 * Keep styles in the editor's canvas while they are wanted. Core's block
 * editor holds them as a style override and renders them in the canvas
 * itself, so they come back whenever the editor makes its canvas anew.
 *
 * Call it in the editor's registry, as the site canvas and its layers are.
 *
 * @param {string}  id  The override's ID, one per caller.
 * @param {?string} css The styles, or nothing for none.
 */
export function useCanvasStyles( id, css ) {
	useStyleOverride( { id, css: css || undefined } );
}
