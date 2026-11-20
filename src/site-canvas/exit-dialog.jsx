/**
 * Asked on Exit, or on leaving for another screen, when the page or post
 * open in the canvas has unsaved edits: save them, leave without them, or
 * keep editing. Only the open page or post's edits are at stake. The site's
 * changes wait for Publish site whichever is picked.
 *
 * Not a `ConfirmDialog`: that puts Cancel on the left and its confirm on the
 * right, and both dismiss. Here the left button is itself destructive, so
 * the buttons are ordinary ones, and the modal's own close (Escape, the X,
 * the overlay) means "keep editing" too.
 */

/**
 * WordPress dependencies
 */
import { store as editorStore } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	decodeEntities,
	Modal,
	sprintf,
	useSelect,
} from '../wordpress-packages';

export function ExitDialog( { isSaving, onCancel, onDiscard, onSave } ) {
	const { title, isDraft } = useSelect( ( select ) => {
		const editor = select( editorStore );

		return {
			title: editor.getEditedPostAttribute( 'title' ),
			isDraft: ! editor.isCurrentPostPublished(),
		};
	}, [] );

	return (
		<Modal
			className="cnl-site-canvas__exit-dialog"
			onRequestClose={ onCancel }
			// Dismissing stays available while saving, so a save that hangs
			// doesn't trap the user in the dialog.
			shouldCloseOnClickOutside
			size="medium"
			title={
				title
					? sprintf(
							/* translators: %s: The title of the page or post being edited. */
							__( 'Exit “%s”?' ),
							decodeEntities( title )
						)
					: __( 'Exit?' )
			}
		>
			<p className="cnl-site-canvas__exit-dialog-description">
				{ isDraft
					? __( 'You have changes that aren’t saved.' )
					: __(
							'You have changes that aren’t saved. Saving updates the live page.'
						) }
			</p>
			<div className="cnl-site-canvas__exit-dialog-actions">
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					disabled={ isSaving }
					isDestructive
					onClick={ onDiscard }
					variant="tertiary"
				>
					{ __( 'Exit without saving' ) }
				</Button>
				<div className="cnl-site-canvas__exit-dialog-end">
					<Button
						__next40pxDefaultSize
						onClick={ onCancel }
						variant="secondary"
					>
						{ __( 'Keep editing' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						accessibleWhenDisabled
						disabled={ isSaving }
						isBusy={ isSaving }
						onClick={ onSave }
						variant="primary"
					>
						{ isDraft
							? __( 'Save draft and exit' )
							: __( 'Save and exit' ) }
					</Button>
				</div>
			</div>
		</Modal>
	);
}
