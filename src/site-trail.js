/**
 * Screens opened from the "Home" screen start their breadcrumbs with
 * "Home", so each one has a way back to where it was picked. The screens
 * stay where they live in the editor; only the trail changes, and only on
 * visits that began at "Home".
 */

/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { __, useMemo } from './wordpress-packages';

const EMPTY_ARRAY = [];

/**
 * Search params "Home" adds to the screens it opens.
 */
export const FROM_SITE_SEARCH = { from: 'site' };

const NAVIGATION_FROM = 'navigation';

/**
 * Search params the Pages screen adds to the menu it opens, so the menu leads
 * back to Pages.
 */
export const FROM_PAGES_SEARCH = { from: 'pages' };

/**
 * Search params the Menus screen adds to the edit screen it opens.
 *
 * @return {Object} Search params.
 */
export function getFromNavigationSearch() {
	return { from: NAVIGATION_FROM };
}

/**
 * The breadcrumb back to the "Home" screen.
 *
 * @return {Object} Breadcrumb item.
 */
export function getSiteCrumb() {
	return { label: __( 'Home' ), to: '/' };
}

/**
 * Search params that carry the visit's trail on to the next screen, so a
 * screen opened from one that was opened from "Home" still leads back there.
 *
 * @return {Object|undefined} `{ from }`, or undefined when the visit began
 *                            somewhere without a trail.
 */
export function useTrailSearch() {
	const { from } = useSearch( { strict: false } );

	return useMemo( () => ( from ? { from } : undefined ), [ from ] );
}

/**
 * The breadcrumbs leading back to where the visit began: "Home". Visits
 * from the Menus screen lead back there instead, since it isn't linked from
 * "Home", and menus opened from Pages lead back to Pages. Empty for visits
 * that began anywhere else.
 *
 * @return {Object[]} Breadcrumb items, to put before the screen's own.
 */
export function useSiteTrail() {
	const { from } = useSearch( { strict: false } );

	return useMemo( () => {
		if ( from === FROM_SITE_SEARCH.from ) {
			return [ getSiteCrumb() ];
		}

		if ( from === NAVIGATION_FROM ) {
			return [ { label: __( 'Menus' ), to: '/navigation' } ];
		}

		if ( from === FROM_PAGES_SEARCH.from ) {
			return [ { label: __( 'Pages' ), to: '/types/page/list/all' } ];
		}

		return EMPTY_ARRAY;
	}, [ from ] );
}
