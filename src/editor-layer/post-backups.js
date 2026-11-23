/**
 * The copies of a post's unsaved changes that autosaving leaves behind, and
 * throwing them away with the changes.
 *
 * Kept apart from `post-safety.jsx` so Discard can use it without loading
 * core's editor components.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { namespace } from '../settings';

/**
 * The key core's local autosave keeps a post's backup under in
 * `sessionStorage` (`@wordpress/editor`'s `store/local-autosave.js`). A post
 * not saved yet shares one key. Not an API: see `docs/editor-workarounds.md`.
 *
 * @param {number|string} postId    The post.
 * @param {boolean}       isPostNew Whether it is an auto-draft.
 * @return {string} The key.
 */
export function getLocalBackupKey( postId, isPostNew = false ) {
	return `wp-autosave-block-editor-post-${
		isPostNew ? 'auto-draft' : postId
	}`;
}

/**
 * Whether a post's ID is one the server autosaves and locks. Templates and
 * template parts have IDs made of names.
 *
 * @param {*} postId The ID.
 * @return {boolean} Whether it is a post's.
 */
export function isPostId( postId ) {
	return /^\d+$/.test( String( postId ?? '' ) ) && Number( postId ) > 0;
}

/**
 * Throw away a post's backups along with its unsaved changes, so neither is
 * offered back the next time it opens: core's backup in the browser, and the
 * user's autosave on the server.
 *
 * A draft's autosave is the draft itself, which WordPress saves in place, so
 * there is no autosave to delete.
 *
 * @param {Object}        record          The discarded record.
 * @param {string}        record.postType Its post type.
 * @param {number|string} record.postId   Its ID.
 * @param {?string}       record.status   Its saved status.
 */
export function discardPostBackups( { postType, postId, status } ) {
	if ( ! postType || ! isPostId( postId ) ) {
		return;
	}

	const removeLocalBackup = () => {
		try {
			window.sessionStorage.removeItem( getLocalBackupKey( postId ) );

			if ( status === 'auto-draft' ) {
				window.sessionStorage.removeItem(
					getLocalBackupKey( postId, true )
				);
			}
		} catch {
			// No storage, so no backup.
		}
	};

	removeLocalBackup();
	// Core queues each backup with `requestIdleCallback`, so one queued just
	// before the discard is written after it. Idle callbacks run in the order
	// they were asked for, so this one runs after it, and removes it again.
	( window.requestIdleCallback || window.setTimeout )( removeLocalBackup );

	if ( status === 'draft' || status === 'auto-draft' ) {
		return;
	}

	apiFetch( {
		method: 'DELETE',
		path: `/${ namespace }/autosave/${ postId }`,
	} ).catch( () => {
		// The changes are gone either way. An autosave left behind is only
		// offered again, never put back by itself.
	} );
}
