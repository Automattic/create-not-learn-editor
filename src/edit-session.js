/**
 * The page being edited, from Edit until Save or Exit: which unsaved
 * changes are that session's.
 *
 * Edit fills the editor with the canvas (`src/site-canvas/expansion.js`),
 * which starts a session, noting what was unsaved already, like a colour
 * changed on Colors. Its Save and Exit then save or discard only what
 * changed since (`useChanges( { inEditSession: true } )`), and everything
 * else waits for Publish, at the foot of each screen, for the whole site.
 *
 * A record already unsaved when the session started stays out of it, even
 * if the session changes it further.
 *
 * It's kept in a data store, as the canvas's mode is (`src/site-canvas/
 * mode.js`): each route and app init are bundled with their own copy of this
 * module, and the screen that starts a session isn't the bundle whose Save
 * reads it.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

const STORE_NAME = 'create-not-learn-editor/edit-session';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer( state = { unsavedBefore: null }, action ) {
				return action.type === 'SET_UNSAVED_BEFORE'
					? { unsavedBefore: action.unsavedBefore }
					: state;
			},
			actions: {
				setUnsavedBefore: ( unsavedBefore ) => ( {
					type: 'SET_UNSAVED_BEFORE',
					unsavedBefore,
				} ),
			},
			selectors: {
				getUnsavedBefore: ( state ) => state.unsavedBefore,
			},
		} )
	);
}

/**
 * A record's id, as `useChanges` keys changes.
 *
 * @param {Object} record      An edited record.
 * @param {string} record.kind Its kind.
 * @param {string} record.name Its name.
 * @param {*}      record.key  Its key, if it has one.
 * @return {string} The id.
 */
export function getRecordId( { kind, name, key } ) {
	return [ kind, name, key ?? '' ].join( '|' );
}

/**
 * Start a session, noting what's unsaved now.
 */
export function startEditSession() {
	dispatch( STORE_NAME ).setUnsavedBefore(
		new Set(
			select( coreStore )
				.__experimentalGetDirtyEntityRecords()
				.map( getRecordId )
		)
	);
}

/**
 * End the session, once Save or Exit has done with it.
 */
export function endEditSession() {
	if ( select( STORE_NAME ).getUnsavedBefore() ) {
		dispatch( STORE_NAME ).setUnsavedBefore( null );
	}
}

/**
 * What was unsaved when the session started.
 *
 * @return {?Set<string>} Record ids, or null with no session.
 */
export function useUnsavedBeforeEditSession() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getUnsavedBefore(),
		[]
	);
}
