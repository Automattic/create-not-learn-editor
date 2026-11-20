/**
 * Tells the block toolbar which design choices the section picked has, so
 * its Layout, Colour and Width show only where there is something to
 * choose. See `src/block-toolbar/section-controls.jsx`.
 */

/**
 * Internal dependencies
 */
import { useEffect } from '../../wordpress-packages';
import { setSectionTools } from '../mode';
import { useSectionDesignViews } from './design-bar';
import { SectionToolPopover } from './section-tool-popover';

/**
 * @param {Object} props
 * @param {string} props.clientId The section picked.
 * @return {null} Nothing is drawn.
 */
function SectionTools( { clientId } ) {
	const views = useSectionDesignViews( clientId );
	const key = views.join();

	useEffect( () => {
		setSectionTools( { clientId, views: key ? key.split( ',' ) : [] } );
	}, [ clientId, key ] );

	useEffect( () => () => setSectionTools( null ), [] );

	return null;
}

/**
 * What the layer adds for a section with core's toolbar: word of its design
 * choices, and whichever of its tools is open under the toolbar.
 *
 * @param {Object}       props
 * @param {string|false} props.sectionId        The section picked, when it
 *                                              has core's toolbar.
 * @param {?Object}      props.openTool         `{ clientId, view }`, the
 *                                              tool open under it.
 * @param {Object}       props.items            The layer's row items, which
 *                                              follow a section to the
 *                                              block a new layout puts in
 *                                              its place.
 * @param {Function}     props.setPickedSection Picks that block.
 * @return {Element} The parts.
 */
export function SectionToolbarParts( {
	items,
	openTool,
	sectionId,
	setPickedSection,
} ) {
	return (
		<>
			{ sectionId && <SectionTools clientId={ sectionId } /> }
			{ openTool && (
				<SectionToolPopover
					onReplaced={ ( from, next ) => {
						items.rename( from, next.clientId );
						setPickedSection( next.clientId );
					} }
					tool={ openTool }
				/>
			) }
		</>
	);
}
