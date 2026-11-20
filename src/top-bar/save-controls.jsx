/**
 * Save controls: how many changes are waiting, and a way to review them.
 *
 * Changes are held back until the user saves them, so Save opens the review,
 * where they are saved or discarded. In the canvas toolbar, while editing a
 * page, Save is the page's: always there, and disabled while there's nothing
 * to save. At the top right of a screen beside the canvas, it's the screen's,
 * for what it edits, and only there while some of that is unsaved
 * (`ScreenSave`).
 *
 * How many changes are waiting, or that they were all saved, is in Save's
 * tooltip and read out as it changes, rather than written beside it: the
 * toolbar is full, and its controls shouldn't move as changes come and go.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useCallback, useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { displayShortcut, rawShortcut } from '@wordpress/keycodes';

/**
 * Internal dependencies
 */
import { ReviewChanges } from './review-changes';
import { useChanges } from './use-changes';

/**
 * @param {Object}   props
 * @param {Function} props.only Only changes to records it's true for: what
 *                              a screen edits, for the Save in its header
 *                              (`src/save-scopes.js`). Without it, the page
 *                              being edited: only what changed while editing
 *                              it.
 * @return {Element} The controls.
 */
export function SaveControls( { only } ) {
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const [ hasSaved, setHasSaved ] = useState( false );
	const scope = only ? { only } : { inEditSession: true };
	const { changes, isSaving } = useChanges( scope );
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

	let status = '';

	if ( hasChanges ) {
		status = sprintf(
			/* translators: %d: Number of changes waiting to be saved. */
			_n( '%d unsaved change', '%d unsaved changes', changeCount ),
			changeCount
		);
	} else if ( hasSaved ) {
		status = __( 'All changes saved' );
	}

	return (
		<div
			className={ `cnl-save-controls${
				hasChanges ? ' has-changes' : ''
			}` }
		>
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
				description={ status || undefined }
				// Below, as the toolbar and headers are at the top.
				tooltipPosition="bottom"
				isBusy={ isSaving }
				shortcut={ displayShortcut.primary( 's' ) }
				aria-keyshortcuts={ rawShortcut.primary( 's' ) }
			>
				{ isSaving ? __( 'Saving…' ) : __( 'Save' ) }
			</Button>
			{ isReviewOpen && (
				<ReviewChanges onClose={ closeReview } { ...scope } />
			) }
		</div>
	);
}
