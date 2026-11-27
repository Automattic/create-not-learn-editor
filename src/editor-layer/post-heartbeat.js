/**
 * The heartbeat a post's lock needs, without WordPress's `heartbeat.js`.
 *
 * Core's lock dialog (`PostLockedModal`) keeps the lock by listening on the
 * `heartbeat.send` and `heartbeat.tick` hooks, which `heartbeat.js` fires.
 * That script depends on jQuery and polls on every page it is loaded on, so
 * this fires the same hooks itself, with `fetch`, and only while a post is
 * held. The request is the one `heartbeat.js` sends to
 * `admin-ajax.php?action=heartbeat`, so the server side is core's own. See
 * "Autosaves and post locks" in `docs/architecture.md`.
 */

/**
 * WordPress dependencies
 */
import { doAction } from '@wordpress/hooks';
import { useEffect, useRef } from '@wordpress/element';

// Core's post editor beats this often, so a takeover reaches the person taken
// over from quickly.
const INTERVAL = 10 * 1000;

// While the tab is hidden, as `heartbeat.js` slows down when nobody is
// looking. Coming back beats at once.
const HIDDEN_INTERVAL = 60 * 1000;

// The screen the heartbeat says it comes from. Core's lock filters don't
// read it.
const SCREEN_ID = 'create-not-learn-editor';

/**
 * Add a value to form data in PHP's bracket notation, as jQuery serialises
 * the heartbeat's nested data, so PHP reads it back as arrays.
 *
 * @param {URLSearchParams} params The form data.
 * @param {string}          key    The key so far.
 * @param {*}               value  The value.
 */
export function appendFormValue( params, key, value ) {
	if ( value === undefined || value === null ) {
		return;
	}

	if ( typeof value === 'object' ) {
		Object.entries( value ).forEach( ( [ name, child ] ) =>
			appendFormValue( params, `${ key }[${ name }]`, child )
		);
		return;
	}

	params.append( key, String( value ) );
}

/**
 * Beat once: ask everything listening on `heartbeat.send` what to send, send
 * it, and hand the answer to `heartbeat.tick`.
 *
 * @param {Object} options
 * @param {string} options.ajaxUrl `admin-ajax.php`.
 * @param {string} options.nonce   A `heartbeat-nonce` nonce.
 * @return {Promise<?Object>} The server's answer, if there was one.
 */
export async function beat( { ajaxUrl, nonce } ) {
	const data = {};

	doAction( 'heartbeat.send', data );

	const params = new URLSearchParams();
	params.append( 'action', 'heartbeat' );
	params.append( '_nonce', nonce );
	params.append( 'screen_id', SCREEN_ID );
	params.append( 'has_focus', String( ! document.hidden ) );
	appendFormValue( params, 'data', data );

	const response = await window.fetch( ajaxUrl, {
		body: params,
		credentials: 'same-origin',
		method: 'POST',
	} );

	if ( ! response.ok ) {
		return null;
	}

	const answer = await response.json();

	if ( answer && typeof answer === 'object' && ! answer.nonces_expired ) {
		doAction( 'heartbeat.tick', answer, 'success' );
	}

	return answer;
}

/**
 * Beat while `options` is given: every 10 seconds, or every minute while the
 * tab is hidden, and at once when it shows again.
 *
 * @param {?Object}  options                  Where and how to beat, or
 *                                            nothing to stop.
 * @param {string}   options.ajaxUrl          `admin-ajax.php`.
 * @param {string}   options.nonce            A `heartbeat-nonce` nonce.
 * @param {Function} [options.onNonceExpired] Called when the nonce has
 *                                            expired, as after a day open.
 */
export function usePostHeartbeat( options ) {
	const optionsRef = useRef( options );
	optionsRef.current = options;
	const isBeating = !! options;

	useEffect( () => {
		if ( ! isBeating ) {
			return;
		}

		let timeout;
		let isStopped = false;

		const schedule = () => {
			window.clearTimeout( timeout );
			timeout = window.setTimeout(
				run,
				document.hidden ? HIDDEN_INTERVAL : INTERVAL
			);
		};

		const run = async () => {
			const current = optionsRef.current;

			try {
				const answer = current && ( await beat( current ) );

				if ( answer?.nonces_expired ) {
					current.onNonceExpired?.();
				}
			} catch {
				// Offline for a moment. The next beat tries again.
			}

			if ( ! isStopped ) {
				schedule();
			}
		};

		const onVisibilityChange = () => {
			if ( ! document.hidden ) {
				window.clearTimeout( timeout );
				run();
			}
		};

		schedule();
		document.addEventListener( 'visibilitychange', onVisibilityChange );

		return () => {
			isStopped = true;
			window.clearTimeout( timeout );
			document.removeEventListener(
				'visibilitychange',
				onVisibilityChange
			);
		};
	}, [ isBeating ] );
}
