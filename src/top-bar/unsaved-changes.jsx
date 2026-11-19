/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useCallback, useState } from '@wordpress/element';
import { _n, sprintf } from '@wordpress/i18n';
import { cloudUpload as cloudUploadIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { ReviewChanges } from './review-changes';
import { useChanges } from './use-changes';

/**
 * The site's unsaved changes, made anywhere but on a page being edited, like
 * a colour picked on Colors or a menu changed on Menus. In the sidebar,
 * above its foot, so it's in one place whatever screen is on show, and only
 * while there are some. It opens Review changes, where they're saved
 * together or discarded one by one. A page being edited has its own Save,
 * for its own changes (`src/edit-session.js`).
 *
 * @return {?Element} The button, or nothing with nothing to save.
 */
export function UnsavedChanges() {
	const { changes, isSaving } = useChanges();
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const closeReview = useCallback( () => setIsReviewOpen( false ), [] );
	const count = changes.length;

	if ( ! count && ! isReviewOpen ) {
		return null;
	}

	const label = sprintf(
		/* translators: %d: Number of changes waiting to be saved. */
		_n( '%d unsaved change', '%d unsaved changes', count ),
		count
	);

	return (
		<>
			{ count > 0 && (
				<Button
					__next40pxDefaultSize
					className="cnl-unsaved-changes"
					icon={ cloudUploadIcon }
					onClick={ () => setIsReviewOpen( true ) }
					isBusy={ isSaving }
					label={ label }
					showTooltip={ false }
				>
					<span className="cnl-unsaved-changes__count">
						{ count }
					</span>
					<span className="cnl-unsaved-changes__label">
						{ label }
					</span>
				</Button>
			) }
			{ isReviewOpen && <ReviewChanges onClose={ closeReview } /> }
		</>
	);
}
