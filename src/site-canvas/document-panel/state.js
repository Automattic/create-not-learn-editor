/**
 * Which panel the document rail has open: Details, Layers or Outline. Shared,
 * so the rail and the panel beside it agree. The panel is core's Document
 * Overview sidebar, so whether it is open is core's.
 */

/**
 * WordPress dependencies
 */
import { dispatch, select } from '@wordpress/data';
import { useSyncExternalStore } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';

export const DETAILS_TAB = 'details';
export const LAYERS_TAB = 'layers';
export const OUTLINE_TAB = 'outline';

const EDITOR_STORE = 'core/editor';

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
 * Closes the panel from inside it, and hands focus back to the rail's button
 * for it, as core's own sidebar does.
 */
export function closeDocumentPanel() {
	dispatch( EDITOR_STORE ).setIsListViewOpened( false );
	unlock( select( EDITOR_STORE ) ).getListViewToggleRef().current?.focus();
}
