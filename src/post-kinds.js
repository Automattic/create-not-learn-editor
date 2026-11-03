/**
 * Kinds of post: what a writer picks from when they write a post, each a
 * starting point of blocks ready to fill in.
 *
 * The kinds are block patterns in the `cnl-post-kinds` category
 * (`includes/post-kinds.php`), so a theme can add its own. They come with the
 * page, in the editor's settings, so the picker can offer them as it opens
 * without waiting on every pattern the site has. A plain Post, with nothing
 * to start from, always comes first. The plugin's own kinds get an
 * icon and a post format here, so themes that show formats differently can.
 *
 * Shared by the picker and the route that makes the new post, which are
 * built separately, so this module stays small.
 */

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, resolveSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { loadEditorAssets } from '@wordpress/lazy-editor';
import {
	gallery,
	image,
	link,
	paragraph,
	pencil,
	postContent,
	quote,
	video,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	POST_KINDS_CATEGORY,
	isUntitledFormat,
	requestPostKindFocus,
	takePostKindFocus,
} from './post-kinds-base';
import { settings } from './settings';

export {
	POST_KINDS_CATEGORY,
	isUntitledFormat,
	requestPostKindFocus,
	takePostKindFocus,
};

// The kind with nothing to start from.
export const PLAIN_POST = 'post';

const PREFIX = 'create-not-learn-editor/post-kind-';

/*
 * `sketch` names the drawing the picker shows for a kind
 * (`src/pickers/post-kinds.jsx`).
 */
const KIND_DETAILS = {
	[ `${ PREFIX }note` ]: { format: 'aside', icon: paragraph, sketch: 'note' },
	[ `${ PREFIX }link` ]: { format: 'link', icon: link, sketch: 'link' },
	[ `${ PREFIX }photo` ]: { format: 'image', icon: image, sketch: 'photo' },
	[ `${ PREFIX }gallery` ]: {
		format: 'gallery',
		icon: gallery,
		sketch: 'gallery',
	},
	[ `${ PREFIX }quote` ]: { format: 'quote', icon: quote, sketch: 'quote' },
	[ `${ PREFIX }video` ]: { format: 'video', icon: video, sketch: 'video' },
};

/**
 * Every kind of post, in the order they are offered.
 *
 * @param {Object[]} patterns The kinds' patterns, `{ name, title,
 *                            description, content }`. The editor's settings
 *                            by default.
 * @return {Object[]} `{ content, description, format, icon, name, sketch,
 *                    title }`.
 */
export function getPostKinds( patterns = settings.postKinds || [] ) {
	return [
		{
			description: __( 'With a title, as long as you like' ),
			format: 'standard',
			icon: pencil,
			name: PLAIN_POST,
			sketch: 'post',
			title: __( 'Post' ),
		},
		...patterns.map( ( pattern ) => ( {
			content: pattern.content || '',
			description: pattern.description || '',
			format: 'standard',
			icon: postContent,
			name: pattern.name,
			sketch: 'post',
			title: pattern.title,
			...KIND_DETAILS[ pattern.name ],
		} ) ),
	];
}

/**
 * Start a new post from a kind: its blocks and its format, as unsaved
 * edits, so nothing is written until the post is saved.
 *
 * @param {string} postType Post type.
 * @param {number} postId   The new post's ID.
 * @param {string} name     The kind's pattern name.
 */
export async function startPostFromKind( postType, postId, name ) {
	const kind = getPostKinds().find(
		( candidate ) => candidate.name === name
	);

	if ( ! kind?.content ) {
		return;
	}

	await Promise.all( [
		// The blocks can only be read once the editor has registered them,
		// which it may not have yet when a post starts from Posts.
		loadEditorAssets(),
		// The record must be in the store before it can be edited.
		resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			postType,
			postId
		),
	] );
	dispatch( coreDataStore ).editEntityRecord(
		'postType',
		postType,
		postId,
		{
			blocks: parse( kind.content ),
			content: kind.content,
			format: kind.format,
		},
		{ undoIgnore: true }
	);
	requestPostKindFocus();
}
