/**
 * Whether menus show in the editor as a thing of their own.
 *
 * People take their pages and their menu to be the same thing, and while
 * every menu is an auto menu, they are: the Pages screen, with its switches,
 * is all there is to it. So most workspaces leave the Menus screen, and the
 * ways to it, out of sight until the site has a menu set by hand, saved or
 * not. A workspace without `menusUntilSetByHand`, like Builder, always shows
 * them.
 *
 * Once shown, menus stay shown until the editor reloads, so saving a menu
 * set by hand, which leaves nothing unsaved to go by, doesn't hide them.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	getNavigationBlocksFromEditedRecord,
	isAutoMenuBlocks,
} from './routes/navigation-edit/auto-menu';
import { settings } from './settings';
import { getActiveWorkspace } from './workspaces/presets';

let hasShown = Boolean( settings.hasHandSetMenu );

/**
 * Whether an unsaved menu is set by hand.
 *
 * @param {Function} select Registry select.
 * @return {boolean} Whether one is.
 */
function hasUnsavedHandSetMenu( select ) {
	const store = select( coreStore );

	return store
		.__experimentalGetDirtyEntityRecords()
		.some( ( { kind, name, key } ) => {
			if ( kind !== 'postType' || name !== 'wp_navigation' ) {
				return false;
			}

			return ! isAutoMenuBlocks(
				getNavigationBlocksFromEditedRecord(
					store.getEditedEntityRecord( kind, name, key )
				)
			);
		} );
}

/**
 * Whether menus show, for callers outside React.
 *
 * @param {Function} select Registry select.
 * @return {boolean} Whether they do.
 */
export function areMenusShown( select ) {
	if ( ! getActiveWorkspace( select ).menusUntilSetByHand ) {
		return true;
	}

	// Set while selecting, as `useSelect` and the sidebar's subscription
	// both ask through here. It only ever turns on, so asking twice is safe.
	if ( ! hasShown && hasUnsavedHandSetMenu( select ) ) {
		hasShown = true;
	}

	return hasShown;
}

/**
 * Whether menus show.
 *
 * @return {boolean} Whether they do.
 */
export function useMenusShown() {
	return useSelect( ( select ) => areMenusShown( select ), [] );
}
