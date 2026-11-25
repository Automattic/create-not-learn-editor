const { editorUrl, expect, test } = require( '../utils' );

const PASSWORD = 'author-password';

/*
 * The screens that change the whole site, which an Author can't use. Each
 * explains itself rather than opening.
 */
const GATED_ROUTES = [
	'/design',
	'/design/colors',
	'/design/identity',
	'/site-parts',
	'/site-parts/header',
	'/navigation',
	'/patterns',
	'/template-parts',
	'/site-overview',
	'/styles',
	'/templates/list/all',
	'/types/page/list/all',
	'/types/post/list/all?content=templates',
];

const GATED_MENU_ITEMS = [
	'Pages',
	'Site overview',
	'Site parts',
	'Menus',
	'Name & logo',
	'Colors',
	'Fonts',
];

test.describe( 'An Author', () => {
	let author;
	let authorPage;
	const errors = [];

	test.beforeAll( async ( { browser, baseURL } ) => {
		const adminPage = await browser.newPage();
		await adminPage.goto( '/wp-admin/' );
		const nonce = await adminPage.evaluate( () =>
			fetch( '/wp-admin/admin-ajax.php?action=rest-nonce' ).then(
				( response ) => response.text()
			)
		);
		const response = await adminPage.request.post( '/wp-json/wp/v2/users', {
			data: {
				email: `author-${ Date.now() }@example.com`,
				password: PASSWORD,
				roles: [ 'author' ],
				username: `author-${ Date.now() }`,
			},
			headers: { 'X-WP-Nonce': nonce },
		} );
		author = { ...( await response.json() ), nonce };
		await adminPage.close();

		// A session of their own, not the admin's.
		const context = await browser.newContext( {
			baseURL,
			storageState: { cookies: [], origins: [] },
		} );
		authorPage = await context.newPage();
		authorPage.on( 'pageerror', ( error ) => errors.push( error.message ) );
		await authorPage.goto( '/wp-login.php' );
		await authorPage
			.getByLabel( 'Username or Email Address' )
			.fill( author.username );
		await authorPage
			.getByLabel( 'Password', { exact: true } )
			.fill( PASSWORD );
		await authorPage.getByRole( 'button', { name: 'Log In' } ).click();
		await authorPage.waitForURL( /wp-admin/ );
	} );

	test.afterAll( async ( { browser } ) => {
		await authorPage?.context().close();

		if ( author?.id ) {
			const adminPage = await browser.newPage();
			await adminPage.request.delete(
				`/wp-json/wp/v2/users/${ author.id }`,
				{
					headers: { 'X-WP-Nonce': author.nonce },
					params: { force: true, reassign: 1 },
				}
			);
			await adminPage.close();
		}
	} );

	test( 'finds the editor in WP Admin’s menu', async () => {
		await authorPage.goto( '/wp-admin/' );

		await expect(
			authorPage
				.locator( '#adminmenu' )
				.getByRole( 'link', { name: 'Create Not Learn' } )
		).toBeVisible();
	} );

	test( 'starts in Writing, offered only what they can do, with only their content in the sidebar', async () => {
		await authorPage.goto( editorUrl() );

		await expect(
			authorPage.getByRole( 'button', { name: 'Workspace: Writing' } )
		).toBeVisible();
		const places = authorPage.getByRole( 'navigation', {
			name: 'Start working on your site',
		} );
		// Writing also offers Design and the homepage, which an Author can't
		// change.
		await expect( places.getByRole( 'button' ) ).toHaveCount( 2 );
		await expect(
			places.getByRole( 'button', { name: /^Write a post/ } )
		).toBeVisible();
		await expect(
			places.getByRole( 'button', { name: /^Posts/ } )
		).toBeVisible();
		// The site's own pages and settings aren't theirs to change.
		await expect(
			authorPage.getByRole( 'button', { name: /^Run your blog|^Set up/ } )
		).toHaveCount( 0 );
		for ( const name of [ 'Page options', 'Edit', /^Page settings/ ] ) {
			await expect(
				authorPage.getByRole( 'button', { name, exact: true } )
			).toHaveCount( 0 );
		}

		await expect(
			authorPage.getByRole( 'link', { name: 'Posts', exact: true } )
		).toBeVisible();
		for ( const name of GATED_MENU_ITEMS ) {
			await expect(
				authorPage.getByRole( 'link', { name, exact: true } )
			).toHaveCount( 0 );
		}
	} );

	test( 'opens the Posts list', async () => {
		await authorPage.goto( editorUrl( '/types/post/list/all' ) );

		await expect(
			authorPage.getByRole( 'heading', { name: 'Posts', level: 2 } )
		).toBeVisible();
		await expect(
			authorPage.getByRole( 'tab', { name: 'Layouts' } )
		).toHaveCount( 0 );
	} );

	test( 'is told a screen isn’t available, rather than shown it', async () => {
		for ( const route of GATED_ROUTES ) {
			await authorPage.goto( editorUrl( route ) );

			await expect(
				authorPage.getByText( 'You can’t open this' ),
				route
			).toBeVisible();
		}

		await authorPage.getByRole( 'button', { name: 'Go to Home' } ).click();
		await expect(
			authorPage.getByRole( 'navigation', {
				name: 'Start working on your site',
			} )
		).toBeVisible();

		expect( errors ).toEqual( [] );
	} );
} );
