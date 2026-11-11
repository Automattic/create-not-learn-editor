/**
 * Whether an agent is working in the editor through WebMCP, its name if it
 * has given one, when it last called a tool, and what it has changed, for
 * the canvas toolbar to show. See `src/top-bar/agent-status.jsx`.
 *
 * Changes are kept in batches, one for each request the agent works on, so
 * a long session reads as a few pieces of work rather than every step. The
 * agent names each one with `cnl-start-task`, and its changes go in it until
 * it names the next. Changes it makes without naming one go in a batch of
 * their own, and a pause of a few minutes starts another.
 *
 * The page isn't told when an agent connects, or which agent it is. So an
 * agent counts as connected once it calls one of the tools, or from the
 * start in a browser an agent drives, which tells the page with
 * `navigator.webdriver`. Its name is what it gives `cnl-connect`.
 *
 * Kept in a data store, registered once by name, as app init, which shows
 * it, and the app-init-deferred module, which runs the tools, are built
 * separately, each with its own copy of this module.
 */

/**
 * WordPress dependencies
 */
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

export const STORE_NAME = 'create-not-learn-editor/agent-connection';

const MAX_NAME_LENGTH = 40;
const MAX_TITLE_LENGTH = 60;
// The batches kept, newest first.
const MAX_BATCHES = 20;
// A pause this long ends a batch the agent hasn't named.
const PAUSE_MS = 2 * 60 * 1000;

let nextId = 1;

function clean( text, length ) {
	return typeof text === 'string'
		? text.replace( /\s+/g, ' ' ).trim().slice( 0, length )
		: '';
}

function newBatch( title, time ) {
	return {
		changes: [],
		id: `batch-${ nextId++ }`,
		title,
		updatedAt: time,
	};
}

/**
 * The batches with a change added: to the batch under way, or to a new one
 * when none is, or the one under way wasn't named and has paused.
 *
 * @param {Object[]} batches The batches, newest first.
 * @param {Object}   change  `{ text, clientId, time }`.
 * @return {Object[]} The batches.
 */
export function withChange( batches, change ) {
	const [ current, ...rest ] = batches;
	const isOngoing =
		current &&
		( current.title || change.time - current.updatedAt < PAUSE_MS );
	const batch = isOngoing ? current : newBatch( null, change.time );

	return [
		{
			...batch,
			changes: [ ...batch.changes, change ],
			updatedAt: change.time,
		},
		...( isOngoing ? rest : batches ),
	].slice( 0, MAX_BATCHES );
}

/**
 * The batches with a new one started for a request.
 *
 * @param {Object[]} batches The batches, newest first.
 * @param {string}   title   What the request is.
 * @param {number}   time    When it started.
 * @return {Object[]} The batches.
 */
export function withTask( batches, title, time ) {
	const [ current, ...rest ] = batches;

	// Named before it changed anything: the name was just put better.
	if ( current && ! current.changes.length ) {
		return [ { ...current, title, updatedAt: time }, ...rest ];
	}

	return [ newBatch( title, time ), ...batches ].slice( 0, MAX_BATCHES );
}

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer(
				state = {
					isConnected: false,
					name: null,
					lastCallAt: 0,
					batches: [],
				},
				action
			) {
				switch ( action.type ) {
					case 'CONNECT':
						return {
							...state,
							isConnected: true,
							name: action.name || state.name,
						};
					case 'NOTE_CALL':
						return {
							...state,
							isConnected: true,
							lastCallAt: action.time,
						};
					case 'ADD_CHANGE':
						return {
							...state,
							batches: withChange( state.batches, action.change ),
						};
					case 'START_TASK':
						return {
							...state,
							batches: withTask(
								state.batches,
								action.title,
								action.time
							),
						};
				}

				return state;
			},
			actions: {
				connect: ( name ) => ( { name, type: 'CONNECT' } ),
				noteCall: ( time ) => ( { time, type: 'NOTE_CALL' } ),
				addChange: ( change ) => ( { change, type: 'ADD_CHANGE' } ),
				startTask: ( title, time ) => ( {
					time,
					title,
					type: 'START_TASK',
				} ),
			},
			selectors: {
				isConnected: ( state ) => state.isConnected,
				getName: ( state ) => state.name,
				getLastCallAt: ( state ) => state.lastCallAt,
				getBatches: ( state ) => state.batches,
			},
		} )
	);
}

/**
 * Note that an agent is connected, and its name if it gave one.
 *
 * @param {?string} name The agent's name.
 */
export function markConnected( name = null ) {
	const cleanName = clean( name, MAX_NAME_LENGTH );
	const store = select( STORE_NAME );

	if (
		! store.isConnected() ||
		( cleanName && cleanName !== store.getName() )
	) {
		dispatch( STORE_NAME ).connect( cleanName || null );
	}
}

/**
 * Start a batch for a request the agent is working on.
 *
 * @param {string} title What the request is, in a few words.
 * @return {string} The title, as kept.
 */
export function startTask( title ) {
	const cleanTitle = clean( title, MAX_TITLE_LENGTH );

	if ( cleanTitle ) {
		dispatch( STORE_NAME ).startTask( cleanTitle, Date.now() );
	}

	return cleanTitle;
}

/**
 * Note that the agent has just called a tool.
 */
export function noteToolCall() {
	dispatch( STORE_NAME ).noteCall( Date.now() );
}

/**
 * Note a change the agent made, in the batch it belongs to.
 *
 * @param {string}  text     What changed, in the person's words.
 * @param {?string} clientId The block it changed, if one shows it.
 */
export function recordChange( text, clientId = null ) {
	dispatch( STORE_NAME ).addChange( {
		clientId,
		text,
		time: Date.now(),
	} );
}

/**
 * @return {Object} `{ isConnected, name, lastCallAt, batches }`, kept up to
 *                  date. `batches` are newest first, each `{ id, title,
 *                  changes, updatedAt }`, with its `changes` oldest first,
 *                  each `{ text, clientId, time }`. A batch the agent didn't
 *                  name has a null `title`.
 */
export function useAgentConnection() {
	return useSelect( ( selectStore ) => {
		const store = selectStore( STORE_NAME );

		return {
			isConnected: store.isConnected(),
			name: store.getName(),
			lastCallAt: store.getLastCallAt(),
			batches: store.getBatches(),
		};
	}, [] );
}
