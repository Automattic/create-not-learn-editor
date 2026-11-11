/**
 * Save controls: how many changes are waiting, and a way to review them.
 *
 * Changes made across the editor are held back until the user saves them,
 * so this says how many are waiting, with Save to open the review, where
 * they are saved or discarded. Save is always there, and disabled while
 * there's nothing to save, so it's somewhere to look before there is. It sits
 * in the canvas toolbar, and replaces boot's save button at the foot of the
 * sidebar, which `style.scss` hides wherever there is a canvas toolbar.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { check } from '@wordpress/icons';
import { displayShortcut, rawShortcut } from '@wordpress/keycodes';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { ReviewChanges } from './review-changes';
import { useChanges } from './use-changes';

export function SaveControls() {
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const [ hasSaved, setHasSaved ] = useState( false );
	const { changes, isSaving } = useChanges();
	const changeCount = changes.length;
	const hasChanges = changeCount > 0;
	const closeReview = useCallback( () => setIsReviewOpen( false ), [] );
	const [ isPulsing, setIsPulsing ] = useState( false );
	const previousCount = useRef( changeCount );

	/*
	 * Save pulses each time a new change joins the list, so it catches the
	 * eye while the user is working elsewhere. More edits to a change already
	 * listed don't add to the count, so typing doesn't keep it pulsing. The
	 * class is taken off for a frame first so a pulse already running starts
	 * again.
	 */
	useEffect( () => {
		const isNewChange = changeCount > previousCount.current;
		previousCount.current = changeCount;

		if ( ! isNewChange ) {
			return;
		}

		setIsPulsing( false );
		const frame = window.requestAnimationFrame( () =>
			setIsPulsing( true )
		);

		return () => window.cancelAnimationFrame( frame );
	}, [ changeCount ] );

	/*
	 * "All changes saved" is shown once a save has cleared every change, and
	 * stays until something new is changed. A save that fails leaves the
	 * changes in place, so the bar goes back to counting them.
	 */
	useEffect( () => {
		if ( isSaving ) {
			setHasSaved( true );
		} else if ( hasChanges ) {
			setHasSaved( false );
		}
	}, [ isSaving, hasChanges ] );

	let status = null;

	if ( hasChanges ) {
		status = (
			<span className="cnl-save-controls__changes">
				<span className="cnl-save-controls__indicator" aria-hidden />
				{ sprintf(
					/* translators: %d: Number of changes waiting to be saved. */
					_n(
						'%d unsaved change',
						'%d unsaved changes',
						changeCount
					),
					changeCount
				) }
			</span>
		);
	} else if ( hasSaved ) {
		status = (
			<span className="cnl-save-controls__saved">
				<Icon icon={ check } size={ 20 } />
				{ __( 'All changes saved' ) }
			</span>
		);
	}

	return (
		<div className="cnl-save-controls">
			<div className="cnl-save-controls__status" role="status">
				{ status }
			</div>
			<Button
				variant="primary"
				size="compact"
				className={ `cnl-save-controls__button${
					isPulsing ? ' is-pulsing' : ''
				}` }
				onAnimationEnd={ () => setIsPulsing( false ) }
				onClick={ () => setIsReviewOpen( true ) }
				disabled={ isSaving || ! hasChanges }
				accessibleWhenDisabled
				isBusy={ isSaving }
				shortcut={ displayShortcut.primary( 's' ) }
				aria-keyshortcuts={ rawShortcut.primary( 's' ) }
			>
				{ isSaving ? __( 'Saving…' ) : __( 'Save' ) }
			</Button>
			{ isReviewOpen && <ReviewChanges onClose={ closeReview } /> }
		</div>
	);
}
