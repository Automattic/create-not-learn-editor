/**
 * Lays core's block toolbar over the top of the section picked, where the
 * section's own bar used to sit, rather than above it where core puts a
 * block's toolbar: stuck to the section's top, or the canvas's while that
 * is scrolled out of view, and under a section too short to hold it.
 *
 * Core places the toolbar's popover itself, and has no setting for this, so
 * the popover's content is moved from wherever core has put it to where it
 * should be, every frame while a section has the toolbar. See
 * `docs/editor-workarounds.md`.
 */

/**
 * Internal dependencies
 */
import { useEffect, useRef } from '../../wordpress-packages';
import { INSET, local, stickyTop } from './placement';
import { ADD_SECTION_HEIGHT, BAR_GAP, SHORT_BAR_GAP } from './layer-constants';

const POPOVER =
	'.components-popover.block-editor-block-list__block-popover.is-positioned';
const TOOLBAR = '.block-editor-block-contextual-toolbar';
// Clear of "Add section" on the section's top edge.
const TOP_INSET = ADD_SECTION_HEIGHT / 2 + BAR_GAP;

/**
 * @param {Object}  props
 * @param {Object}  props.editorRef Ref to the editor's container.
 * @param {Object}  props.layerRef  Ref to the layer, which the rects are on.
 * @param {?Object} props.frame     The canvas's rect on the layer.
 * @param {Object}  props.rects     The sections' rects on the layer.
 * @param {?string} props.clientId  The section with core's toolbar, if any.
 */
export function useSectionToolbarPlace( {
	clientId,
	editorRef,
	frame,
	layerRef,
	rects,
} ) {
	const latest = useRef();

	latest.current = { frame, rect: clientId ? rects[ clientId ] : null };

	useEffect( () => {
		if ( ! clientId ) {
			return undefined;
		}

		let request;
		let moved = null;

		const place = () => {
			request = window.requestAnimationFrame( place );

			const { frame: canvas, rect } = latest.current;
			const popover = Array.from(
				editorRef.current?.ownerDocument.querySelectorAll( POPOVER ) ??
					[]
			).find( ( node ) => node.querySelector( TOOLBAR ) );
			const content = popover?.querySelector(
				'.components-popover__content'
			);
			const origin = layerRef.current?.getBoundingClientRect();

			if ( ! content || ! origin || ! canvas || ! rect ) {
				return;
			}

			// Where core has it, which moving its content doesn't change.
			const core = popover.getBoundingClientRect();
			const box = local( rect, canvas );
			const fits = box.height >= core.height + TOP_INSET * 2;
			const top = fits
				? stickyTop( box, core.height, TOP_INSET )
				: box.top + box.height + SHORT_BAR_GAP;
			const left = Math.max(
				INSET,
				Math.min( box.left + INSET, canvas.width - core.width - INSET )
			);
			const x = Math.round(
				origin.left + canvas.left + left - core.left
			);
			const y = Math.round( origin.top + canvas.top + top - core.top );

			if ( moved !== content ) {
				moved?.style.removeProperty( 'translate' );
				moved = content;
			}

			content.style.translate = `${ x }px ${ y }px`;
		};

		place();

		return () => {
			window.cancelAnimationFrame( request );
			moved?.style.removeProperty( 'translate' );
		};
	}, [ clientId, editorRef, layerRef ] );
}
