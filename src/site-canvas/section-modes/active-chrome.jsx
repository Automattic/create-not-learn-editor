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
} from './layer-constants';

/*
 * The section in a mode: outlined, named, with Edit design's bar or the
 * bar naming the mode.
 */
export function ActiveChrome( {
	actions,
	active,
	activePart,
	chromeSize,
	enterFreeform,
	exitMode,
	frame,
	getTitle,
	isComposing,
	isWorkedOn,
	items,
	leaveCompose,
	pageTopId,
	rects,
	sectionIds,
	setChromeNode,
	setDesignView,
} ) {
	const {
		deleteSection,
		duplicateSection,
		moveSection,
		onLayoutReplace,
		zoomInTo,
	} = actions;
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
		const width = chromeSize?.width || 0;
		const index = sectionIds.indexOf( active.id );
		/*
		 * Where core's toolbar sits on a section in Edit, so it looks the
		 * same zoomed out: over the section's top, in from its left, kept
		 * on the canvas. A section too short to hold it has it outside,
		 * under it or over it, so what is picked can be seen. So does an
		 * open header or footer, so the toolbar never covers the words
		 * being changed.
		 */
		const top =
			! isPartOpen && box.height >= height + INSET * 2
				? stickyTop( box, height )
				: placeOutside( outerBox, height, frame.height, isHeader );
		const left = Math.max(
			INSET,
			Math.min( box.left + INSET, frame.width - width - INSET )
		);
		// A section's own tools, as on core's toolbar. A header or footer
		// stays where it is.
		const sectionTools = ! activePart && {
			canMoveDown: index > -1 && index < sectionIds.length - 1,
			canMoveUp: index > 0,
			onDelete: () => deleteSection( active.id ),
			onDuplicate: () => duplicateSection( active.id ),
			onMove: ( direction ) => moveSection( active.id, direction ),
			onZoomIn: isComposing
				? () => {
						exitMode();
						zoomInTo( active.id );
					}
				: undefined,
		};

		chrome = (
			<DesignBar
				{ ...sectionTools }
				clientId={ active.id }
				end={ isPartOpen && <DoneButton onDone={ exitMode } /> }
				// A section's blocks are open as they are. A header or
				// footer is still unlocked on purpose.
				onFreeform={
					activePart
						? () => {
								// For getting on with its blocks, so the
								// canvas expands to fill the editor too,
								// and stays so until its back arrow.
								expandCanvas( true );

								leaveCompose( enterFreeform );
							}
						: undefined
				}
				onReplace={ onLayoutReplace }
				onView={ setDesignView }
				part={ activePart }
				ref={ setChromeNode }
				style={ { left, top } }
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
						? __( 'Freeform', 'create-not-learn-editor' )
						: __( 'Edit content', 'create-not-learn-editor' )
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
			{ /* A section's toolbar names it, as core's does in Edit. A
			     header's or footer's tab also says it is on every page. */ }
			{ ( activePart || active.mode !== MODE_DESIGN ) && (
				<SectionTab
					{ ...tab }
					isPart={ Boolean( activePart ) }
					title={ title }
				/>
			) }
			{ chrome }
		</Scope>
	);
}
