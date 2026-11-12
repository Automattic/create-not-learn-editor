#!/usr/bin/env node
/**
 * Runs the PHPUnit suite in wp-env's tests-cli container.
 *
 * wp-env mounts the plugin under the checkout's directory name, which differs
 * between workspaces, so the path is worked out here. Composer's dev packages
 * are installed in the container the first time, into the checkout's
 * `vendor/`. Any arguments are passed on to PHPUnit.
 */
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);
const pluginDir = `wp-content/plugins/${ path.basename( repoRoot ) }`;

function run( command ) {
	const result = spawnSync(
		'node',
		[
			path.join( repoRoot, 'scripts/wp-env.mjs' ),
			'run',
			'tests-cli',
			`--env-cwd=${ pluginDir }`,
			...command,
		],
		{ cwd: repoRoot, stdio: 'inherit' }
	);
	if ( result.status !== 0 ) {
		process.exit( result.status ?? 1 );
	}
}

if ( ! existsSync( path.join( repoRoot, 'vendor/autoload.php' ) ) ) {
	run( [ 'composer', 'install', '--no-interaction', '--no-progress' ] );
}

run( [ 'vendor/bin/phpunit', ...process.argv.slice( 2 ) ] );
