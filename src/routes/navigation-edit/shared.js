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
	return getTitleText( menu?.title ) || __( 'Navigation' );
}

export function getPageTitle( page ) {
	return getNavigationPageTitle( page ) || __( '(no title)' );
}
