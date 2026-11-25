/**
 * External dependencies
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The tip itself is core's Popover; these tests are about when it shows.
vi.mock( '../spotlight', () => ( { Spotlight: () => null } ) );

// Core's records, standing in for edits: the real store doesn't load here.
vi.mock( '@wordpress/core-data', async () => {
	const { createReduxStore, register } = await import( '@wordpress/data' );
	const store = createReduxStore( 'core', {
		reducer: ( state = 0, action ) =>
			action.type === 'EDIT' ? state + 1 : state,
		actions: { edit: () => ( { type: 'EDIT' } ) },
	} );
	register( store );

	return { store };
} );

const SCOPE = 'create-not-learn-editor';
const TARGET_CLASS = 'test-onboarding-target';

let data;
let preferencesStore;
let onboarding;
let requestOnboardingTip;
let unmount;

/**
 * A fresh copy of the module and of the data stores it reads, as the module
 * keeps which tip is due and which is showing.
 */
async function load() {
	vi.resetModules();
	data = await import( '@wordpress/data' );
	( { store: preferencesStore } = await import( '@wordpress/preferences' ) );
	onboarding = await import( '..' );
	( { requestOnboardingTip } = await import( '../request' ) );
}

const setPreference = ( name, value ) =>
	data.dispatch( preferencesStore ).set( SCOPE, name, value );

const getSeen = () =>
	data.select( preferencesStore ).get( SCOPE, 'onboardingSeen' ) ?? [];

/**
 * A control on screen for a tip to point at. jsdom lays nothing out, so its
 * box is given.
 *
 * @param {boolean} [isVisible] Whether it takes up room on screen.
 * @return {HTMLElement} The control.
 */
