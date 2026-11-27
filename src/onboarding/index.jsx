/**
 * Inline help that waits for its moment: the first time something happens,
 * once the person has stopped for a moment, a tip spotlights the control it's
 * about, with a short video of that control and a line on what it's for.
 *
 * A tip is registered once, with what it points at and when it's due. It's
 * due either when `when( select )` first answers true, or when code asks for
 * it with `requestOnboardingTip( id )` after an action. Either way, it's shown
 * once ever: its id is kept in a user preference as soon as it's on screen.
 *
 * A tip whose control has already been clicked counts as seen. Nothing is
 * shown to someone who has turned hints off, from the tip's
 * "Don't show hints like these" or Preferences, in a workspace whose
 * `onboarding` is off, like Builder,
 * while a dialog is open, or while what the tip points at is out of sight.
 * See README.md in this folder.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { dispatch, select, subscribe } from '@wordpress/data';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { createRoot } from '@wordpress/element';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { getActiveWorkspace, PREFERENCES_SCOPE } from '../workspaces/presets';
import { registerOnboardingPreferences, showsHints } from './preferences';
import { REQUEST_TIP_FILTER } from './request';
import { Spotlight } from './spotlight';

export const SEEN_PREFERENCE = 'onboardingSeen';

// How long the person has to stop before a tip interrupts them.
const IDLE_MS = 2500;
const CHECK_MS = 500;
const ACTIVITY_EVENTS = [ 'pointerdown', 'pointermove', 'keydown', 'wheel' ];

const tips = new Map();
const requested = new Set();

let lastActivity = Date.now();
let timer = null;
let shown = null;
let root = null;

/**
 * Register a tip.
 *
 * @param {Object}   tip             The tip.
 * @param {string}   tip.id          Kept in the preference once it's seen.
 * @param {string}   tip.target      Selector for the control it spotlights.
 * @param {string}   tip.title       Its heading.
 * @param {string}   tip.description What the control is for.
 * @param {string}   [tip.video]     A short, silent clip of the control.
 * @param {string}   [tip.placement] Where it sits beside the control.
 * @param {Function} [tip.when]      Given `select`, whether it's due.
 * @param {string[]} [tip.showOn]    When a due tip shows: any of `now`,
 *                                   `idle` and `leave` (see `MOMENTS`),
 *                                   whichever comes first. `idle` if not
 *                                   given.
 */
export function registerOnboardingTip( tip ) {
	tips.set( tip.id, tip );
	schedule();
}

/**
 * Answer `requestOnboardingTip()` (`./request.js`).
 *
 * @param {string} id Tip id.
 * @return {boolean} Whether the tip is showing or will show.
 */
function requestTip( id ) {
	if ( shown?.id === id ) {
		return true;
	}

	if ( ! tips.has( id ) || ! isOn() || getSeen().includes( id ) ) {
		return false;
	}

	requested.add( id );
	schedule();

	return true;
}

function getSeen() {
	return (
		select( preferencesStore ).get( PREFERENCES_SCOPE, SEEN_PREFERENCE ) ??
		[]
	);
}

function markSeen( id ) {
	const seen = getSeen();

	if ( ! seen.includes( id ) ) {
		dispatch( preferencesStore ).set( PREFERENCES_SCOPE, SEEN_PREFERENCE, [
			...seen,
			id,
		] );
	}
}

/**
 * Show every tip again, for anyone wanting to see them, and for testing.
 */
export function resetOnboarding() {
	dispatch( preferencesStore ).set( PREFERENCES_SCOPE, SEEN_PREFERENCE, [] );
}

const isOn = () =>
	getActiveWorkspace( select ).onboarding && showsHints( select );

/*
 * Where in the editor the person is: the screen, from the address. A page
 * changed in the canvas is the same screen.
 */
const getScreen = () =>
	new URL( window.location.href ).searchParams.get( 'p' ) ?? '/';

// The screen a tip became due on, by tip id, while it stays due.
const dueOn = new Map();

let screen = getScreen();
let screenChangedAt = 0;

// How long a new screen gets to draw before a tip points into it.
const SETTLE_MS = 600;

/**
 * The moments a due tip can be shown at. A tip lists the ones it waits for
 * in `showOn`, and is shown at the first of them to come.
 *
 * - `now`: as soon as it's due.
 * - `idle`: once nothing has been clicked, typed, scrolled or edited for a
 *   moment.
 * - `leave`: once the person moves to another screen than the one it became
 *   due on, as they finish what they were doing there.
 */
const MOMENTS = {
	now: () => true,
	idle: () => Date.now() - lastActivity >= IDLE_MS,
	leave: ( due ) =>
		screen !== due.screen && Date.now() - screenChangedAt >= SETTLE_MS,
};

const DEFAULT_SHOW_ON = [ 'idle' ];

function isDue( tip, seen ) {
	return (
		! seen.includes( tip.id ) &&
		( requested.has( tip.id ) || Boolean( tip.when?.( select ) ) )
	);
}

/**
 * The due tips, each with the screen it became due on. A tip that stops
 * being due, like changes that were published before it showed, is
 * forgotten, so it starts again if it's due again later.
 *
 * @return {Object[]} `{ tip, due }` for each due tip.
 */
function getDueTips() {
	if ( shown || ! isOn() ) {
		dueOn.clear();
		return [];
	}

	const seen = getSeen();
	const dueTips = [];

	for ( const tip of tips.values() ) {
		if ( ! isDue( tip, seen ) ) {
			dueOn.delete( tip.id );
			continue;
		}

		if ( ! dueOn.has( tip.id ) ) {
			dueOn.set( tip.id, { screen } );
		}

		dueTips.push( { tip, due: dueOn.get( tip.id ) } );
	}

	return dueTips;
}

