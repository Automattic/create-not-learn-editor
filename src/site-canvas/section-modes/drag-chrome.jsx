/**
 * Part of the section layer, drawn over the canvas.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { local } from './placement';

// A section being dragged: dimmed where it is, a ghost of it under the
// pointer, and a line where it would drop.
export function DragChrome( { drag, draggedBlock, frame, rects, sectionIds } ) {
	const rect = drag && frame && rects[ drag.clientId ];

	if ( ! rect ) {
		return null;
	}

	const box = local( rect, frame );
	const gapId = sectionIds[ drag.slot ];
	const lastRect = rects[ sectionIds[ sectionIds.length - 1 ] ];
	let lineTop = null;

	if ( gapId && rects[ gapId ] ) {
		lineTop = rects[ gapId ].top - frame.top;
	} else if ( lastRect ) {
		lineTop = lastRect.top + lastRect.height - frame.top;
	}

	return (
		<>
			<div className="cnl-section-modes__dragged" style={ box } />
			{ draggedBlock && (
				<div
					aria-hidden
					className="cnl-section-modes__ghost"
					style={ {
						left: drag.ghost.left,
						top: drag.ghost.top,
						width: drag.ghost.width,
					} }
				>
					<BlockPreview
						blocks={ draggedBlock }
						viewportWidth={ drag.ghost.viewportWidth }
					/>
				</div>
			) }
			{ lineTop !== null && (
				<div
					className="cnl-section-modes__drop-line"
					style={ {
						left: box.left,
						top: lineTop,
						width: box.width,
					} }
				/>
			) }
		</>
	);
}
