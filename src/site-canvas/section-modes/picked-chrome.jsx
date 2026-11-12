/**
 * Part of the section layer, drawn over the canvas.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import { SectionTab } from './section-chrome';
import { local, placeTab } from './placement';

// The picked section, while another is pointed at: outlined and named.
export function PickedChrome( {
	drag,
	frame,
	getScope,
	getTitle,
	hangsTabBelow,
	layoutItemsById,
	layoutName,
	partsById,
	pickedId,
	rects,
	shownHoverId,
} ) {
	const rect =
		! drag &&
		pickedId &&
		pickedId !== shownHoverId &&
		frame &&
		rects[ pickedId ];

	if ( ! rect ) {
		return null;
	}

	const box = local( rect, frame );
	const isPart = Boolean( partsById[ pickedId ] );
	const Scope = getScope( pickedId );

	return (
		<Scope>
			<div className="cnl-section-modes__outline" style={ box } />
			<SectionTab
				{ ...placeTab( box, hangsTabBelow( pickedId ), frame.height ) }
				isPart={ isPart }
				layout={ layoutItemsById[ pickedId ] ? layoutName : null }
				title={ getTitle( pickedId ) }
			/>
		</Scope>
	);
}