function findVisibleTarget( selector ) {
	const element = document.querySelector( selector );
	const rect = element?.getBoundingClientRect();

	if (
		! rect ||
		! rect.width ||
		! rect.height ||
		rect.bottom < 0 ||
		rect.right < 0 ||
		rect.top > window.innerHeight ||
		rect.left > window.innerWidth ||
		element.closest( '[inert],[aria-hidden="true"]' )
	) {
		return null;
	}

	return element;
}

const isDialogOpen = () =>
	Boolean(
		document.querySelector(
			'.components-modal__screen-overlay, [role="dialog"][aria-modal="true"]'
		)
	);

/**
 * Someone who has used a tip's control has found it, so the tip has nothing
 * left to tell them: a click on it, by pointer or keyboard, counts as seeing
 * the tip, in any workspace and with hints off. Getting to the same place
 * another way, like a double click on the page for Edit, doesn't count.
 *
 * @param {MouseEvent} event A click anywhere in the editor.
 */
function noteControlUsed( event ) {
	if ( ! event.target?.closest ) {
		return;
	}

	const seen = getSeen();

	for ( const tip of tips.values() ) {
		if ( ! seen.includes( tip.id ) && event.target.closest( tip.target ) ) {
			markSeen( tip.id );
		}
	}
}

function noteActivity() {
	lastActivity = Date.now();
}

/*
 * Typing in the canvas happens in its iframe, whose events don't reach this
 * window, so each same-origin iframe is listened to as well.
 */
const watchedFrames = new WeakSet();

function watchFrames() {
	document.querySelectorAll( 'iframe' ).forEach( ( frame ) => {
		const frameWindow = frame.contentWindow;

		// Reading the document of a frame from elsewhere throws.
		try {
			if ( ! frameWindow?.document ) {
				return;
			}
		} catch {
			return;
		}

		if ( ! watchedFrames.has( frameWindow ) ) {
			watchedFrames.add( frameWindow );
			ACTIVITY_EVENTS.forEach( ( type ) =>
				frameWindow.addEventListener( type, noteActivity, {
					capture: true,
					passive: true,
				} )
			);
		}
	} );
}

function updateScreen() {
	const currentScreen = getScreen();

	if ( currentScreen !== screen ) {
		screen = currentScreen;
		screenChangedAt = Date.now();
	}
}

function check() {
	timer = null;
	updateScreen();

	const dueTips = getDueTips();

	if ( ! dueTips.length ) {
		return;
	}

	watchFrames();

	if ( ! isDialogOpen() ) {
		for ( const { tip, due } of dueTips ) {
			const showOn = tip.showOn ?? DEFAULT_SHOW_ON;
			const target = showOn.some( ( moment ) =>
				MOMENTS[ moment ]?.( due )
			)
				? findVisibleTarget( tip.target )
				: null;

			if ( target ) {
				show( tip, target );
				return;
			}
		}
	}

	timer = setTimeout( check, CHECK_MS );
}

function schedule() {
	if ( ! timer && ! shown ) {
		timer = setTimeout( check, CHECK_MS );
	}
}

function show( tip, target ) {
	shown = tip;
	requested.delete( tip.id );
	dueOn.delete( tip.id );
	markSeen( tip.id );

	if ( ! root ) {
		const container = document.createElement( 'div' );
		container.className = 'cnl-onboarding-host';
		document.body.append( container );
		root = createRoot( container );
	}

	root.render(
		<Spotlight
			key={ tip.id }
			tip={ tip }
			target={ target }
			onClose={ () => {
				shown = null;
				root.render( null );
				target.focus?.();
				schedule();
			} }
		/>
	);
}

/**
 * Start watching for tips that are due. Called once, from app init.
 *
 * @return {Function} Stop watching, for tests.
 */
export function mountOnboarding() {
	registerOnboardingPreferences();

	const FILTER_NAMESPACE = 'create-not-learn-editor/onboarding';
	addFilter(
		REQUEST_TIP_FILTER,
		FILTER_NAMESPACE,
		( isShowing, id ) => isShowing || requestTip( id )
	);

	const listenerOptions = { capture: true, passive: true };
	ACTIVITY_EVENTS.forEach( ( type ) =>
		window.addEventListener( type, noteActivity, listenerOptions )
	);
	window.addEventListener( 'click', noteControlUsed, listenerOptions );

	// A tip a change makes due is noted as due there and then, on the screen
	// the change was made on, as the person may move on before the next
	// check. Edits count as activity too, wherever they're made.
	const noteChange = () => {
		updateScreen();
		getDueTips();
		schedule();
	};
	const unsubscribes = [
		subscribe( () => {
			noteActivity();
			noteChange();
		}, coreStore ),
		subscribe( noteChange, preferencesStore ),
	];
	schedule();

	return () => {
		removeFilter( REQUEST_TIP_FILTER, FILTER_NAMESPACE );
		unsubscribes.forEach( ( unsubscribe ) => unsubscribe() );
		ACTIVITY_EVENTS.forEach( ( type ) =>
			window.removeEventListener( type, noteActivity, listenerOptions )
		);
		window.removeEventListener( 'click', noteControlUsed, listenerOptions );
		clearTimeout( timer );
		timer = null;
	};
}
