/**
 * Part of the section layer, drawn over the canvas.
 */

/**
 * WordPress dependencies
 */
import { Fragment } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { EditorPreview } from '../../editor-layer/section-picker';
import { InlineSectionPicker } from '../../section-picker';
import { INSET, local } from './placement';
import {
	INLINE_ADD_GAP,
	INLINE_ADD_HEIGHT,
	INLINE_ADD_MIN_WIDTH,
} from './layer-constants';

/*
 * The picker for adding a section in place, in its gap: under the
 * section before it, or over the one after it at the top of the page.
 * As wide as the sections, but never so narrow, zoomed out, that its
 * cards can't be made out. The gap itself is marked out behind it, edge
 * to edge and square, as the place the section will take.
 */
export function InlineAdd( {
	frame,
	inlineAdd,
	inlineAddActions,
	inlineAddHeight,
	inlineAddPlace,
	rects,
	sectionIds,
	setInlineAddNode,
} ) {
	const neighbour = inlineAddPlace && rects[ inlineAddPlace.clientId ];

	if ( ! neighbour || ! frame ) {
		return null;
	}

	const previous = rects[ sectionIds[ inlineAdd.index - 1 ] ];
	const box = local( neighbour, frame );
	const height = inlineAddHeight ?? INLINE_ADD_HEIGHT;
	const top = previous
		? previous.top - frame.top + previous.height + INLINE_ADD_GAP
		: box.top - INLINE_ADD_GAP - height;
	const width = Math.min(
		frame.width - INSET * 2,
		Math.max( box.width - INSET * 2, INLINE_ADD_MIN_WIDTH )
	);
	const left = Math.max(
		INSET,
		Math.min(
			box.left + ( box.width - width ) / 2,
			frame.width - INSET - width
		)
	);

	const slotLeft = Math.min( box.left, left - INSET );
	const slotRight = Math.max( box.left + box.width, left + width + INSET );

	return (
		<Fragment key={ inlineAdd.index }>
			<div
				className="cnl-section-modes__inline-add-slot"
				style={ {
					height: height + INLINE_ADD_GAP * 2,
					left: slotLeft,
					top: top - INLINE_ADD_GAP,
					width: slotRight - slotLeft,
				} }
			/>
			<div
				className="cnl-section-modes__inline-add"
				ref={ setInlineAddNode }
				style={ { left, top, width } }
			>
				<InlineSectionPicker
					{ ...inlineAddActions }
					Preview={ EditorPreview }
				/>
			</div>
		</Fragment>
	);
}
