/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

const screens = {
	'/design': {
		description: __(
			'How your whole site looks. Pick a look, then fine-tune its colors and fonts.'
		),
		icon: 'dashicons-admin-appearance',
		section: __( 'Design' ),
		status: __( 'Site look' ),
		title: __( 'Design' ),
	},
	'/design/colors': {
		description: __(
			'The colors your whole site uses. Your theme provides these palettes.'
		),
		icon: 'dashicons-art',
		section: __( 'Design' ),
		status: __( 'Colors' ),
		title: __( 'Colors' ),
	},
	'/design/fonts': {
		description: __(
			'The fonts your whole site uses. Your theme provides these pairings.'
		),
		icon: 'dashicons-editor-textcolor',
		section: __( 'Design' ),
		status: __( 'Fonts' ),
		title: __( 'Fonts' ),
	},
	'/design/identity': {
		description: __(
			'Your site’s name, tagline, and logo. Shown in your header, browser tabs, and search results.'
		),
		icon: 'dashicons-id',
		section: __( 'Design' ),
		status: __( 'Site identity' ),
		title: __( 'Name & logo' ),
	},
	'/media': {
		description: __(
			'The photos, videos, and files on your site. Upload new ones here, or open one to crop it or change its details.'
		),
		icon: 'dashicons-admin-media',
		section: __( 'Site' ),
		status: __( 'Media' ),
		title: __( 'Media' ),
	},
	'/patterns': {
		description: __( 'Ready-made designs you can drop into any page.' ),
		icon: 'dashicons-layout',
		section: __( 'Advanced' ),
		status: __( 'Patterns' ),
		title: __( 'Patterns' ),
	},
	'/template-parts': {
		description: __(
			'The pieces that repeat on every page, like your header and footer. Change one and it updates everywhere. WordPress calls these template parts.'
		),
		icon: 'dashicons-schedule',
		section: __( 'Advanced' ),
		status: __( 'Template parts' ),
		title: __( 'Site parts' ),
	},
};

export function getCurrentEditorPath() {
	const path =
		new URLSearchParams( window.location.search ).get( 'p' ) || '/';

	return path.split( '?' )[ 0 ];
}

export function getStaticScreen() {
	return (
		screens[ getCurrentEditorPath() ] || {
			description: __( 'Manage site editor resources.' ),
			icon: 'dashicons-admin-generic',
			section: __( 'Editor' ),
			status: __( 'Ready' ),
			title: __( 'Editor' ),
		}
	);
}
