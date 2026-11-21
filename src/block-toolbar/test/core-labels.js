/**
 * External dependencies
 */
import { afterEach, describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { resetLocaleData, setLocaleData } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	attributeIs,
	getCoreItemLabels,
	getLabelStyles,
	registerLabelStyles,
} from '../core-labels';

const CONTEXT = '\u0004';

/**
 * Translate a few of core's strings into German, as the site would.
 *
 * @param {Object} strings Translations, by source string.
 */
function speakGerman( strings ) {
	setLocaleData(
		Object.fromEntries(
			Object.entries( strings ).map( ( [ text, translation ] ) => [
				text,
				[ translation ],
			] )
		)
	);
}

afterEach( () => resetLocaleData() );

describe( 'core labels', () => {
	it( 'reads Group as core’s verb, not the block’s name', () => {
		speakGerman( {
			Group: 'Gruppe',
			[ `verb${ CONTEXT }Group` ]: 'Gruppieren',
		} );

		expect( getCoreItemLabels().group ).toBe( 'Gruppieren' );
	} );

	it( 'matches the style controls in the site’s language', () => {
		speakGerman( { 'Align text': 'Text ausrichten' } );

		const css = getLabelStyles();

		expect( css ).toContain( '[aria-label="Text ausrichten"]' );
		expect( css ).not.toContain( '[aria-label="Align text"]' );
	} );

	it( 'quotes a label that has quotes in it', () => {
		expect( attributeIs( 'aria-label', 'Say "hi"' ) ).toBe(
			'[aria-label="Say \\"hi\\""]'
		);
	} );

	it( 'writes the rules again when the translations change', () => {
		const unregister = registerLabelStyles();
		const style = document.getElementById( 'cnl-block-toolbar-labels' );

		expect( style.textContent ).toContain( '[aria-label="Align text"]' );

		speakGerman( { 'Align text': 'Text ausrichten' } );

		expect( style.textContent ).toContain(
			'[aria-label="Text ausrichten"]'
		);

		unregister();
		expect( document.getElementById( 'cnl-block-toolbar-labels' ) ).toBe(
			null
		);
	} );
} );
