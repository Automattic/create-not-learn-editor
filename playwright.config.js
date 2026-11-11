const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const { defineConfig } = require( '@playwright/test' );
const {
	STORAGE_STATE_PATH,
	getStorageStatePath,
} = require( './tests/e2e/global-setup' );

/*
 * With a comma-separated list of sites in WP_BASE_URLS, as CI starts with
 * `scripts/e2e-sites.sh`, each worker runs its tests on a site of its own, so
 * tests that share a site's data never run side by side on one. Playwright
 * loads this config in every worker, with the worker's index.
 */
const SITES = process.env.WP_BASE_URLS?.split( ',' );
const SITE_INDEX = Number( process.env.TEST_PARALLEL_INDEX ?? 0 );

function getBaseURL() {
	if ( SITES ) {
		return SITES[ SITE_INDEX ];
	}

	if ( process.env.WP_BASE_URL ) {
		return process.env.WP_BASE_URL;
	}

	if ( process.env.WP_ENV_TESTS_PORT ) {
		return `http://localhost:${ process.env.WP_ENV_TESTS_PORT }`;
	}

	try {
		const wpEnvBin = path.join(
			__dirname,
			'node_modules',
			'.bin',
			'wp-env'
		);
		const output = execFileSync( wpEnvBin, [ 'status', '--json' ], {
			cwd: __dirname,
			encoding: 'utf8',
		} );
		const status = JSON.parse( output );
		const port = status?.ports?.tests;

		if ( port ) {
			return `http://localhost:${ port }`;
		}
	} catch ( error ) {
		throw new Error(
			`Unable to determine the WordPress tests base URL. Start the wp-env tests environment or set WP_BASE_URL explicitly. ${ error.message }`
		);
	}

	throw new Error(
		'Unable to determine the WordPress tests base URL. Start the wp-env tests environment or set WP_BASE_URL explicitly.'
	);
}

module.exports = defineConfig( {
	testDir: './tests/e2e',
	globalSetup: require.resolve( './tests/e2e/global-setup' ),
	timeout: 60 * 1000,
	// Tests share a WordPress site's data, and running them side by side on
	// one makes the editor open pages empty now and then, so there is one
	// worker for each site.
	workers: SITES ? SITES.length : 1,
	// On CI, a test that fails is tried once more and reported as flaky if it
	// then passes, as the first editor load on a fresh site can be slow.
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: getBaseURL(),
		storageState: SITES
			? getStorageStatePath( SITE_INDEX )
			: STORAGE_STATE_PATH,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
} );
