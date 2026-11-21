/**
 * Internal dependencies
 */
import { getPageTitle } from './pages/data';
import { HOMEPAGE } from './pages/homepage-state';
import { __, coreDataStore, useSelect } from '../../wordpress-packages';

/**
 * The title of the page whose Edit layout opened Layouts, to lead back to.
 *
 * @param {number|string} layoutFor The page, `HOMEPAGE`, or nothing.
 * @return {string} Its title, or an empty string.
 */
export function useLayoutForTitle( layoutFor ) {
	return useSelect(
		( select ) => {
			if ( ! layoutFor || layoutFor === HOMEPAGE ) {
				return layoutFor
					? __( 'Homepage', 'create-not-learn-editor' )
					: '';
			}

			return getPageTitle(
				select( coreDataStore ).getEditedEntityRecord(
					'postType',
					'page',
					layoutFor
				)
			);
		},
		[ layoutFor ]
	);
}
