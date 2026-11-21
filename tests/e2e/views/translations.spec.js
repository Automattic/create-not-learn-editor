/**
 * The editor's strings are translated from its own text domain, for its app
 * init module and its route modules alike.
 *
 * The tests site's `cnl-e2e-locale` mu-plugin (tests/e2e/fixtures/mu-plugins)
 * switches a request to German when it has the cookie set here, and reads the
 * editor's translations from the fixture beside it, with the file names a
 * language pack would have.
 */
const { expect, test, visitEditor } = require( '../utils' );

test.describe( 'Translations', () => {
	test.beforeEach( async ( { context, baseURL } ) => {
		await context.addCookies( [
			{ name: 'cnl_e2e_locale', url: baseURL, value: 'de_DE' },
		] );
	} );

	test( "shows the editor's strings in the site's language", async ( {
		page,
	} ) => {
		const errors = [];
		page.on( 'pageerror', ( error ) => errors.push( error.message ) );

		await visitEditor( page );

		// From the Home route's module.
		await expect(
			page.getByRole( 'navigation', {
				name: 'Arbeite an deiner Website',
			} )
		).toBeVisible( { timeout: 15000 } );
		// From app init's module.
		await expect(
			page.getByRole( 'button', { name: 'Seitenleiste ausklappen' } )
		).toBeVisible();
		// A string the fixture doesn't translate stays as it was.
		await expect(
			page.getByRole( 'heading', { level: 1, name: 'Home' } )
		).toBeVisible();

		expect( errors ).toEqual( [] );
	} );

	test( "falls back to core's translation of a string the editor's pack lacks", async ( {
		page,
	} ) => {
		await visitEditor( page );
		await expect(
			page.getByRole( 'navigation', {
				name: 'Arbeite an deiner Website',
			} )
		).toBeVisible( { timeout: 15000 } );

		const translated = await page.evaluate( () => {
			// Renamed, as these aren't the editor's strings but the page's i18n.
			const {
				__: translate,
				_n: translatePlural,
				_x: translateWithContext,
				setLocaleData,
			} = window.wp.i18n;
			const domain = 'create-not-learn-editor';

			// As core's language pack would have it.
			setLocaleData( {
				'Test only': [ 'Nur zum Testen' ],
				'item\u0004Test only': [ 'Element nur zum Testen' ],
				'%d test': [ '%d Test', '%d Tests' ],
				'Start working on your site': [ 'Core-Übersetzung' ],
			} );

			return [
				translate( 'Test only', domain ),
				translateWithContext( 'Test only', 'item', domain ),
				translatePlural( '%d test', '%d tests', 2, domain ),
				translate( 'Start working on your site', domain ),
			];
		} );

		expect( translated ).toEqual( [
			'Nur zum Testen',
			'Element nur zum Testen',
			'%d Tests',
			// The editor's own translation wins.
			'Arbeite an deiner Website',
		] );
	} );
} );
