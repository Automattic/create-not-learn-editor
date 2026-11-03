/**
 * The parts of the kinds of post that code loaded with app init needs: the
 * pattern category they're in, which kinds go without a title, whether to ask
 * what's being posted at all, and the hand-off that puts the caret in a new
 * post's first block.
 *
 * In a module of its own, so the editor layer and the pattern stamping can
 * use them without bringing the rest of `post-kinds.js`, its icons, the
 * block parser and the editor's loader, into every page.
 */

/**
 * WordPress dependencies
 */
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * The pattern category the kinds of post are in (`includes/post-kinds.php`).
 */
export const POST_KINDS_CATEGORY = 'cnl-post-kinds';

// The person's own choice whether to be asked what they're posting, set in
// Preferences (`src/preferences/`) or from the picker.
export const POST_KINDS_PREFERENCES_SCOPE = 'create-not-learn-editor';
export const ASK_POST_KIND_PREFERENCE = 'askPostKinds';

// The post formats whose posts usually go without a title, like a note.
const UNTITLED_FORMATS = [ 'aside' ];

/*
 * Set when a kind is picked and read once the editor opens, to put the
 * caret in the kind's first block rather than the title. Kept on `window`,
 * as the route that makes the post and the editor layer are built
 * separately.
 */
const FOCUS_FLAG = '__cnlEditorFocusPostKind';

/**
 * Whether a post format is one whose posts usually go without a title.
 *
 * @param {string} format Post format.
 * @return {boolean} Whether it is.
 */
export function isUntitledFormat( format ) {
	return UNTITLED_FORMATS.includes( format );
}

/**
 * Ask the editor to put the caret in the new post's first block.
 */
export function requestPostKindFocus() {
	window[ FOCUS_FLAG ] = true;
}

/**
 * Whether a kind was just picked, forgetting it once asked.
 *
 * @return {boolean} Whether the editor should put the caret in the kind's
 *                   first block.
 */
export function takePostKindFocus() {
	const isRequested = !! window[ FOCUS_FLAG ];
	delete window[ FOCUS_FLAG ];

	return isRequested;
}

/**
 * Ask what's being posted unless the person turns it off.
 */
export function registerPostKindPreferences() {
	dispatch( preferencesStore ).setDefaults( POST_KINDS_PREFERENCES_SCOPE, {
		[ ASK_POST_KIND_PREFERENCE ]: true,
	} );
}

/**
 * Whether the person wants to be asked what they're posting.
 *
 * @param {Function} select `select` from `@wordpress/data`, or a `useSelect`
 *                          callback's.
 * @return {boolean} Whether they do.
 */
export function wantsPostKindQuestion( select ) {
	return (
		select( preferencesStore ).get(
			POST_KINDS_PREFERENCES_SCOPE,
			ASK_POST_KIND_PREFERENCE
		) !== false
	);
}

/**
 * Whether writing a post asks what kind it is: when the workspace offers
 * kinds, unless the person has turned the question off.
 *
 * @param {Function} select    `select` from `@wordpress/data`, or a
 *                             `useSelect` callback's.
 * @param {Object}   workspace The active workspace.
 * @return {boolean} Whether to ask.
 */
export function isAskingPostKind( select, workspace ) {
	return !! workspace?.postKinds && wantsPostKindQuestion( select );
}

/**
 * Ask, or stop asking, what's being posted, from now on.
 *
 * @param {boolean} isAsking Whether to ask.
 */
export function setAskingPostKind( isAsking ) {
	dispatch( preferencesStore ).set(
		POST_KINDS_PREFERENCES_SCOPE,
		ASK_POST_KIND_PREFERENCE,
		isAsking
	);
}
