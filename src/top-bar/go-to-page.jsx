/**
 * Go to page: the search field in the middle of the top bar. The page finder
 * opens out of it, for moving from page to page.
 *
 * It took the place of a search that opened the command palette. The palette
 * is still there behind Cmd+K.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';

export function GoToPage() {
	return (
		<PageFinder
			className="cnl-go-to-page"
			placeholder={ __( 'Go to page…' ) }
		/>
	);
}
