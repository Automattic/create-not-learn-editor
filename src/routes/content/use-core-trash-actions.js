/**
 * Core's own actions for moving posts to the trash, restoring them and
 * deleting them for good, as its post lists offer them.
 *
 * Taken from the editor's post actions rather than written again, so they
 * confirm, notify and undo the way core's do.
 */

/**
 * WordPress dependencies
 */
import { useDispatch } from '@wordpress/data';
import { privateApis as editorPrivateApis } from '@wordpress/editor';
import { useCallback, useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import { coreDataStore } from '../../wordpress-packages';

const { usePostActions } = unlock( editorPrivateApis );

const TRASH_ACTION_IDS = [ 'move-to-trash', 'restore', 'permanently-delete' ];
const NO_ACTIONS = [];

/**
 * @param {?string} postType Post type, or null for none.
 * @return {Object[]} DataViews actions.
 */
export default function useCoreTrashActions( postType ) {
	const { invalidateResolutionForStoreSelector } =
		useDispatch( coreDataStore );
	// Every list of posts is out of date once one moves, so all are asked
	// for again.
	const onActionPerformed = useCallback(
		() => invalidateResolutionForStoreSelector( 'getEntityRecords' ),
		[ invalidateResolutionForStoreSelector ]
	);
	const actions = usePostActions( {
		context: 'list',
		onActionPerformed,
		postType: postType || 'post',
	} );

	return useMemo(
		() =>
			postType
				? actions.filter( ( action ) =>
						TRASH_ACTION_IDS.includes( action.id )
					)
				: NO_ACTIONS,
		[ actions, postType ]
	);
}
