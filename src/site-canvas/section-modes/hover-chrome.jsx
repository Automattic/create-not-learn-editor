/**
 * Part of the section layer, drawn over the canvas.
 */

/**
 * WordPress dependencies
 */
import { plus as plusIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { __, blockEditorStore, Button } from '../../wordpress-packages';
import {
	HoverBar,
	MODE_CONTENT,
	MODE_ZOOM_IN,
	SectionTab,
} from './section-chrome';
import { INSET, local, placeTab, stickyTop } from './placement';
import {
	BAR_HEIGHT,
	NARROW_WIDTH,
	BAR_ROW_GAP,
	ADD_SECTION_HEIGHT,
	BAR_GAP,
	SHORT_BAR_GAP,
} from './layer-constants';

/*
 * The section pointed at: tinted, named, its "Add section" buttons and its
 * bar.
 */
export function HoverChrome( {
	active,
	addItem,
	deleteSection,
	drag,
	editPosts,
	enterMode,
	frame,
	getMembers,
	getScope,
	getTitle,
	hangsTabBelow,
	hold,
	hoverPosts,
	inlineAdd,
	isComposing,
	isTextSection,
	layoutItemsById,
	layoutName,
	leaveCompose,
	menuOpenFor,
	moveSection,
	openInlineAdd,
	partsById,
	pickedId,
	rects,
	registry,
	release,
	sectionIds,
	setMenuOpenFor,
	shownHoverId,
	zoomInTo,
} ) {
	const rect = ! drag && shownHoverId && rects[ shownHoverId ];

	if ( ! rect || ! frame ) {
		return null;
	}

	const box = local( rect, frame );
	const isPart = Boolean( partsById[ shownHoverId ] );
	const isLayoutItem = Boolean( layoutItemsById[ shownHoverId ] );
	const isText = isTextSection( shownHoverId );
	const index = sectionIds.indexOf( shownHoverId );
	const title = getTitle( shownHoverId );
	/*
	 * A narrow section has the modes on a row of their own. A section
	 * too short for that, or for the bar at all, has a compact bar, its
	 * modes as icons, under it, clear of "Add section" on its bottom
	 * edge: a click goes into the section, so the bar mustn't cover
	 * what would be clicked.
	 */
	// A header's or footer's bar is one button, a row however narrow.
	const isNarrow = ! isPart && box.width < NARROW_WIDTH;
	const showsAddSection =
		! isPart && ! isLayoutItem && ! active && ! inlineAdd;
	// A layout item has nothing to change but its words or picture,
	// reached by clicking, so it has a bar only zoomed out, to zoom in.
	const showsBar = ! isLayoutItem || isComposing;
	// Clear of the "Add section" buttons on its edges, where they show.
	const barInset = showsAddSection ? ADD_SECTION_HEIGHT / 2 + BAR_GAP : INSET;
	/*
	 * A header or footer has Edit header or Edit footer alone, in the
	 * middle of the part in view, as nothing in it is reached by a
	 * click.
	 */
	const isCompact =
		! isPart &&
		box.height <
			( isNarrow ? BAR_HEIGHT * 2 + BAR_ROW_GAP : BAR_HEIGHT ) +
				barInset * 2;
	const barHeight =
		isNarrow && ! isCompact ? BAR_HEIGHT * 2 + BAR_ROW_GAP : BAR_HEIGHT;
	let barTop = isCompact
		? box.top + box.height + SHORT_BAR_GAP
		: stickyTop( box, barHeight, barInset );

	if ( isPart ) {
		const shownTop = Math.max( box.top, 0 );
		const shownBottom = Math.min( box.top + box.height, frame.height );

		barTop = ( shownTop + shownBottom - barHeight ) / 2;
	}
	const holdHover = {
		onBlur: release,
		onFocus: () => hold( shownHoverId ),
		onPointerEnter: () => hold( shownHoverId ),
		onPointerLeave: release,
	};

	const Scope = getScope( shownHoverId );

	// Remade for each section pointed at, so it fades in afresh.
	return (
		<div className="cnl-section-modes__hover" key={ shownHoverId }>
			<Scope>
				{ /* Tinted while pointed at, as a click picks it; only
				outlined once picked, as a click goes into it. */ }
				<div
					className={ `cnl-section-modes__tint${
						shownHoverId === pickedId && menuOpenFor !== pickedId
							? ' is-picked'
							: ''
					}` }
					style={ box }
				/>
				<SectionTab
					{ ...placeTab(
						box,
						hangsTabBelow( shownHoverId ),
						frame.height
					) }
					isPart={ isPart }
					layout={ isLayoutItem ? layoutName : null }
					title={ title }
				/>
				<div { ...holdHover }>
					{ showsAddSection &&
						[
							[ box.top, index ],
							[ box.top + box.height, index + 1 ],
						].map( ( [ top, at ] ) => (
							<Button
								className="cnl-section-modes__add-section"
								icon={ plusIcon }
								key={ at }
								onClick={ () => openInlineAdd( at ) }
								size="compact"
								style={ {
									left: box.left + box.width / 2,
									top,
								} }
								variant="primary"
							>
								{ __( 'Add section' ) }
							</Button>
						) ) }
					{ showsBar && (
						<HoverBar
							canMoveDown={ index < sectionIds.length - 1 }
							canMoveUp={ index > 0 }
							isCompact={ isCompact }
							isComposing={ isComposing }
							isLayoutItem={ isLayoutItem }
							isNarrow={ isNarrow && ! isCompact }
							isPart={ isPart }
							isText={ isText }
							onAdd={ ( type ) =>
								leaveCompose( () =>
									addItem( shownHoverId, type )
								)
							}
							onDelete={ () => deleteSection( shownHoverId ) }
							onDuplicate={ () =>
								registry
									.dispatch( blockEditorStore )
									.duplicateBlocks(
										getMembers( shownHoverId ),
										false
									)
							}
							onMenuToggle={ ( isMenuOpen ) =>
								setMenuOpenFor(
									isMenuOpen ? shownHoverId : null
								)
							}
							onMode={ ( mode ) => {
								if ( mode === MODE_ZOOM_IN ) {
									zoomInTo( shownHoverId );
								} else if ( mode === MODE_CONTENT ) {
									leaveCompose( () =>
										enterMode( shownHoverId, mode )
									);
								} else {
									enterMode( shownHoverId, mode );
								}
							} }
							onMove={ ( direction ) =>
								moveSection( shownHoverId, direction )
							}
							clientId={ shownHoverId }
							onManagePosts={ () =>
								editPosts( shownHoverId, hoverPosts )
							}
							posts={ hoverPosts }
							style={ {
								left: box.left + INSET,
								top: barTop,
								width: box.width - INSET * 2,
							} }
							title={ title }
						/>
					) }
				</div>
			</Scope>
		</div>
	);
}
