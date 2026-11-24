const {
	expect,
	getPublishButton,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

const TIP = 'Publish your site-wide changes';

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
} );
