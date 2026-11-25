#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'error', 'log' ] } ] */
/**
 * Make the editor's translation template, and the JSON its script modules
 * load, with WP-CLI's `i18n` commands. Run `npm run i18n -- --help`.
 *
 * The template is made from the built plugin, not `src/`, so each string
 * points at the module file it ships in. WordPress finds a module's JSON by
 * the md5 of that path, so the files `make-json` writes are the ones it reads.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const DOMAIN = 'create-not-learn-editor';
const FIXTURE = 'tests/e2e/fixtures/mu-plugins/cnl-e2e-languages';

// What the plugin zip ships with strings in it. Excluding the source folders
// instead would leave out `build/routes` too, as WP-CLI matches folder names
// at any depth.
const INCLUDE = 'build,includes,create-not-learn-editor.php';
// The minified modules hold the same strings as the unminified ones.
const EXCLUDE = '*.min.js';

const HELP = `Usage: npm run i18n -- <command> [dir]

  pot [dir]    Write languages/${ DOMAIN }.pot from the built plugin in dir,
               the repository by default or an unzipped plugin-zip. Run
               npm run build first.
  json <dir>   Write the JSON for the script modules from the .po files in
               dir, beside them, keeping the .po files.
  fixture      Remake the e2e test locale's JSON (${ FIXTURE }).

Needs WP-CLI (wp) on the PATH.`;

/**
 * Run WP-CLI. Parsing the editor's modules needs more memory than PHP's
 * default, so a phar is run through PHP with no limit.
 *
 * @param {string[]} args Arguments for wp.
 * @param {string}   cwd  Where to run it.
 */
function wp( args, cwd = ROOT ) {
	let bin;
	try {
		bin = realpathSync(
			execFileSync( 'which', [ 'wp' ], { encoding: 'utf8' } ).trim()
		);
	} catch {
		console.error( 'WP-CLI (wp) was not found on the PATH.' );
		process.exit( 1 );
	}

	const isPhar = readFileSync( bin, 'utf8' ).slice( 0, 40 ).includes( 'php' );
	const [ command, ...rest ] = isPhar
		? [ 'php', '-d', 'memory_limit=-1', bin, ...args ]
		: [ bin, ...args ];

	execFileSync( command, rest, { cwd, stdio: 'inherit' } );
}

const [ command, dir ] = process.argv.slice( 2 );

switch ( command ) {
	case 'pot': {
		const source = path.resolve( dir || ROOT );
		wp(
			[
				'i18n',
				'make-pot',
				source,
				path.join( ROOT, 'languages', `${ DOMAIN }.pot` ),
				`--domain=${ DOMAIN }`,
				`--slug=${ DOMAIN }`,
				`--include=${ INCLUDE }`,
				`--exclude=${ EXCLUDE }`,
			],
			source
		);
		break;
	}
	case 'json':
		if ( ! dir ) {
			console.error( HELP );
			process.exit( 1 );
		}
		wp( [ 'i18n', 'make-json', path.resolve( dir ), '--no-purge' ] );
		break;
	case 'fixture':
		wp( [
			'i18n',
			'make-json',
			path.join( ROOT, FIXTURE ),
			'--no-purge',
			'--pretty-print',
		] );
		break;
	default:
		console.log( HELP );
		process.exit( command && command !== '--help' ? 1 : 0 );
}
