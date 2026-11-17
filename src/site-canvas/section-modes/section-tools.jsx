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

/**
 * @param {Object} props
 * @param {string} props.clientId The section picked.
 * @return {null} Nothing is drawn.
 */
export function SectionTools( { clientId } ) {
	const views = useSectionDesignViews( clientId );
	const key = views.join();

	useEffect( () => {
		setSectionTools( { clientId, views: key ? key.split( ',' ) : [] } );
	}, [ clientId, key ] );

	useEffect( () => () => setSectionTools( null ), [] );

	return null;
}
