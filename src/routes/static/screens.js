/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

const screens = {
	'/design': {
		description: __(
			'How your whole site looks. Pick a look, then fine-tune its colors and fonts.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-admin-appearance',
		section: __( 'Design', 'create-not-learn-editor' ),
		status: __( 'Site look', 'create-not-learn-editor' ),
		title: __( 'Design', 'create-not-learn-editor' ),
	},
	'/design/colors': {
		description: __(
			'The colors your whole site uses. Your theme provides these palettes.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-art',
		section: __( 'Design', 'create-not-learn-editor' ),
		status: __( 'Colors', 'create-not-learn-editor' ),
		title: __( 'Colors', 'create-not-learn-editor' ),
	},
	'/design/fonts': {
		description: __(
			'The fonts your whole site uses. Your theme provides these pairings.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-editor-textcolor',
		section: __( 'Design', 'create-not-learn-editor' ),
		status: __( 'Fonts', 'create-not-learn-editor' ),
		title: __( 'Fonts', 'create-not-learn-editor' ),
	},
	'/design/identity': {
		description: __(
			'Your site’s name, tagline, and logo. Shown in your header, browser tabs, and search results.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-id',
		section: __( 'Design', 'create-not-learn-editor' ),
		status: __( 'Site identity', 'create-not-learn-editor' ),
		title: __( 'Name & logo', 'create-not-learn-editor' ),
	},
	'/media': {
		description: __(
			'The photos, videos, and files on your site. Upload new ones here, or open one to crop it or change its details.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-admin-media',
		section: __( 'Site', 'create-not-learn-editor' ),
		status: __( 'Media', 'create-not-learn-editor' ),
		title: __( 'Media', 'create-not-learn-editor' ),
	},
	'/patterns': {
		description: __(
			'Ready-made designs you can drop into any page.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-layout',
		section: __( 'Advanced', 'create-not-learn-editor' ),
		status: __( 'Patterns', 'create-not-learn-editor' ),
		title: __( 'Patterns', 'create-not-learn-editor' ),
	},
	'/template-parts': {
		description: __(
			'The pieces that repeat on every page, like your header and footer. Change one and it updates everywhere. WordPress calls these template parts.',
			'create-not-learn-editor'
		),
		icon: 'dashicons-schedule',
		section: __( 'Advanced', 'create-not-learn-editor' ),
		status: __( 'Template parts', 'create-not-learn-editor' ),
		title: __( 'All site parts', 'create-not-learn-editor' ),
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
			description: __(
				'Manage site editor resources.',
				'create-not-learn-editor'
			),
			icon: 'dashicons-admin-generic',
			section: __( 'Editor', 'create-not-learn-editor' ),
			status: __( 'Ready', 'create-not-learn-editor' ),
			title: __( 'Editor', 'create-not-learn-editor' ),
		}
	);
}
