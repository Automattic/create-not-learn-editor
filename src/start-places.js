/**
 * The places to start working on the site, as "Home" and the chat both
 * offer them, so the two name, order and describe them the same way. Each
 * says what it leads to: "Home" opens a screen, the chat asks for it.
 *
 * Imported package by package, as the chat is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	brush as brushIcon,
	home as homeIcon,
	pages as pagesIcon,
	pencil as pencilIcon,
	postList as postListIcon,
	siteLogo as siteLogoIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
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
			description: __( 'Start something new.' ),
			icon: pencilIcon,
			id: 'write',
			title: __( 'Write a post' ),
		},
		{
			description: __(
				'Pick up a draft, or change something you’ve published.'
			),
			icon: postListIcon,
			id: 'posts',
			title: __( 'Your posts' ),
		},
		{
			description: __( 'Make the first page visitors see your own.' ),
			icon: homeIcon,
			id: 'home',
			title: __( 'Your homepage' ),
		},
		{
			description: __( 'Add pages like About and Contact.' ),
			icon: pagesIcon,
			id: 'pages',
			title: __( 'Pages & menu' ),
		},
		{
			description: __( 'Name your site and add a logo.' ),
			icon: siteLogoIcon,
			id: 'identity',
			title: __( 'Name & logo' ),
		},
		{
			// Design leads with whole-site looks and links on to Colors and
			// Fonts, so one place covers both without adding to the choices.
			description: __( 'Pick the look of your whole site.' ),
			icon: brushIcon,
			id: 'style',
			title: __( 'Colors & fonts' ),
		},
		{
			// One place for both, as they work the same way, and a screen
			// beyond it to pick which.
			description: __( 'Choose the top and bottom of every page.' ),
			icon: sitePartsIcon,
			id: 'siteParts',
			title: __( 'Header & footer' ),
		},
	];
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
