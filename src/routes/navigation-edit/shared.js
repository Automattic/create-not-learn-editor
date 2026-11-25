/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { __ } from '../../wordpress-packages';
import { getNavigationPageTitle } from './navigation-blocks';

export const NAVIGATION_POST_TYPE = 'wp_navigation';

/*
 * Search param that opens "Add menu items" as a menu's screen opens, for
 * screens that send people there to add something to a menu.
 */
export const ADD_MENU_ITEMS_SEARCH = 'add';
export const EMPTY_ARRAY = [];

export function getMenuTitle( menu ) {
	return (
		getTitleText( menu?.title ) ||
		__( 'Navigation', 'create-not-learn-editor' )
	);
}

export function getPageTitle( page ) {
	return (
		getNavigationPageTitle( page ) ||
		__( '(no title)', 'create-not-learn-editor' )
	);
}

/**
 * A URL typed for a menu item, as a link, or why it can't be one.
 *
 * @param {string} rawUrl What was typed.
 * @return {Object} `{ href }` or `{ error }`.
 */
export function normalizeMenuItemUrl( rawUrl ) {
	const trimmed = rawUrl.trim();

	if ( ! trimmed ) {
		return { error: __( 'Enter a URL', 'create-not-learn-editor' ) };
	}

	try {
		if ( trimmed.startsWith( '#' ) ) {
			return { href: trimmed };
		}

		if (
			trimmed.startsWith( '/' ) ||
			trimmed.startsWith( './' ) ||
			trimmed.startsWith( '../' )
		) {
			const url = new URL( trimmed, 'https://example.invalid' );
			return { href: `${ url.pathname }${ url.search }${ url.hash }` };
		}

		if ( /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( trimmed ) ) {
			return { href: `mailto:${ trimmed }` };
		}

		const href = /^[a-z][a-z0-9+.-]*:/i.test( trimmed )
			? trimmed
			: `https://${ trimmed }`;
		new URL( href );
		return { href };
	} catch {
		return { error: __( 'Enter a valid URL', 'create-not-learn-editor' ) };
	}
}
