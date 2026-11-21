/**
 * The places to start working on the site, as "Home" offers them: how each
 * is named, ordered and described, and the screen it opens.
 *
 * Imported package by package, so it can be used from app init without
 * loading the editor. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	brush as brushIcon,
	home as homeIcon,
	pages as pagesIcon,
	layout as layoutIcon,
	pencil as pencilIcon,
	postList as postListIcon,
	siteLogo as siteLogoIcon,
	store as storeIcon,
	styles as stylesIcon,
	symbol as symbolIcon,
	symbolFilled as symbolFilledIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { settings } from './settings';
import sitePartsIcon from './site-parts-icon';

/**
 * Every place to start, in no particular order. Each workspace picks and
 * orders the ones that fit what its people came to do.
 *
 * @return {Object[]} `{ description, icon, id, title }` for each place.
 */
function getAllPlaces() {
	return [
		{
			description: __(
				'Start something new.',
				'create-not-learn-editor'
			),
			icon: pencilIcon,
			id: 'write',
			title: __( 'Write a post', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Pick up a draft, or change something you’ve published.',
				'create-not-learn-editor'
			),
			icon: postListIcon,
			id: 'posts',
			title: __( 'Posts', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Make the first page visitors see your own.',
				'create-not-learn-editor'
			),
			icon: homeIcon,
			id: 'home',
			title: __( 'Your homepage', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Add pages like About and Contact, and pick your menu.',
				'create-not-learn-editor'
			),
			icon: pagesIcon,
			id: 'pages',
			title: __( 'Pages', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Name your site and add a logo.',
				'create-not-learn-editor'
			),
			icon: siteLogoIcon,
			id: 'identity',
			title: __( 'Name & logo', 'create-not-learn-editor' ),
		},
		{
			// Design leads with whole-site looks and links on to Colors and
			// Fonts, so one place covers both without adding to the choices.
			description: __(
				'Pick the colors and fonts of your whole site.',
				'create-not-learn-editor'
			),
			icon: brushIcon,
			id: 'style',
			title: __( 'Design', 'create-not-learn-editor' ),
		},
		{
			// One place for both, as they work the same way, and a screen
			// beyond it to pick which.
			description: __(
				'Choose the top and bottom of every page.',
				'create-not-learn-editor'
			),
			icon: sitePartsIcon,
			id: 'siteParts',
			title: __( 'Header & footer', 'create-not-learn-editor' ),
		},
		// For people who know WordPress, so in WordPress's own words.
		{
			description: __(
				'Global styles, block styles and custom CSS.',
				'create-not-learn-editor'
			),
			icon: stylesIcon,
			id: 'globalStyles',
			title: __( 'Styles', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Lay out each kind of page.',
				'create-not-learn-editor'
			),
			icon: layoutIcon,
			id: 'templates',
			title: __( 'Templates', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Edit the areas templates share.',
				'create-not-learn-editor'
			),
			icon: symbolFilledIcon,
			id: 'templateParts',
			title: __( 'All site parts', 'create-not-learn-editor' ),
		},
		{
			description: __(
				'Synced and unsynced patterns.',
				'create-not-learn-editor'
			),
			icon: symbolIcon,
			id: 'patterns',
			title: __( 'Patterns', 'create-not-learn-editor' ),
		},
		// Only a site with a shop has one to run.
		settings.shop && {
			description: __(
				'Add what you sell and run your shop.',
				'create-not-learn-editor'
			),
			icon: storeIcon,
			id: 'shop',
			title: __( 'Your shop', 'create-not-learn-editor' ),
		},
	].filter( Boolean );
}

/**
 * The places a workspace offers, in its order and its words.
 *
 * @param {Object}   home        The workspace's `home` settings.
 * @param {string[]} home.places Place ids, in order.
 * @param {Object}   home.copy   Rewording for any of them, by id.
 * @return {Object[]} `{ description, icon, id, title }` for each place.
 */
export function getStartPlaces( { places, copy = {} } ) {
	const all = getAllPlaces();

	return places
		.map( ( id ) => all.find( ( place ) => place.id === id ) )
		.filter( Boolean )
		.map( ( place ) => ( { ...place, ...copy[ place.id ] } ) );
}
