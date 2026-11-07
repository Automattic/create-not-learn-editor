/**
 * Go to page: a search field look-alike in the middle of the top bar that
 * opens the page finder below it, for moving from page to page.
 *
 * It took the place of a search that opened the command palette. The palette
 * is still there behind Cmd+K.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { search } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';

export function GoToPage() {
	return (
		<PageFinder
			className="cnl-go-to-page"
			renderToggle={ ( { isOpen, onToggle } ) => (
				<button
					aria-expanded={ isOpen }
					aria-haspopup="dialog"
					className="cnl-go-to-page__toggle"
					onClick={ onToggle }
					type="button"
				>
					<Icon icon={ search } size={ 20 } />
					<span className="cnl-go-to-page__label">
						{ __( 'Go to page…' ) }
					</span>
				</button>
			) }
		/>
	);
}
