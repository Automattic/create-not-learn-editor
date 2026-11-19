/**
 * The end of the top bar: Publish site while the site has changes waiting,
 * a quiet "Up to date" once it has none.
 *
 * Only one save-like button shows at a time. While a page or post is open in
 * the canvas, its own Save and Publish are that button, so Publish site
 * steps back to a quiet note of how many site changes are waiting, which
 * does nothing. See `README.md`.
 *
 * Cmd+S follows the same rule: it saves the open page or post, and
 * otherwise opens Publish site.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { dispatch, select, useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { check as checkIcon, Icon } from '@wordpress/icons';
import { isKeyboardEvent } from '@wordpress/keycodes';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import {
	STORE_NAME as CANVAS_STORE,
	useOpenDocument,
} from '../site-canvas/mode';
import { PublishSiteDialog } from './publish-site-dialog';
import { useChanges } from './use-changes';

const EDITOR_STORE = 'core/editor';

/*
 * Said once a session, the first time an edit made while a page is open
 * turns out to be the site's, like its header.
 */
let hasExplainedCrossing = false;

/**
 * Tell the user, once, that an edit made on a page changes the site, so it
 * waits for Publish site rather than the page's own Save.
 *
 * @param {number}  count        Site changes waiting.
 * @param {?Object} openDocument The page or post open in the canvas.
 */
function useExplainCrossing( count, openDocument ) {
	const { createInfoNotice } = useDispatch( noticesStore );
	const previous = useRef( { count, openDocument } );

	useEffect( () => {
		const isSameDocument =
			previous.current.openDocument &&
			previous.current.openDocument === openDocument;

		if (
			! hasExplainedCrossing &&
			isSameDocument &&
			count > previous.current.count
		) {
			hasExplainedCrossing = true;
			createInfoNotice(
				__(
					'That change shows on every page, so it waits for Publish site.'
				),
				{ type: 'snackbar' }
			);
		}

		previous.current = { count, openDocument };
	}, [ count, openDocument, createInfoNotice ] );
}

/**
 * Cmd+S: save the open page or post, or open Publish site. Caught before
 * boot's own shortcut, which would open its review of every change.
 *
 * @param {Function} openDialog Opens Publish site.
 * @param {number}   count      Site changes waiting.
 */
function useSaveShortcut( openDialog, count ) {
	const latest = useRef();
	latest.current = { openDialog, count };

	useEffect( () => {
		const onKeyDown = ( event ) => {
			if ( ! isKeyboardEvent.primary( event, 's' ) ) {
				return;
			}

			event.preventDefault();
			event.stopImmediatePropagation();

			// The editor's store is only there once a canvas has loaded it.
			const editor = select( EDITOR_STORE );

			if ( editor && select( CANVAS_STORE ).getOpenDocument() ) {
				if ( editor.isEditedPostDirty() ) {
					dispatch( EDITOR_STORE ).savePost();
				}

				return;
			}

			if ( latest.current.count ) {
				latest.current.openDialog();
			}
		};

		window.addEventListener( 'keydown', onKeyDown, true );

		return () => window.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );
}

/**
 * Warn before leaving the editor while anything is unsaved: nothing is kept
 * between visits yet.
 *
 * @param {boolean} hasChanges Whether anything is unsaved.
 */
function useWarnBeforeLeaving( hasChanges ) {
	useEffect( () => {
		if ( ! hasChanges ) {
			return undefined;
		}

		const onBeforeUnload = ( event ) => {
			event.preventDefault();
			// Older browsers need a value to ask.
			event.returnValue = '';
		};

		window.addEventListener( 'beforeunload', onBeforeUnload );

		return () =>
			window.removeEventListener( 'beforeunload', onBeforeUnload );
	}, [ hasChanges ] );
}

export function PublishStatus() {
	const [ isDialogOpen, setIsDialogOpen ] = useState( false );
	const { changes, siteChanges, isSaving } = useChanges();
	const openDocument = useOpenDocument();
	const count = siteChanges.length;
	const openDialog = () => setIsDialogOpen( true );

	useExplainCrossing( count, openDocument );
	useSaveShortcut( openDialog, count );
	useWarnBeforeLeaving( changes.length > 0 );

	let control;

	if ( count && openDocument ) {
		// Only a note while a page or post is being edited: its own buttons
		// are the ones to use, and Publish site comes back on leaving it.
		control = (
			<span className="cnl-publish-status__waiting">
				{ sprintf(
					/* translators: %d: Number of site changes waiting to be published. */
					_n(
						'%d site change waiting',
						'%d site changes waiting',
						count
					),
					count
				) }
			</span>
		);
	} else if ( count || ( isSaving && ! openDocument ) ) {
		control = (
			<Button
				__next40pxDefaultSize
				className="cnl-publish-status__button"
				variant="primary"
				onClick={ openDialog }
				isBusy={ isSaving }
				disabled={ isSaving }
				accessibleWhenDisabled
			>
				{ __( 'Publish site' ) }
			</Button>
		);
	} else {
		control = (
			<span className="cnl-publish-status__up-to-date" role="status">
				<Icon icon={ checkIcon } size={ 20 } />
				{ __( 'Up to date' ) }
			</span>
		);
	}

	return (
		<div className="cnl-publish-status">
			{ control }
			{ isDialogOpen && (
				<PublishSiteDialog onClose={ () => setIsDialogOpen( false ) } />
			) }
		</div>
	);
}
