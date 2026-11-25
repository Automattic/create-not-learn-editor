/**
 * Which tab Details and Layers shows, and which design of its toggle is being
 * tried. Shared, so a toggle outside the panel can open it on a tab.
 *
 * The toggle designs are a spike: pick one with `&docToggle=<name>` in the
 * editor's address, which is remembered.
 */

/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { useSyncExternalStore } from '@wordpress/element';

export const DETAILS_TAB = 'details';
export const LAYERS_TAB = 'layers';

const EDITOR_STORE = 'core/editor';
const VARIANT_KEY = 'cnlDocToggle';
export const TOGGLE_VARIANTS = [ 'label', 'about', 'status', 'rail' ];

let tab = DETAILS_TAB;
const listeners = new Set();

function subscribe( listener ) {
	listeners.add( listener );
	return () => listeners.delete( listener );
}

export function setDocumentTab( next ) {
	tab = next;
	listeners.forEach( ( listener ) => listener() );
}

export function useDocumentTab() {
	return useSyncExternalStore( subscribe, () => tab );
}

export function isDocumentPanelOpen() {
	return Boolean( select( EDITOR_STORE )?.isListViewOpened?.() );
}

/**
 * Opens the panel on a tab, or closes it if it is already open on that tab.
 *
 * @param {string} next The tab.
 */
export function toggleDocumentPanel( next = tab ) {
	const isOpen = isDocumentPanelOpen();

	if ( isOpen && next === tab ) {
		dispatch( EDITOR_STORE ).setIsListViewOpened( false );
		return;
	}

	setDocumentTab( next );
	if ( ! isOpen ) {
		dispatch( EDITOR_STORE ).setIsListViewOpened( true );
	}
}

/**
 * @return {string} The toggle design being tried.
 */
export function getToggleVariant() {
	const fromUrl = new URLSearchParams( window.location.search ).get(
		'docToggle'
	);

	if ( TOGGLE_VARIANTS.includes( fromUrl ) ) {
		window.localStorage.setItem( VARIANT_KEY, fromUrl );
		return fromUrl;
	}

	const saved = window.localStorage.getItem( VARIANT_KEY );

	return TOGGLE_VARIANTS.includes( saved ) ? saved : 'label';
}
