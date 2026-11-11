const path = require( 'node:path' );
const { request } = require( '@playwright/test' );

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.WP_ADMIN_PASSWORD || 'password';

const STORAGE_STATE_PATH = path.join(
	__dirname,
	'..',
	'..',
	'artifacts',
	'storage-states',
	'admin.json'
);

/**
 * Where a site's session is saved. With several sites in WP_BASE_URLS, each
 * has its own, by its index in the list.
 *
 * @param {number} [index] The site's index in WP_BASE_URLS.
 * @return {string} The path.
 */
function getStorageStatePath( index ) {
	return index === undefined
		? STORAGE_STATE_PATH
		: STORAGE_STATE_PATH.replace( /\.json$/, `-${ index }.json` );
}

/**
 * Log in to a site and save its session.
 *
 * @param {string} baseURL   The site.
 * @param {string} statePath Where to save the session.
 */
async function logIn( baseURL, statePath ) {
	const context = await request.newContext( { baseURL } );

	// The login form refuses to log in without its test cookie.
	await context.get( '/wp-login.php' );
	const response = await context.post( '/wp-login.php', {
		form: {
			log: ADMIN_USER,
			pwd: ADMIN_PASSWORD,
			redirect_to: '/wp-admin/',
			testcookie: '1',
			'wp-submit': 'Log In',
		},
	} );

	if ( ! response.url().includes( '/wp-admin/' ) ) {
		throw new Error(
			`Logging in to ${ baseURL } as "${ ADMIN_USER }" failed. Check WP_ADMIN_USER and WP_ADMIN_PASSWORD.`
		);
	}

	await context.storageState( { path: statePath } );
	await context.dispose();
}

/**
 * Log in once for the whole run, and share the session cookies with every
 * test through `storageState`, so tests start on the page they are about.
 * With several sites in WP_BASE_URLS, as on CI, log in to each.
 *
 * @param {import('@playwright/test').FullConfig} config
 */
async function globalSetup( config ) {
	const sites = process.env.WP_BASE_URLS?.split( ',' );

	if ( sites ) {
		await Promise.all(
			sites.map( ( site, index ) =>
				logIn( site, getStorageStatePath( index ) )
			)
		);
		return;
	}

	await logIn( config.projects[ 0 ].use.baseURL, STORAGE_STATE_PATH );
}

module.exports = globalSetup;
module.exports.STORAGE_STATE_PATH = STORAGE_STATE_PATH;
module.exports.getStorageStatePath = getStorageStatePath;
