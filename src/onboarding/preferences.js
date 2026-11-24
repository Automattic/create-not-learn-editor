/**
 * Whether the editor shows its hints at all (`./index.jsx`). Kept apart from
 * the tips, so Preferences can offer it without loading them.
 */

/**
 * WordPress dependencies
 */
import { dispatch } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_SCOPE } from '../workspaces/presets';

export const ONBOARDING_PREFERENCES_SCOPE = PREFERENCES_SCOPE;
export const SHOW_HINTS_PREFERENCE = 'showHints';

export function registerOnboardingPreferences() {
	dispatch( preferencesStore ).setDefaults( ONBOARDING_PREFERENCES_SCOPE, {
		[ SHOW_HINTS_PREFERENCE ]: true,
	} );
}

/**
 * @param {Function} select `select` from `@wordpress/data`.
 * @return {boolean} Whether the person wants hints.
 */
export function showsHints( select ) {
	return select( preferencesStore ).get(
		ONBOARDING_PREFERENCES_SCOPE,
		SHOW_HINTS_PREFERENCE
	);
}

/**
 * Turn hints on or off, from the tip or Preferences.
 *
 * @param {boolean} isShown Whether to show them.
 */
export function setShowsHints( isShown ) {
	dispatch( preferencesStore ).set(
		ONBOARDING_PREFERENCES_SCOPE,
		SHOW_HINTS_PREFERENCE,
		isShown
	);
}
