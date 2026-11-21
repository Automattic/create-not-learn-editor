/**
 * The reworked block toolbar in another language. Core's controls the toolbar
 * hides or moves have no class to find them by, so `core-labels.js` finds
 * them by their labels in the site's language. In German they read
 * differently, and if the toolbar matched them in English, core's controls
 * would show through.
 *
 * The site is switched to German for these tests and back afterwards, with
 * WordPress's and Gutenberg's German translations installed through wp-cli.
 */
const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	test,
	visitEditor,
} = require( '../utils' );

const LOCALE = 'de_DE';
const ROOT = path.join( __dirname, '..', '..', '..' );

/**
 * Run wp-cli commands on the tests site, in one go, as each `wp-env run`
 * starts a container of its own.
 *
 * @param {string[]} commands wp-cli commands, without `wp`.
 */
function wp( commands ) {
	execFileSync(
		process.execPath,
		[
			'scripts/wp-env.mjs',
			'run',
			'tests-cli',
			'sh',
			'-c',
			commands.map( ( command ) => `wp ${ command }` ).join( ' && ' ),
		],
		{ cwd: ROOT, stdio: [ 'ignore', 'pipe', 'pipe' ] }
	);
}

const TEXT = 'Ein Absatz zum Formatieren';

/**
 * Core's strings, translated in the editor as core translates them.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<Object>} Labels, in the site's language.
 */
function getLabels( page ) {
	return page.evaluate( () => {
		const { __, _x } = window.wp.i18n;

		return {
			alignText: __( 'Align text' ),
			bold: __( 'Bold' ),
			group: _x( 'Group', 'verb' ),
			createPattern: __( 'Create pattern' ),
		};
	} );
}

test.describe( 'Block toolbar in German', () => {
	test.beforeAll( () => {
		test.setTimeout( 180000 );
		wp( [
			`language core install ${ LOCALE }`,
			`language plugin install gutenberg ${ LOCALE }`,
			`site switch-language ${ LOCALE }`,
		] );
	} );

	// The rest of the suite reads the tests site in English.
	test.afterAll( () => {
		test.setTimeout( 120000 );
		wp( [ 'site switch-language en_US' ] );
	} );

	test.beforeEach( async ( { page, rest } ) => {
		const { id } = await rest.createPost( {
			// Two, so the first can move down.
			content: [ TEXT, 'Noch ein Absatz' ]
				.map(
					( words ) =>
						`<!-- wp:paragraph --><p>${ words }</p><!-- /wp:paragraph -->`
				)
				.join( '' ),
		} );

		await visitEditor( page, `/types/post/edit/${ id }` );
		await expectBlockEditor( page );

		const paragraph = getEditorCanvas( page ).getByText( TEXT );

		await expect( paragraph ).toBeVisible( { timeout: 15000 } );
		await paragraph.click();
		await expect(
			page.locator( '.block-editor-block-contextual-toolbar' )
		).toBeVisible();
	} );

	test( 'reads core in German', async ( { page } ) => {
		const labels = await getLabels( page );

		// Otherwise the tests below would pass in English. (German keeps
		// core's "Bold".)
		expect( labels.alignText ).not.toBe( 'Align text' );
		expect( labels.group ).not.toBe( 'Group' );
		expect( labels.createPattern ).not.toBe( 'Create pattern' );
		await expect( page.locator( 'html' ) ).toHaveAttribute( 'lang', /^de/ );
	} );

	test( 'moves core’s style controls out of the toolbar', async ( {
		page,
	} ) => {
		const { alignText } = await getLabels( page );
		const toolbar = page.locator(
			'.block-editor-block-contextual-toolbar'
		);

		await expect(
			toolbar.locator( '.cnl-block-options__toggle' )
		).toBeVisible();
		await expect(
			toolbar.getByRole( 'button', { name: alignText, exact: true } )
		).toBeHidden();
	} );

	test( 'shows formatting only with text selected', async ( { page } ) => {
		const { bold } = await getLabels( page );
		const toolbar = page.locator(
			'.block-editor-block-contextual-toolbar'
		);
		const boldButton = toolbar.getByRole( 'button', {
			name: bold,
			exact: true,
		} );

		await expect( boldButton ).toBeHidden();

		// Select the paragraph's words from the keyboard.
		await page.keyboard.press( 'End' );
		await page.keyboard.press( 'Shift+Home' );

		await expect( boldButton ).toBeVisible();
		await expect(
			toolbar.locator( '[data-cnl-format="floating"]' )
		).toBeVisible();
	} );

	test( 'puts core’s Group and Create pattern at the top of Options', async ( {
		page,
	} ) => {
		const { group, createPattern } = await getLabels( page );

		await page
			.locator(
				'.block-editor-block-contextual-toolbar .cnl-block-options__toggle'
			)
			.click();

		// The options menu's top level, rather than More's flyout.
		const menu = page.locator( '.cnl-block-options' );

		await expect(
			menu.getByRole( 'menuitem', { name: group, exact: true } )
		).toBeVisible();
		await expect(
			menu.getByRole( 'menuitem', { name: createPattern, exact: true } )
		).toBeVisible();
	} );

	test( 'draws the movers’ arrows', async ( { page } ) => {
		const arrow = await page
			.locator(
				'.block-editor-block-contextual-toolbar .block-editor-block-mover-button.is-down-button'
			)
			.evaluate(
				( button ) =>
					window.getComputedStyle( button, '::after' ).maskImage
			);

		expect( arrow ).toContain( 'svg' );
	} );
} );
