/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getPlainDescription,
	isDescriptionOf,
	toDescriptionHtml,
} from '../description';

describe( 'getPlainDescription', () => {
	test( 'reads paragraphs a blank line apart', () => {
		expect( getPlainDescription( '<p>One</p><p>Two</p>' ) ).toBe(
			'One\n\nTwo'
		);
	} );

	test( 'turns down a description with other formatting', () => {
		expect(
			getPlainDescription( '<p>A <a href="#">link</a></p>' )
		).toBeNull();
	} );
} );

describe( 'toDescriptionHtml', () => {
	test( 'wraps each paragraph and escapes it', () => {
		expect( toDescriptionHtml( 'One & two\n\nThree' ) ).toBe(
			'<p>One &amp; two</p><p>Three</p>'
		);
	} );
} );

describe( 'isDescriptionOf', () => {
	test( 'keeps a space or a blank line still being typed', () => {
		const html = '<p>Arching leaves</p>';

		expect( isDescriptionOf( 'Arching leaves ', html ) ).toBe( true );
		expect( isDescriptionOf( 'Arching leaves\n\n', html ) ).toBe( true );
	} );

	test( 'notices a change made somewhere else, like undo', () => {
		expect( isDescriptionOf( 'Arching leaves', '<p>Arching</p>' ) ).toBe(
			false
		);
	} );
} );
