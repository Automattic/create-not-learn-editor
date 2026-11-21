/**
 * Autosaves and post locks for a post being edited, as core's post editor has
 * them. See "Autosaves and post locks" in `docs/architecture.md`.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { parse } from '@wordpress/blocks';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import {
	AutosaveMonitor,
	LocalAutosaveMonitor,
	PostLockedModal,
	store as editorStore,
} from '@wordpress/editor';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { namespace } from '../settings';
import { isPostId } from './post-backups';

// Core's post editor turns the heartbeat up to this while a post is open, so
// a takeover reaches the person taken over from quickly.
const HEARTBEAT_INTERVAL = 10;

const AUTOSAVE_NOTICE_ID = 'autosave-exists';

// Posts with an editor watching over them, so two editors open on one post
// don't both lock and autosave it.
const watched = new Set();

/**
 * Let go of a post's lock, as core's post editor does when its page unloads,
 * so the next person to open it isn't told someone is still editing it.
 *
 * @param {Object} lock                The lock.
 * @param {number} lock.postId         The post.
 * @param {string} lock.activePostLock The lock, as the server gave it.
 * @param {Object} lock.postLockUtils  The lock's nonces and URL.
 */
function releasePostLock( { postId, activePostLock, postLockUtils } ) {
	const data = new window.FormData();
	data.append( 'action', 'wp-remove-post-lock' );
	data.append( '_wpnonce', postLockUtils.unlockNonce );
	data.append( 'post_ID', postId );
	data.append( 'active_post_lock', activePostLock );

	if ( window.navigator.sendBeacon ) {
		window.navigator.sendBeacon( postLockUtils.ajaxUrl, data );
	} else {
		window
			.fetch( postLockUtils.ajaxUrl, {
				body: data,
				credentials: 'same-origin',
				method: 'POST',
			} )
			.catch( () => {} );
	}
}

/**
 * Offer the user's newer autosave of a post, as core's post editor does. Core
 * opens it in its revisions; here it is put back as unsaved changes instead,
 * as core's local backup is, to be saved or discarded with the rest.
 *
 * @param {Object} registry The data registry.
 * @param {Object} autosave The autosave's fields.
 */
function offerAutosave( registry, autosave ) {
	const { createWarningNotice, removeNotice } =
		registry.dispatch( noticesStore );

	createWarningNotice(
		__(
			'There is an autosave of this post that is more recent than the version below.'
		),
		{
			id: AUTOSAVE_NOTICE_ID,
			actions: [
				{
					label: __( 'Restore the autosave' ),
					onClick() {
						const { editPost, resetEditorBlocks } =
							registry.dispatch( editorStore );

						editPost( {
							excerpt: autosave.excerpt,
							title: autosave.title,
						} );
						resetEditorBlocks( parse( autosave.content ) );
						removeNotice( AUTOSAVE_NOTICE_ID );
					},
				},
			],
		}
	);
}

/**
 * Core's lock dialog leads out of the editor to wp-admin's list of posts.
 * Here, its Exit editor leaves editing instead.
 *
 * @param {boolean}  isLocked Whether the dialog is open.
 * @param {Function} onExit   Leaves editing.
 */
function useExitFromLockDialog( isLocked, onExit ) {
	const onExitRef = useRef( onExit );
	onExitRef.current = onExit;

	useEffect( () => {
		if ( ! isLocked ) {
			return;
		}

		const onClick = ( event ) => {
			const link = event.target.closest?.(
				'.editor-post-locked-modal a[href*="edit.php"]'
			);

			if ( link ) {
				event.preventDefault();
				onExitRef.current();
			}
		};

		document.addEventListener( 'click', onClick, true );

		return () => document.removeEventListener( 'click', onClick, true );
	}, [ isLocked ] );
}

/**
 * Lock the post, and keep it autosaved, while it is open, once the editor has
 * set it up.
 *
 * @param {Object}        props
 * @param {Function}      props.onExit   Leaves editing, from the lock dialog.
 * @param {number|string} props.postId   The post.
 * @param {string}        props.postType Its type.
 * @return {?Element} Core's autosave monitors and lock dialog.
 */
