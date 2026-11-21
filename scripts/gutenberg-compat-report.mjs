#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'log' ] } ] */
/**
 * Writes the issue for a Gutenberg compatibility run that failed
 * (`.github/workflows/gutenberg-compat.yml`): which steps failed, and which
 * end-to-end tests, read from Playwright's JSON report.
 *
 * Usage: node scripts/gutenberg-compat-report.mjs <results.json>
 *
 * Reads the run from the environment: GUTENBERG_NAME, GUTENBERG_VERSION,
 * RUN_URL and one STEP_<NAME> outcome per step, such as STEP_BUILD=failure.
 * Prints the issue's body as Markdown.
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

/**
 * Every test in the report that failed, retries and all.
 *
 * @param {Object}   suite    A suite in Playwright's JSON report.
 * @param {string[]} [titles] The titles of the suites around it.
 * @return {Object[]} `{ title, file, line, error }` for each.
 */
export function findFailures( suite, titles = [] ) {
	const path =
		suite.title && ! suite.file?.endsWith( suite.title )
			? [ ...titles, suite.title ]
			: titles;
	const failures = [];

	for ( const spec of suite.specs ?? [] ) {
		for ( const test of spec.tests ?? [] ) {
			// `flaky` passed on a retry, so it counts as passing.
			if ( test.status !== 'unexpected' ) {
				continue;
			}
			const last = test.results?.[ test.results.length - 1 ];
			failures.push( {
				title: [ ...path, spec.title ].join( ' › ' ),
				file: spec.file,
				line: spec.line,
				error: ( last?.error?.message ?? '' )
					// Playwright colours its messages for the terminal.

					.replace( /\u001b\[[0-9;]*m/g, '' )
					.split( '\n' )
					.find( ( text ) => text.trim() )
					?.trim(),
			} );
		}
	}
	for ( const child of suite.suites ?? [] ) {
		failures.push( ...findFailures( child, path ) );
	}
	return failures;
}

function readFailures( file ) {
	try {
		const report = JSON.parse( readFileSync( file, 'utf8' ) );
		return ( report.suites ?? [] ).flatMap( ( suite ) =>
			findFailures( suite )
		);
	} catch {
		return null;
	}
}

const STEP_NAMES = {
	BUILD: 'Build',
	START: 'Start wp-env',
	PHP: 'PHPUnit',
	E2E: 'End-to-end tests',
};

/**
 * The issue's body.
 *
 * @param {Object}    run
 * @param {string}    run.name     Gutenberg's name, with its version.
 * @param {string}    run.version  The version tested.
 * @param {string}    run.runUrl   The workflow run.
 * @param {Object}    run.steps    Each step's outcome, by STEP_NAMES key.
 * @param {?Object[]} run.failures Failing tests, or null without a report.
 * @return {string} Markdown.
 */
export function formatReport( { name, version, runUrl, steps, failures } ) {
	const lines = [
		`${ name } fails Create Not Learn's compatibility checks.`,
		'',
		`- Run: ${ runUrl }`,
		`- Gutenberg: \`${ version }\``,
		'',
		'### Steps',
		'',
	];

	for ( const [ key, label ] of Object.entries( STEP_NAMES ) ) {
		const outcome = steps[ key ] || 'skipped';
		lines.push(
			`- ${ { success: '✅', skipped: '➖' }[ outcome ] ?? '❌' } ${ label }: ${ outcome }`
		);
	}

	lines.push( '', '### Failing tests', '' );
	if ( failures === null ) {
		lines.push(
			steps.E2E === 'success'
				? 'None.'
				: 'No end-to-end report: the tests did not run, or did not finish.'
		);
	} else if ( ! failures.length ) {
		lines.push( 'None.' );
	} else {
		for ( const failure of failures ) {
			lines.push(
				`- \`${ failure.file }:${ failure.line }\` ${ failure.title }` +
					( failure.error ? `\n  > ${ failure.error }` : '' )
			);
		}
	}

	lines.push(
		'',
		'Each failing run adds a comment here. Close this issue once the editor works with this version again.'
	);
	return lines.join( '\n' );
}

function main() {
	const [ resultsFile ] = process.argv.slice( 2 );
	const steps = Object.fromEntries(
		Object.keys( STEP_NAMES ).map( ( key ) => [
			key,
			process.env[ `STEP_${ key }` ],
		] )
	);

	console.log(
		formatReport( {
			name: process.env.GUTENBERG_NAME || 'Gutenberg',
			version: process.env.GUTENBERG_VERSION || 'unknown',
			runUrl: process.env.RUN_URL || '',
			steps,
			failures: resultsFile ? readFailures( resultsFile ) : null,
		} )
	);
}

if ( import.meta.url === `file://${ process.argv[ 1 ] }` ) {
	main();
}
