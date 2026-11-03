/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { countWords } from '../word-count';

describe( 'countWords', () => {
	it( 'counts the words in post content, not its markup', () => {
		expect(
			countWords(
				'<!-- wp:paragraph --><p>Small sites, <em>big</em> ideas.</p><!-- /wp:paragraph -->'
			)
		).toBe( 4 );
	} );

	it( 'doesn’t count dashes or entities as words', () => {
		expect( countWords( '<p>Slow &amp; steady — always</p>' ) ).toBe( 3 );
	} );

	it( 'counts nothing in nothing', () => {
		expect( countWords( '' ) ).toBe( 0 );
		expect( countWords( undefined ) ).toBe( 0 );
	} );
} );
