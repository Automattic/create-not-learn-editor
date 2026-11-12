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
import { GlobalScope } from '../../global-scope';
import { __ } from '../../wordpress-packages';
import { expandCanvas } from '../expansion';
import DesignBar from './design-bar';
import {
	MODE_CONTENT,
	MODE_FREEFORM,
	MODE_DESIGN,
	DoneButton,
	ModeBar,
	SectionTab,
} from './section-chrome';
import {
	getLayoutsPerSlide,
	INSET,
	local,
	placeAtEdge,
	placeOutside,
	placeTab,
	stickyTop,
	TAB_HEIGHT,
} from './placement';
import {
	BAR_HEIGHT,
	MODE_BAR_ROOM_HEIGHT,
	MODE_BAR_ROOM_WIDTH,
	SMALL_MODE_BAR_HEIGHT,
	MODE_BAR_GAP,
	DESIGN_BAR_MIN_WIDTH,
	DESIGN_BAR_MIN_HEIGHT,
} from './layer-constants';

/*
 * The section in a mode: outlined, named, with Edit design's bar or the
 * bar naming the mode.
 */
export function ActiveChrome( {
	active,
	activePart,
	chromeSize,
	enterFreeform,
	exitMode,
	frame,
	getTitle,
	isWorkedOn,
	items,
	leaveCompose,
	onLayoutReplace,
	pageTopId,
	rects,
	setChromeNode,
	setDesignView,
} ) {
	const rect = active && rects[ active.id ];

	// A section whose blocks are reached is drawn as picked, its bar
	// kept, with nothing to leave.
	if ( ! rect || ! frame || isWorkedOn ) {
		return null;
	}

	const box = local( rect, frame );
	const title = getTitle( active.id );
	const isHeader = activePart?.area === 'header';
	const Scope = activePart ? GlobalScope : Fragment;
	const tab = placeTab( box, active.id === pageTopId, frame.height );
	// What sits outside the section keeps clear of a tab under it.
	const outerBox = tab.isBelow
		? { ...box, height: box.height + TAB_HEIGHT }
		: box;
	const removedCount = items.removed.filter(
		( entry ) => entry.ownerId === active.id
	).length;
	const restore = () => items.restore( active.id );
	let chrome = null;
	// An open header or footer has Edit design's bar, for its words and
	// pictures and its design together.
	const isPartOpen = Boolean( activePart ) && active.mode === MODE_CONTENT;

	if ( active.mode === MODE_DESIGN || isPartOpen ) {
		const height = chromeSize?.height || BAR_HEIGHT;
		/*
		 * Where the bar over the section was, its modes giving way to
		 * the design choices in the same place: at the top of the
		 * section in view, a tray opened under it kept on the canvas,
		 * moving the bar up if it has to. A section too short to hold
		 * it, with its tray, has it outside, under it or over it, so
		 * what is picked can be seen. So does an open header or footer,
		 * so the bar never covers the words being changed.
		 */
		let top;

		if ( ! isPartOpen && box.height >= height + INSET * 2 ) {
			top = stickyTop( box, height );

			if ( top < frame.height && top + height > frame.height - INSET ) {
				top = Math.max( INSET, frame.height - height - INSET );
			}
		} else {
			top = placeOutside( outerBox, height, frame.height, isHeader );
		}

		const maxWidth = Math.min(
			Math.max( DESIGN_BAR_MIN_WIDTH, box.width - INSET * 2 ),
			frame.width - INSET * 2
		);

		chrome = (
			<DesignBar
				clientId={ active.id }
				end={ isPartOpen && <DoneButton onDone={ exitMode } /> }
				onClose={ isPartOpen ? undefined : exitMode }
				onFreeform={ () => {
					// More control is for getting on with the section's
					// blocks, so the canvas expands to fill the editor
					// too, and stays so until its back arrow.
					expandCanvas( true );

					leaveCompose( enterFreeform );
				} }
				onReplace={ onLayoutReplace }
				onView={ setDesignView }
				part={ activePart }
				perSlide={ getLayoutsPerSlide( maxWidth ) }
				ref={ setChromeNode }
				style={ {
					left: box.left + box.width / 2,
					// Scrolls rather than run off the canvas.
					maxHeight: Math.max(
						DESIGN_BAR_MIN_HEIGHT,
						frame.height - Math.max( top, 0 ) - INSET
					),
					maxWidth,
					top,
				} }
				title={ title }
				view={ active.view }
			/>
		);
	} else {
		/*
		 * In a big section, in the middle of whichever of its top and
		 * bottom edges is in view, so it is easy to find. In a small
		 * one, smaller and outside it, so it never covers what is being
		 * edited: under its bottom edge while there is room on the
		 * canvas, else over its top edge. Either way, in the middle.
		 */
		const isSmall =
			box.height < MODE_BAR_ROOM_HEIGHT ||
			box.width < MODE_BAR_ROOM_WIDTH;
		const below = outerBox.top + outerBox.height + MODE_BAR_GAP;
		const above = box.top - SMALL_MODE_BAR_HEIGHT - MODE_BAR_GAP;
		let place = {
			left: box.left + box.width / 2,
			top: placeAtEdge(
				box,
				chromeSize?.height || BAR_HEIGHT,
				frame.height
			),
		};

		if ( isSmall ) {
			place = {
				...place,
				top:
					isHeader ||
					below + SMALL_MODE_BAR_HEIGHT <= frame.height ||
					above < 0
						? below
						: above,
			};
		}
		chrome = (
			<ModeBar
				isSmall={ isSmall }
				label={
					active.mode === MODE_FREEFORM
						? __( 'Freeform' )
						: __( 'Edit content' )
				}
				onDone={ exitMode }
				onRestore={ restore }
				ref={ setChromeNode }
				removedCount={ removedCount }
				style={ place }
			/>
		);
	}

	return (
		<Scope>
			<div className="cnl-section-modes__outline" style={ box } />
			<SectionTab
				{ ...tab }
				isPart={ Boolean( activePart ) }
				title={ title }
			/>
			{ chrome }
		</Scope>
	);
}
