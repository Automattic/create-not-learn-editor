/**
 * Whether a block is placed by the layout a page is shown in, like its title
 * or featured image, rather than being the page's own.
 *
 * The page can change what such a block shows, its words or picture, but not
 * how it looks: that is the layout's, and a change to it would change every
 * page that uses the layout. A header's or footer's blocks are opened on
 * purpose, to change them everywhere, so they aren't counted.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';

const EDITOR_STORE = 'core/editor';

/**
 * @param {string} clientId The block.
 * @return {boolean} Whether the page's layout places it.
 */
export function useIsPlacedByLayout( clientId ) {
	return useSelect(
		( select ) => {
			if (
				select( EDITOR_STORE )?.getRenderingMode?.() !==
				'template-locked'
			) {
				return false;
			}

			const { getBlockName, getBlockParentsByBlockName } =
				select( blockEditorStore );

			return (
				getBlockName( clientId ) !== 'core/template-part' &&
				getBlockParentsByBlockName( clientId, [
					'core/post-content',
					'core/template-part',
				] ).length === 0
			);
		},
		[ clientId ]
	);
}
