/**
 * Ask for a tip from anywhere in the editor.
 *
 * Each route is bundled with its own copy of what it imports, so a route
 * importing `./index.jsx` would get a registry of its own, with no tips in
 * it. App init's copy answers this filter instead (`mountOnboarding()`), and
 * this file is small enough for any bundle to carry.
 */

/**
 * WordPress dependencies
 */
import { applyFilters } from '@wordpress/hooks';

export const REQUEST_TIP_FILTER = 'createNotLearnEditor.requestOnboardingTip';

/**
 * Ask for a tip after an action, for tips that follow something done rather
 * than a state, such as a click on the page while browsing. It shows at the
 * tip's own `showOn` moments, under the same rules as any other tip.
 *
 * @param {string} id Tip id.
 * @return {boolean} Whether the tip is showing or will show: false once it
 *                   has been seen, when hints are off, or in a workspace with
 *                   onboarding off. The caller can then do something lighter
 *                   of its own.
 */
export function requestOnboardingTip( id ) {
	return Boolean( applyFilters( REQUEST_TIP_FILTER, false, id ) );
}