function WatchedPost( { onExit, postId, postType } ) {
	const registry = useRegistry();
	const { updateEditorSettings, updatePostLock } = useDispatch( editorStore );
	const [ safety, setSafety ] = useState( null );
	const { activePostLock, isLocked } = useSelect(
		( select ) => {
			if ( ! safety ) {
				return {};
			}

			const editor = select( editorStore );

			return {
				activePostLock: editor.getActivePostLock(),
				isLocked: editor.isPostLocked(),
			};
		},
		[ safety ]
	);
	// Read when the post closes, by which time the next one may be in the
	// editor's store.
	const lockRef = useRef( {} );
	lockRef.current = {
		activePostLock,
		isLocked,
		postId,
		postLockUtils: safety?.postLockUtils,
	};

	useEffect( () => {
		let isCurrent = true;

		apiFetch( {
			method: 'POST',
			path: `/${ namespace }/post-lock/${ postId }`,
		} )
			.then( ( response ) => {
				if ( ! isCurrent || ! response?.supported ) {
					return;
				}

				const { getEditorSettings } = registry.select( editorStore );

				updateEditorSettings( {
					// Lets core's local backup defer to the autosave, as in
					// core's post editor.
					autosave: response.autosave
						? {
								editLink: `revision.php?revision=${ response.autosave.id }`,
							}
						: undefined,
					// The block editor settings endpoint has no autosave
					// interval. One already set, as by a test, is kept.
					...( getEditorSettings().autosaveInterval === undefined && {
						autosaveInterval: response.autosaveInterval,
					} ),
					postLockUtils: response.postLockUtils,
				} );
				updatePostLock( response.postLock );
				setSafety( response );

				// Offered each time the post opens until it is restored and
				// saved, or discarded, when the server stops offering it.
				if ( response.autosave && ! response.postLock.isLocked ) {
					offerAutosave( registry, response.autosave );
				}
			} )
			.catch( () => {
				// Without a lock the post is edited as before, unguarded.
			} );

		return () => {
			isCurrent = false;
		};
	}, [ postId, postType, registry, updateEditorSettings, updatePostLock ] );

	// Faster heartbeats while the post is held, as in core's post editor.
	const isHeld = !! safety && ! isLocked;
	useEffect( () => {
		const heartbeat = window.wp?.heartbeat;

		if ( ! isHeld || ! heartbeat ) {
			return;
		}

		const previous = heartbeat.interval();
		heartbeat.interval( HEARTBEAT_INTERVAL );

		return () => heartbeat.interval( previous );
	}, [ isHeld ] );

	// Moving to another post, or out of editing, lets go of this one.
	useEffect( () => {
		return () => {
			const lock = lockRef.current;

			if (
				lock.postLockUtils &&
				! lock.isLocked &&
				lock.activePostLock
			) {
				releasePostLock( lock );
			}

			if ( lock.postLockUtils ) {
				updatePostLock( { isLocked: false } );
				registry
					.dispatch( noticesStore )
					.removeNotice( AUTOSAVE_NOTICE_ID );
			}
		};
	}, [ registry, updatePostLock ] );

	useExitFromLockDialog( !! safety && isLocked, onExit );

	if ( ! safety ) {
		return null;
	}

	return (
		<>
			{ ! isLocked && <AutosaveMonitor /> }
			{ ! isLocked && <LocalAutosaveMonitor /> }
			<PostLockedModal />
		</>
	);
}

/**
 * Autosaves and post locks for a post open for editing, as core's post editor
 * mounts them: `AutosaveMonitor` saving an autosave on the server, and
 * `LocalAutosaveMonitor` a backup in the browser, at the intervals in the
 * editor's settings, and `PostLockedModal` keeping the post's lock over the
 * heartbeat, saying when someone else has it, and offering to take it over.
 *
 * The server says which posts get them (`includes/post-safety.php`): those
 * core's post editor opens, not templates, template parts or menus.
 *
 * @param {Object}        props
 * @param {Function}      props.onExit   Leaves editing, from the lock dialog.
 * @param {number|string} props.postId   The post being edited.
 * @param {string}        props.postType Its type.
 * @return {?Element} The monitors, once the editor has set the post up.
 */
export function PostSafety( { onExit, postId, postType } ) {
	const isSetUp = useSelect(
		( select ) => {
			const editor = select( editorStore );

			return (
				editor.getCurrentPostType() === postType &&
				String( editor.getCurrentPostId() ) === String( postId )
			);
		},
		[ postId, postType ]
	);
	const key = `${ postType }:${ postId }`;
	const [ isWatching, setIsWatching ] = useState( false );

	useEffect( () => {
		if ( ! isSetUp || ! isPostId( postId ) || watched.has( key ) ) {
			return;
		}

		watched.add( key );
		setIsWatching( true );

		return () => {
			watched.delete( key );
			setIsWatching( false );
		};
	}, [ isSetUp, key, postId ] );

	return isSetUp && isWatching ? (
		<WatchedPost
			key={ key }
			onExit={ onExit }
			postId={ postId }
			postType={ postType }
		/>
	) : null;
}
