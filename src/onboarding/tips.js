/**
 * The editor's tips. Each is registered once from app init and shown once
 * ever (see `./index.jsx`).
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getDirtyRecords, isSiteWideChange } from '../top-bar/use-changes';
import { registerOnboardingTip } from './index';
import { EDIT_TIP } from './tip-ids';

export function registerOnboardingTips() {
	// The first change that shows on every page, like a colour or the menu,
	// is the first that waits for Publish rather than a page's Save. Shown
	// once they stop for a moment, or move on to another screen and leave
	// the change behind unpublished, whichever comes first.
	registerOnboardingTip( {
		id: 'publish-site-wide',
		target: '.cnl-publish',
		title: __(
			'Publish your site-wide changes',
			'create-not-learn-editor'
		),
		description: __(
			'You have changes that apply across your entire site, and this is where you publish them.',
			'create-not-learn-editor'
		),
		placement: 'top',
		showOn: [ 'idle', 'leave' ],
		when: ( select ) => getDirtyRecords( select ).some( isSiteWideChange ),
	} );

	// A click on the page's words or pictures while browsing, as if to change
	// them, asks for this (`src/site-canvas/edit-hint.js`), so it answers the
	// click straight away. Once seen, the click pulses Edit instead.
	registerOnboardingTip( {
		id: EDIT_TIP,
		target: '.cnl-site-canvas__edit',
		title: __( 'Want to change something?', 'create-not-learn-editor' ),
		description: __(
			'You’re looking around your site. Click Edit to change its words and pictures.',
			'create-not-learn-editor'
		),
		placement: 'bottom-end',
		showOn: [ 'now' ],
	} );
}
