/**
 * Whether "Add page" starts with the designs to choose from, or goes straight
 * to naming a blank page. Set from the checkbox at the foot of "Add a page",
 * and turned back on in Preferences.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as Preferences, which is mounted from app init, uses it too.
 */

/**
 * WordPress dependencies
 */
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

export const ADD_PAGE_PREFERENCES_SCOPE = 'create-not-learn-editor';
export const SHOW_PAGE_DESIGNS_PREFERENCE = 'showPageDesigns';

/**
 * Show the designs unless someone has said not to.
 */
export function registerAddPagePreferences() {
	dispatch( preferencesStore ).setDefaults( ADD_PAGE_PREFERENCES_SCOPE, {
		[ SHOW_PAGE_DESIGNS_PREFERENCE ]: true,
	} );
}

/**
 * Whether "Add page" shows the designs.
 *
 * @param {Function} select `select` from `@wordpress/data`, or a `useSelect`
 *                          callback's.
 * @return {boolean} Whether it does.
 */
export function showsPageDesigns( select ) {
	return (
		select( preferencesStore ).get(
			ADD_PAGE_PREFERENCES_SCOPE,
			SHOW_PAGE_DESIGNS_PREFERENCE
		) !== false
	);
}

/**
 * Show the designs when adding a page, or stop showing them.
 *
 * @param {boolean} isShowing Whether to show them.
 */
export function setShowsPageDesigns( isShowing ) {
	dispatch( preferencesStore ).set(
		ADD_PAGE_PREFERENCES_SCOPE,
		SHOW_PAGE_DESIGNS_PREFERENCE,
		isShowing
	);
}