function addTarget( isVisible = true ) {
	const target = document.createElement( 'button' );
	target.className = TARGET_CLASS;
	target.getBoundingClientRect = () =>
		isVisible
			? {
					top: 10,
					left: 10,
					bottom: 30,
					right: 60,
					width: 50,
					height: 20,
				}
			: { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
	document.body.append( target );

	return target;
}

/**
 * Register a tip that's due while the `due` test preference is on.
 *
 * @param {Object} [tip] Anything to set on the tip.
 */
function registerTip( tip = {} ) {
	onboarding.registerOnboardingTip( {
		id: 'test-tip',
		target: `.${ TARGET_CLASS }`,
		title: 'Title',
		description: 'Description',
		when: ( select ) =>
			Boolean( select( preferencesStore ).get( SCOPE, 'testDue' ) ),
		...tip,
	} );
}

const makeDue = () => setPreference( 'testDue', true );

const openScreen = ( screen ) =>
	window.history.replaceState(
		null,
		'',
		`/wp-admin/admin.php?page=create-not-learn-editor&p=${ encodeURIComponent(
			screen
		) }`
	);

const act = () => window.dispatchEvent( new window.Event( 'pointerdown' ) );

beforeEach( async () => {
	vi.useFakeTimers();
	openScreen( '/design/identity' );
	await load();
	// The stores outlive the module, so put back what earlier tests set.
	[ 'onboardingSeen', 'showHints', 'testDue', 'workspace' ].forEach(
		( name ) => setPreference( name, undefined )
	);
	unmount = onboarding.mountOnboarding();
} );

afterEach( () => {
	unmount();
	vi.useRealTimers();
	document.body.innerHTML = '';
	window.history.replaceState( null, '', '/' );
} );

describe( 'onboarding tips', () => {
	it( 'shows a due tip once the person stops for a moment', () => {
		addTarget();
		registerTip();
		makeDue();

		vi.advanceTimersByTime( 1500 );
		expect( getSeen() ).toEqual( [] );

		vi.advanceTimersByTime( 1500 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'waits while the person keeps going', () => {
		addTarget();
		registerTip();
		makeDue();

		for ( let i = 0; i < 5; i++ ) {
			vi.advanceTimersByTime( 1000 );
			act();
		}
		expect( getSeen() ).toEqual( [] );

		vi.advanceTimersByTime( 3000 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'isn’t shown before it’s due', () => {
		addTarget();
		registerTip();

		vi.advanceTimersByTime( 10000 );
		expect( getSeen() ).toEqual( [] );
	} );

	it( 'shows on leaving the screen it became due on, before a pause would', () => {
		addTarget();
		registerTip( { showOn: [ 'leave' ] } );
		makeDue();

		vi.advanceTimersByTime( 500 );
		openScreen( '/design' );
		act();
		vi.advanceTimersByTime( 1500 );

		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'counts the screen it became due on, even when left at once', () => {
		addTarget();
		registerTip( { showOn: [ 'leave' ] } );
		makeDue();

		// Before the next check could notice it was due.
		openScreen( '/design' );
		vi.advanceTimersByTime( 1500 );

		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'doesn’t show on `leave` while the person stays on the screen', () => {
		addTarget();
		registerTip( { showOn: [ 'leave' ] } );
		makeDue();

		vi.advanceTimersByTime( 10000 );
		expect( getSeen() ).toEqual( [] );
	} );

	it( 'starts again when a tip stops being due before it shows', () => {
		addTarget();
		registerTip( { showOn: [ 'leave' ] } );
		makeDue();
		vi.advanceTimersByTime( 500 );

		setPreference( 'testDue', false );
		vi.advanceTimersByTime( 500 );
		openScreen( '/design' );
		vi.advanceTimersByTime( 1000 );

		// Due again, now on the screen the person is on.
		makeDue();
		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );

		openScreen( '/pages' );
		vi.advanceTimersByTime( 1500 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'shows a `now` tip straight away', () => {
		addTarget();
		registerTip( { showOn: [ 'now' ] } );
		act();
		makeDue();

		vi.advanceTimersByTime( 600 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'waits for its control to be on screen', () => {
		const target = addTarget( false );
		registerTip();
		makeDue();

		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );

		target.remove();
		addTarget();
		vi.advanceTimersByTime( 600 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'waits while a dialog is open', () => {
		addTarget();
		const dialog = document.createElement( 'div' );
		dialog.className = 'components-modal__screen-overlay';
		document.body.append( dialog );
		registerTip();
		makeDue();

		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );

		dialog.remove();
		vi.advanceTimersByTime( 600 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'shows a tip asked for after an action', () => {
		addTarget();
		registerTip( { when: undefined } );

		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );

		expect( requestOnboardingTip( 'test-tip' ) ).toBe( true );
		vi.advanceTimersByTime( 3000 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );

		// Still showing, so asking again doesn't need anything else.
		expect( requestOnboardingTip( 'test-tip' ) ).toBe( true );
	} );

	it( 'says a tip that has been seen won’t show again', () => {
		setPreference( 'onboardingSeen', [ 'test-tip' ] );
		addTarget();
		registerTip();
		makeDue();

		expect( requestOnboardingTip( 'test-tip' ) ).toBe( false );
		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'says a tip nobody registered won’t show', () => {
		expect( requestOnboardingTip( 'unknown' ) ).toBe( false );
	} );

	it( 'shows nothing once hints are turned off', () => {
		setPreference( 'showHints', false );
		addTarget();
		registerTip();
		makeDue();

		expect( requestOnboardingTip( 'test-tip' ) ).toBe( false );
		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );
	} );

	it( 'shows nothing in a workspace with onboarding off', () => {
		setPreference( 'workspace', 'builder' );
		addTarget();
		registerTip();
		makeDue();

		expect( requestOnboardingTip( 'test-tip' ) ).toBe( false );
		vi.advanceTimersByTime( 5000 );
		expect( getSeen() ).toEqual( [] );
	} );

	it( 'shows one tip at a time, the first registered', () => {
		addTarget();
		registerTip( { id: 'first' } );
		registerTip( { id: 'second' } );
		makeDue();

		vi.advanceTimersByTime( 3000 );
		expect( getSeen() ).toEqual( [ 'first' ] );
	} );

	it( 'counts a tip as seen once its control has been clicked', () => {
		const target = addTarget();
		registerTip();

		target.click();
		expect( getSeen() ).toEqual( [ 'test-tip' ] );

		makeDue();
		expect( requestOnboardingTip( 'test-tip' ) ).toBe( false );
	} );

	it( 'counts a click inside the control, even with hints off', () => {
		setPreference( 'showHints', false );
		const target = addTarget();
		const icon = document.createElement( 'span' );
		target.append( icon );
		registerTip();

		icon.click();
		expect( getSeen() ).toEqual( [ 'test-tip' ] );
	} );

	it( 'doesn’t count a click elsewhere', () => {
		addTarget();
		registerTip();

		document.body.click();
		expect( getSeen() ).toEqual( [] );
	} );

	it( 'shows tips again after a reset', () => {
		setPreference( 'onboardingSeen', [ 'test-tip' ] );
		onboarding.resetOnboarding();

		expect( getSeen() ).toEqual( [] );
	} );
} );
