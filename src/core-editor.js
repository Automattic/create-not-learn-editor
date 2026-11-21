/**
 * Falling back to core's editor, for a post this editor can't edit in full:
 * one whose edit screen has meta boxes from a plugin, or whose post type
 * uses the classic editor. The server decides for each post type
 * (`coreEditor`, `includes/core-editor.php`), and a post can say otherwise
 * on its REST record (`cnl_use_core_editor`). See "Falling back to core's
 * editor" in `docs/architecture.md`.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * so the WebMCP tools can ask it without loading every package.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { resolveSelect, select } from '@wordpress/data';
import { addQueryArgs } from '@wordpress/url';

/**
 * Internal dependencies
 */
import { getEditablePostType, settings } from './settings';

export const USE_CORE_EDITOR_FIELD = 'cnl_use_core_editor';

// Read by the server to say on arrival why core's editor opened.
const REASON_ARG = 'cnl-editor-opened';

export const REASON_CLASSIC = 'classic';
export const REASON_META_BOXES = 'meta-boxes';

/**
 * Why a post opens in core's editor, if it does.
 *
 * @param {Object}  type   Post type data from the editor's settings.
 * @param {?Object} record The post's REST record, if there is one yet.
 * @return {?string} `REASON_CLASSIC` or `REASON_META_BOXES`, or `null` when
 *                   it opens in this editor.
 */
export function getCoreEditorReason( type, record ) {
	if ( ! type ) {
		return null;
	}

	if ( type.coreEditor === REASON_CLASSIC ) {
		return REASON_CLASSIC;
	}

	const override = record?.[ USE_CORE_EDITOR_FIELD ];
	if ( typeof override === 'boolean' ) {
		return override ? REASON_META_BOXES : null;
	}

	return type.coreEditor === REASON_META_BOXES ? REASON_META_BOXES : null;
}

function getAdminUrl( file, args ) {
	const adminUrl = settings.adminUrl || '/wp-admin/';

	return addQueryArgs( adminUrl.replace( /\/?$/, '/' ) + file, args );
}

/**
 * Where core's editor opens a post, if it opens there.
 *
 * @param {string}  postType Post type name.
 * @param {number}  postId   Post ID.
 * @param {?Object} record   The post's REST record, if known.
 * @return {?string} The URL, or `null` when it opens in this editor.
 */
export function getCoreEditorUrl( postType, postId, record ) {
	const reason = getCoreEditorReason(
		getEditablePostType( postType ),
		record
	);

	if ( ! reason || ! postId ) {
		return null;
	}

	return getAdminUrl( 'post.php', {
		post: postId,
		action: 'edit',
		[ REASON_ARG ]: reason,
	} );
}

/**
 * Where core's editor starts a new post of a type, if it starts there.
 *
 * @param {string} postType Post type name.
 * @return {?string} The URL, or `null` when it starts in this editor.
 */
export function getCoreEditorNewUrl( postType ) {
	const reason = getCoreEditorReason( getEditablePostType( postType ) );

	if ( ! reason ) {
		return null;
	}

	return getAdminUrl( 'post-new.php', {
		post_type: postType,
		[ REASON_ARG ]: reason,
	} );
}

/**
 * Whether a post type is one of the site's content types, the only ones
 * that can fall back. Templates, menus and patterns always open here.
 *
 * @param {string} postType Post type name.
 * @return {boolean} Whether it is.
 */
function isContentType( postType ) {
	return ( settings.postTypes || [] ).some(
		( type ) => type.name === postType
	);
}

/**
 * Where core's editor opens a post, from what the store has now.
 *
 * @param {Function} registrySelect `select`, as `useSelect` gives it.
 * @param {string}   postType       Post type name.
 * @param {number}   postId         Post ID.
 * @return {?string|undefined} The URL, `null` when it opens in this editor,
 *                             or `undefined` while its record loads.
 */
export function selectCoreEditorUrl( registrySelect, postType, postId ) {
	if ( ! postType || ! postId || ! isContentType( postType ) ) {
		return null;
	}

	const type = getEditablePostType( postType );
	if ( type?.coreEditor === REASON_CLASSIC ) {
		return getCoreEditorUrl( postType, postId );
	}

	const store = registrySelect( coreDataStore );
	const query = [ 'postType', postType, postId, { context: 'edit' } ];
	const record = store.getEntityRecord( ...query );

	if (
		! record &&
		! store.hasFinishedResolution( 'getEntityRecord', query )
	) {
		return undefined;
	}

	return getCoreEditorUrl( postType, postId, record );
}

/**
 * Where core's editor opens a post, once its record has loaded.
 *
 * @param {string} postType Post type name.
 * @param {number} postId   Post ID.
 * @return {Promise<?string>} The URL, or `null` when it opens in this editor.
 */
export async function resolveCoreEditorUrl( postType, postId ) {
	if ( ! isContentType( postType ) ) {
		return null;
	}

	try {
		await resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			postType,
			postId,
			{ context: 'edit' }
		);
	} catch {
		// Without its record, the post type's answer.
		return getCoreEditorUrl( postType, postId );
	}

	return selectCoreEditorUrl( select, postType, postId );
}

/**
 * Leave for core's editor, in the same tab.
 *
 * @param {string}  url             Where to go.
 * @param {Object}  options
 * @param {boolean} options.replace Replace this entry in the history, for
 *                                  an address that would only send the
 *                                  person on again if they came back to it.
 */
export function openCoreEditor( url, { replace = false } = {} ) {
	if ( replace ) {
		window.location.replace( url );
	} else {
		window.location.assign( url );
	}
}

/**
 * Whether anything is changed and not yet saved, which leaving for core's
 * editor would lose.
 *
 * @return {boolean} Whether there is.
 */
export function hasUnsavedChanges() {
	return (
		select( coreDataStore ).__experimentalGetDirtyEntityRecords().length > 0
	);
}
