/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	findFailures,
	formatReport,
} from '../../scripts/gutenberg-compat-report.mjs';

const REPORT = {
	title: 'smoke.spec.js',
	file: 'smoke.spec.js',
	specs: [
		{
			title: 'every main screen loads',
			file: 'smoke.spec.js',
			line: 17,
			tests: [
				{
					status: 'unexpected',
					results: [
						{
							error: {
								message:
									'\u001b[31mError: not visible\u001b[39m\nmore',
							},
						},
					],
				},
			],
		},
	],
	suites: [
		{
			title: 'Block toolbar',
			file: 'smoke.spec.js',
			specs: [
				{
					title: 'passes on a retry',
					file: 'smoke.spec.js',
					line: 30,
					tests: [ { status: 'flaky', results: [] } ],
				},
			],
		},
	],
};

describe( 'Gutenberg compatibility report', () => {
	it( 'lists failing tests, not flaky ones, with their first error line', () => {
		expect( findFailures( REPORT ) ).toEqual( [
			{
				title: 'every main screen loads',
				file: 'smoke.spec.js',
				line: 17,
				error: 'Error: not visible\nmore',
			},
		] );
	} );

	it( 'says which steps failed', () => {
		const body = formatReport( {
			name: 'Gutenberg 24.4.2',
			version: '24.4.2',
			runUrl: 'https://example.invalid',
			steps: { BUILD: 'success', START: 'success', PHP: 'failure' },
			failures: null,
		} );

		expect( body ).toContain( '❌ PHPUnit: failure' );
		expect( body ).toContain( '➖ End-to-end tests: skipped' );
	} );
} );
