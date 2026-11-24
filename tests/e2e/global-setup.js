const path = require( 'node:path' );
const { chromium, request } = require( '@playwright/test' );
const { RestClient } = require( './utils/rest' );

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
 * Log in, and save the session for tests and `npm run ui` to share.
 *
 * @param {string} baseURL The site.
 */
async function logIn( baseURL ) {
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
			`Logging in as "${ ADMIN_USER }" failed. Check WP_ADMIN_USER and WP_ADMIN_PASSWORD.`
		);
	}

	await context.storageState( { path: STORAGE_STATE_PATH } );
	await context.dispose();
}

/**
 * Log in once for the whole run, and share the session cookies with every
 * test through `storageState`, so tests start on the page they are about.
 * Then warm the editor up.
 *
 * @param {import('@playwright/test').FullConfig} config
 */
async function globalSetup( config ) {
	const { baseURL } = config.projects[ 0 ].use;

	await logIn( baseURL );
	await hideHints( baseURL );
	await warmUp( baseURL );
}

/**
 * Turn the editor's hints off for the run (`src/onboarding/`). A hint dims
 * the editor and catches clicks, so one turning up after a change would get
 * in the way of tests about something else. `onboarding.spec.js` turns them
 * on for itself.
 *
 * @param {string} baseURL The site.
 */
async function hideHints( baseURL ) {
	const context = await request.newContext( {
		baseURL,
		storageState: STORAGE_STATE_PATH,
	} );

	try {
		await new RestClient( context ).setEditorPreferences( {
			showHints: false,
		} );
	} finally {
		await context.dispose();
	}
}

/**
 * Load the editor once before any test, and open Add page, so the first test
 * doesn't spend its time on a fresh site's first, slow loads. Best effort: a
 * problem here is left for the tests to report.
 *
 * @param {string} baseURL The site.
 */
async function warmUp( baseURL ) {
	const browser = await chromium.launch();

	try {
		const page = await browser.newPage( {
			baseURL,
			storageState: STORAGE_STATE_PATH,
		} );

		await page.goto(
			'/wp-admin/admin.php?page=create-not-learn-editor&p=%2Ftypes%2Fpage'
		);
		await page
			.locator( 'iframe[name="editor-canvas"]' )
			.first()
			.waitFor( { timeout: 60000 } );
		await page
			.locator( '.cnl-editor-stage' )
			.getByRole( 'button', { name: 'Add page' } )
			.click( { timeout: 30000 } );

		const pageItem = page.getByRole( 'menuitem', { name: /^Page/ } );
		const dialog = page.getByRole( 'dialog', { name: 'Add a page' } );

		await pageItem.or( dialog ).first().waitFor( { timeout: 60000 } );
		if ( await pageItem.isVisible() ) {
			await pageItem.click();
		}
		await dialog
			.locator( '.cnl-add-page-layout-card' )
			.first()
			.waitFor( { timeout: 60000 } );
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.warn(
			`Warming up the editor didn't finish: ${ error.message }`
		);
	} finally {
		await browser.close();
	}
}

module.exports = globalSetup;
module.exports.STORAGE_STATE_PATH = STORAGE_STATE_PATH;
module.exports.logIn = logIn;
