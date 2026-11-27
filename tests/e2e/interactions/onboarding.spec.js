const {
	expect,
	getPublishButton,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

const TIP = 'Publish your site-wide changes';
const EDIT_TIP = 'Want to change something?';

/**
 * Open a new page on view in the canvas, as visitors see it.
 *
 * @param {import('@playwright/test').Page}      page
 * @param {import('./../utils/rest').RestClient} rest
 * @return {Promise<import('@playwright/test').Locator>} Its words.
 */
async function browsePage( page, rest ) {
	const testPage = await rest.createPage( {
		body: 'Fresh bread every morning from the oven by the door.',
	} );

	await visitEditor(
		page,
		`/types/page/list/all?previewId=${ testPage.id }`
	);

	const words = page
		.frameLocator( 'iframe[title="Site preview"]' )
		.getByText( testPage.body );
	await expect( words ).toBeVisible( { timeout: 15000 } );

	return words;
}

/**
 * Click a page's words as if to change them: on the start of the line, as
 * the space round words doesn't count.
 *
 * @param {import('@playwright/test').Locator} words
 */
async function clickWords( words ) {
	await words.click( { position: { x: 8, y: 8 } } );
}

/**
 * Change the site's name on Name & logo, a change only Publish saves.
 *
 * @param {import('@playwright/test').Page} page
 */
async function changeSiteName( page ) {
	await visitEditor( page, '/design/identity' );

	const field = getStage( page ).getByLabel( 'Site name' );
	await field.fill( `Hints ${ Date.now() }` );
	await expect( getPublishButton( page ) ).toBeEnabled();
}

/**
 * Read the editor's own preferences as they're saved for the user.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @return {Promise<Object>} The `create-not-learn-editor` scope.
 */
async function getSavedPreferences( rest ) {
	const user = await rest.fetch( '/wp/v2/users/me', {
		params: { context: 'edit' },
	} );

	return user.meta?.persisted_preferences?.[ 'create-not-learn-editor' ];
}

test.describe( 'Onboarding hints', () => {
	// Global setup turns hints off for every other test.
	test.beforeEach( async ( { rest } ) => {
		await rest.setEditorPreferences( {
			onboardingSeen: [],
			showHints: true,
			workspace: 'simple',
		} );
	} );

	test( 'points at Publish once the first site-wide change is left a moment, and only once', async ( {
		page,
		rest,
	} ) => {
		await changeSiteName( page );

		const tip = page.getByRole( 'dialog', { name: TIP } );
		await expect( tip ).toBeVisible( { timeout: 10000 } );

		await tip.getByRole( 'button', { name: 'Got it' } ).click();
		await expect( tip ).toBeHidden();
		await expect
			.poll(
				async () =>
					( await getSavedPreferences( rest ) )?.onboardingSeen
			)
			.toContain( 'publish-site-wide' );

		await page.reload();
		await changeSiteName( page );
		await page.waitForTimeout( 4000 );
		await expect( tip ).toBeHidden();
	} );

	test( 'points at Publish straight away on leaving the screen with the change', async ( {
		page,
	} ) => {
		await changeSiteName( page );
		await getStage( page ).getByRole( 'button', { name: 'Back' } ).click();

		// Sooner than waiting for a pause would bring it.
		await expect( page.getByRole( 'dialog', { name: TIP } ) ).toBeVisible( {
			timeout: 2000,
		} );
	} );

	test( 'turns every hint off from the tip', async ( { page, rest } ) => {
		await changeSiteName( page );

		const tip = page.getByRole( 'dialog', { name: TIP } );
		await expect( tip ).toBeVisible( { timeout: 10000 } );

		await tip
			.getByRole( 'checkbox', { name: /show hints like these/ } )
			.check();
		await tip.getByRole( 'button', { name: 'Got it' } ).click();

		await expect
			.poll(
				async () => ( await getSavedPreferences( rest ) )?.showHints
			)
			.toBe( false );
	} );

	test( 'shows no hints in Builder', async ( { page, rest } ) => {
		await rest.setEditorPreferences( { workspace: 'builder' } );
		await changeSiteName( page );

		await page.waitForTimeout( 4000 );
		await expect( page.getByRole( 'dialog', { name: TIP } ) ).toBeHidden();
	} );

	test( 'points at Edit the first time the page’s words are clicked in Browse, then only pulses it', async ( {
		page,
		rest,
	} ) => {
		const words = await browsePage( page, rest );
		const tip = page.getByRole( 'dialog', { name: EDIT_TIP } );
		const edit = page.locator( '.cnl-site-canvas__edit' );

		await clickWords( words );
		await expect( tip ).toBeVisible();
		await tip.getByRole( 'button', { name: 'Got it' } ).click();
		await expect( tip ).toBeHidden();

		await clickWords( words );
		await expect( edit ).toHaveClass( /is-pulsing/ );
		await expect( tip ).toBeHidden();
	} );

	test( 'only pulses Edit in Builder', async ( { page, rest } ) => {
		await rest.setEditorPreferences( { workspace: 'builder' } );
		const words = await browsePage( page, rest );

		await clickWords( words );
		await expect( page.locator( '.cnl-site-canvas__edit' ) ).toHaveClass(
			/is-pulsing/
		);
		await expect(
			page.getByRole( 'dialog', { name: EDIT_TIP } )
		).toBeHidden();
	} );

	test( 'never points at Edit for someone who has clicked it', async ( {
		page,
		rest,
	} ) => {
		await browsePage( page, rest );
		await page.locator( '.cnl-site-canvas__edit' ).click();

		await expect
			.poll(
				async () =>
					( await getSavedPreferences( rest ) )?.onboardingSeen
			)
			.toContain( 'edit-from-browse' );
	} );
} );
