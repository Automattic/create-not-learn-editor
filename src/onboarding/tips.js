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
import { settings } from '../settings';
import { getDirtyRecords, isSiteWideChange } from '../top-bar/use-changes';
import { registerOnboardingTip } from './index';

const video = ( name ) =>
	settings.assetsUrl ? `${ settings.assetsUrl }onboarding/${ name }` : null;

export function registerOnboardingTips() {
	// The first change that shows on every page, like a colour or the menu,
	// is the first that waits for Publish rather than a page's Save. Shown
	// once they stop for a moment, or move on to another screen and leave
	// the change behind unpublished, whichever comes first.
	registerOnboardingTip( {
		id: 'publish-site-wide',
		target: '.cnl-publish',
		title: __( 'Publish your site-wide changes' ),
		description: __(
			'You have changes that apply across your entire site, and this is where you publish them.'
		),
		video: video( 'publish.mp4' ),
		placement: 'top',
		showOn: [ 'idle', 'leave' ],
		when: ( select ) => getDirtyRecords( select ).some( isSiteWideChange ),
	} );
}
