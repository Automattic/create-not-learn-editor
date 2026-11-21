/**
 * Where the review dialog wants plugins' pre-publish panels. The dialog is
 * its own React root, outside boot's slots, so it offers an element and the
 * plugin UI root, which is inside them, renders the slot into it.
 */

/**
 * WordPress dependencies
 */
import { useSyncExternalStore } from '@wordpress/element';

let host = null;
const listeners = new Set();

export function setPrePublishHost( element ) {
	if ( host === element ) {
		return;
	}
	host = element;
	listeners.forEach( ( listener ) => listener() );
}

export function usePrePublishHost() {
	return useSyncExternalStore(
		( listener ) => {
			listeners.add( listener );
			return () => listeners.delete( listener );
		},
		() => host
	);
}

const PUBLIC = [ 'publish', 'future' ];

/**
 * Whether saving now publishes the post open in the editor: its status was
 * changed to published or scheduled, and isn't yet.
 *
 * @param {Function} select The data registry's `select`.
 * @return {boolean} Whether it does.
 */
export function isPublishingCurrentPost( select ) {
	const editor = select( 'core/editor' );
	const postId = editor?.getCurrentPostId();
	const postType = editor?.getCurrentPostType();

	if ( ! postId || ! postType ) {
		return false;
	}

	const core = select( 'core' );
	const saved = core.getEntityRecord( 'postType', postType, postId );
	const edited = core.getEditedEntityRecord( 'postType', postType, postId );

	return (
		PUBLIC.includes( edited?.status ) && ! PUBLIC.includes( saved?.status )
	);
}

/*
 * Whether any plugin asks something before publishing, so the full-screen
 * editor's publish step, which some workspaces skip, is offered to run it.
 */
let hasPublishChecks = false;
const checkListeners = new Set();

export function setHasPluginPublishChecks( value ) {
	if ( hasPublishChecks === value ) {
		return;
	}
	hasPublishChecks = value;
	checkListeners.forEach( ( listener ) => listener() );
}

export function hasPluginPublishChecks() {
	return hasPublishChecks;
}

export function subscribePluginPublishChecks( listener ) {
	checkListeners.add( listener );
	return () => checkListeners.delete( listener );
}
