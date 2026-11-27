/**
 * External dependencies
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	closeDocumentPanel,
	DETAILS_TAB,
	LAYERS_TAB,
	OUTLINE_TAB,
	setDocumentTab,
	toggleDocumentPanel,
} from '../state';

// A stand-in for core's editor store: whether its sidebar is open, and the
// button it hands focus back to.
const editor = vi.hoisted( () => ( {
	isOpen: false,
	toggleRef: { current: null },
} ) );

vi.mock( '@wordpress/data', () => ( {
	dispatch: () => ( {
		setIsListViewOpened: ( isOpen ) => {
			editor.isOpen = isOpen;
		},
	} ),
	select: () => ( {
		getListViewToggleRef: () => editor.toggleRef,
		isListViewOpened: () => editor.isOpen,
	} ),
} ) );

vi.mock( '../../../lock-unlock', () => ( { unlock: ( value ) => value } ) );

describe( 'toggleDocumentPanel', () => {
	beforeEach( () => {
		editor.isOpen = false;
		setDocumentTab( DETAILS_TAB );
	} );

	test( 'opens the panel on the panel clicked', () => {
		toggleDocumentPanel( OUTLINE_TAB );

		expect( editor.isOpen ).toBe( true );
	} );

	test( 'switches panels without closing, when another is clicked', () => {
		toggleDocumentPanel( LAYERS_TAB );
		toggleDocumentPanel( OUTLINE_TAB );

		expect( editor.isOpen ).toBe( true );
	} );

	test( 'closes the panel when its own icon is clicked again', () => {
		toggleDocumentPanel( LAYERS_TAB );
		toggleDocumentPanel( LAYERS_TAB );

		expect( editor.isOpen ).toBe( false );
	} );

	test( 'opens again on the panel last picked', () => {
		toggleDocumentPanel( OUTLINE_TAB );
		toggleDocumentPanel( OUTLINE_TAB );
		toggleDocumentPanel();

		expect( editor.isOpen ).toBe( true );
		// A click on Outline now closes it, so Outline was the one open.
		toggleDocumentPanel( OUTLINE_TAB );
		expect( editor.isOpen ).toBe( false );
	} );
} );

describe( 'closeDocumentPanel', () => {
	test( 'closes the panel and hands focus back to the rail', () => {
		const button = document.createElement( 'button' );

		document.body.append( button );
		editor.isOpen = true;
		editor.toggleRef.current = button;

		closeDocumentPanel();

		expect( editor.isOpen ).toBe( false );
		expect( document.activeElement ).toBe( button );
		button.remove();
	} );
} );
