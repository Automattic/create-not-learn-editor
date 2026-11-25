/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useCallback, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { cloudUpload as cloudUploadIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { ReviewChanges } from './review-changes';
import { useChanges } from './use-changes';

/**
 * Publish, at the foot of every screen beside the canvas (`Page`, in
 * `src/stage-page.jsx`): every unsaved change on the site, from any screen,
 * like a colour picked on Colors or a menu changed on Menus. Always there, so it's somewhere to look, and greyed out while
 * there's nothing to publish. It opens the review, where the changes are
 * published together or discarded one by one.
 *
 * A page being edited has its own Save, for what changed while editing it
 * (`src/edit-session.js`).
 *
 * @return {Element} Publish.
 */
export function Publish() {
	const { changes, isSaving } = useChanges();
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const closeReview = useCallback( () => setIsReviewOpen( false ), [] );
	const count = changes.length;
	const status = count
		? sprintf(
				/* translators: %d: Number of changes waiting to be published. */
				_n(
					'%d unpublished change',
					'%d unpublished changes',
					count,
					'create-not-learn-editor'
				),
				count
			)
		: __( 'Nothing to publish', 'create-not-learn-editor' );

	return (
		<>
			<Button
				__next40pxDefaultSize
				className="cnl-publish"
				variant="primary"
				icon={ cloudUploadIcon }
				onClick={ () => setIsReviewOpen( true ) }
				disabled={ ! count || isSaving }
				accessibleWhenDisabled
				isBusy={ isSaving }
				description={ status }
			>
				<span className="cnl-publish__label">
					{ isSaving
						? __( 'Publishing…', 'create-not-learn-editor' )
						: __( 'Publish', 'create-not-learn-editor' ) }
				</span>
				{ count > 0 && (
					<span className="cnl-publish__count" aria-hidden="true">
						{ count }
					</span>
				) }
			</Button>
			{ isReviewOpen && (
				<ReviewChanges onClose={ closeReview } isPublishing />
			) }
		</>
	);
}
