/**
 * A block to select once the full-screen editor opens on what it is in, as
 * when a menu's location is opened to edit and its Navigation block should be
 * the one picked.
 *
 * Kept in a data store, registered once by name, so a request from a route,
 * built separately from app init, reaches the layer, as the section picker's
 * request does (`section-picker-request.js`).
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { EDITOR_STORE } from './settings-guard';

const STORE_NAME = 'create-not-learn-editor/block-request';

// Long enough for the editor to load, short enough not to surprise someone
// who opens the same thing later another way.
const REQUEST_LIFETIME = 30000;

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer( state = null, action ) {
				return action.type === 'SET_BLOCK_REQUEST'
					? action.request
					: state;
			},
			actions: {
				setRequest: ( request ) => ( {
					request,
					type: 'SET_BLOCK_REQUEST',
				} ),
			},
			selectors: {
				getRequest: ( state ) => state,
			},
		} )
	);
}

// How long after selecting the block a cleared selection is put back.
const SETTLE_TIME = 3000;

const NO_REQUEST = {};

let expiry;

function endRequest() {
	window.clearTimeout( expiry );
	dispatch( STORE_NAME ).setRequest( null );
}

/**
 * Select a block in the editor about to open.
 *
 * The first block with the name and attributes is picked. Failing that, the
 * first with the name and none of the attributes set, as a Navigation block
 * with no menu of its own shows the site's.
 *
 * @param {Object} request            The block to select.
 * @param {string} request.postType   Type of what the editor opens.
 * @param {string} request.postId     ID of what the editor opens.
 * @param {string} request.blockName  The block's name.
 * @param {Object} request.attributes Attributes it has, such as `{ ref }`.
 */
export function requestBlockSelection( request ) {
	window.clearTimeout( expiry );
	dispatch( STORE_NAME ).setRequest( request );
	expiry = window.setTimeout( endRequest, REQUEST_LIFETIME );
}

function findRequestedBlock( selectStore, request ) {
	const { getBlockAttributes, getBlocksByName } =
		selectStore( blockEditorStore );
	const keys = Object.keys( request.attributes || {} );
	const blocks = getBlocksByName( request.blockName ).map( ( clientId ) => [
		clientId,
		getBlockAttributes( clientId ) || {},
	] );
	const match =
		blocks.find( ( [ , attributes ] ) =>
			keys.every(
				( key ) => attributes[ key ] === request.attributes[ key ]
			)
		) ||
		blocks.find( ( [ , attributes ] ) =>
			keys.every(
				( key ) =>
					attributes[ key ] === undefined ||
					attributes[ key ] === null
			)
		);

	return match?.[ 0 ] ?? null;
}

/**
 * Select the requested block once the editor has it.
 *
 * The editor can clear the selection as it finishes loading, so for a moment
 * after, a cleared selection is put back. Picking something else ends the
 * request.
 *
 * @param {boolean} isEditCanvas Whether the full-screen editor is open.
 */
export function useRequestedBlockSelection( isEditCanvas ) {
	const { clientId, selectedClientId } = useSelect(
		( selectStore ) => {
			const request = selectStore( STORE_NAME ).getRequest();
			const editor = selectStore( EDITOR_STORE );

			if (
				! isEditCanvas ||
				! request ||
				editor?.getCurrentPostType() !== request.postType ||
				String( editor.getCurrentPostId() ) !== String( request.postId )
			) {
				return NO_REQUEST;
			}

			return {
				clientId: findRequestedBlock( selectStore, request ),
				selectedClientId:
					selectStore( blockEditorStore ).getSelectedBlockClientId(),
			};
		},
		[ isEditCanvas ]
	);
	const hasSelected = useRef( false );

	useEffect( () => {
		if ( ! clientId ) {
			hasSelected.current = false;
			return;
		}

		if ( selectedClientId === clientId ) {
			return;
		}

		if ( hasSelected.current && selectedClientId ) {
			endRequest();
			return;
		}

		if ( ! hasSelected.current ) {
			hasSelected.current = true;
			window.clearTimeout( expiry );
			expiry = window.setTimeout( endRequest, SETTLE_TIME );
		}

		dispatch( blockEditorStore ).selectBlock( clientId );
	}, [ clientId, selectedClientId ] );
}
