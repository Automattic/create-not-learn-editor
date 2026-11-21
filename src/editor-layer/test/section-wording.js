/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * WordPress dependencies
 */
import { __, _x, resetLocaleData, setLocaleData } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { enableSectionWording, getSectionWording } from '../section-wording';

/* eslint-disable @wordpress/i18n-text-domain -- core's strings, which the
   swap is for, and another plugin's. */

describe( 'getSectionWording', () => {
	it( 'says sections for patterns', () => {
		expect( getSectionWording( 'Patterns' ) ).toBe( 'Sections' );
		expect( getSectionWording( 'Edit pattern' ) ).toBe( 'Edit section' );
	} );

	it( 'matches strings with a context only in that context', () => {
		expect( getSectionWording( 'Pattern', 'block title' ) ).toBe(
			'Section'
		);
		expect( getSectionWording( 'Pattern', 'something else' ) ).toBe(
			undefined
		);
	} );

	it( 'keeps core wording it does not know', () => {
		expect( getSectionWording( 'Pattern Directory' ) ).toBe( undefined );
		expect( getSectionWording( 'constructor' ) ).toBe( undefined );
	} );
} );

describe( 'enableSectionWording', () => {
	it( 'swaps core wording until it is stopped', () => {
		expect( __( 'Patterns' ) ).toBe( 'Patterns' );

		const stop = enableSectionWording();

		expect( __( 'Patterns' ) ).toBe( 'Sections' );
		expect(
			_x( 'Add pattern', 'Generic label for pattern inserter button' )
		).toBe( 'Add section' );

		stop();

		expect( __( 'Patterns' ) ).toBe( 'Patterns' );
	} );

	it( 'leaves other text domains alone', () => {
		const stop = enableSectionWording();

		expect( __( 'Patterns', 'some-plugin' ) ).toBe( 'Patterns' );

		stop();
	} );

	it( "says the replacement in the editor's own language pack", () => {
		setLocaleData(
			{ Sections: [ 'Abschnitte' ] },
			'create-not-learn-editor'
		);
		const stop = enableSectionWording();

		expect( __( 'Patterns' ) ).toBe( 'Abschnitte' );

		stop();
		resetLocaleData( undefined, 'create-not-learn-editor' );
	} );
} );
