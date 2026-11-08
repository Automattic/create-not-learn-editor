/**
 * One quick pass through every main screen, to catch the editor failing to
 * load at all. The views and interactions folders test each screen properly.
 */
const {
	expect,
	expectBlockEditor,
	getRoute,
	getPageItem,
	getSitePreview,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( './utils' );

test( 'every main screen loads without errors', async ( { page, rest } ) => {
	const errors = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );

	const testPage = await rest.createPage();
	const stage = getStage( page );

	await test.step( 'Home', async () => {
		await visitEditor( page );
		await expect(
			page.getByRole( 'heading', { level: 1, name: 'Home' } )
		).toBeVisible();
		await expect( getSitePreview( page ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );

	await test.step( 'Pages', async () => {
		await openSidebarLink( page, 'Pages' );
		await expect( getPageItem( page, testPage.title ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );

	await test.step( 'Menus', async () => {
		await openSidebarLink( page, 'Menus' );
		await expect.poll( () => getRoute( page ) ).toMatch( /^\/navigation/ );
		await expect(
			// Exact, as "All menus" is a heading too.
			stage.getByRole( 'heading', { name: 'Menus', exact: true } )
		).toBeVisible( { timeout: 15000 } );
	} );

	for ( const [ link, heading ] of [
		[ 'Colors', 'Colors' ],
		[ 'Fonts', 'Fonts' ],
		[ 'Site Identity', 'Name & logo' ],
	] ) {
		await test.step( `Sidebar › ${ link }`, async () => {
			await openSidebarLink( page, link );
			await expect(
				stage.getByRole( 'heading', { name: heading } )
			).toBeVisible();
		} );
	}

	for ( const [ link, heading, list ] of [
		// Gutenberg's own templates list, without the editor's stage class.
		[ 'Templates', 'Templates', page.locator( '.template-page' ) ],
		[ 'Site parts', 'Site parts', stage ],
		[ 'Patterns', 'Patterns', stage ],
	] ) {
		await test.step( `Sidebar › ${ link }`, async () => {
			await openSidebarLink( page, link );
			await expect(
				list.getByRole( 'heading', { name: heading } )
			).toBeVisible();
			await expect(
				list.locator( '.dataviews-view-grid, .dataviews-view-list' )
			).toBeVisible( { timeout: 15000 } );
		} );
	}

	await test.step( 'Block editor', async () => {
		await visitEditor( page, `/types/page/edit/${ testPage.id }` );
		await expectBlockEditor( page );
	} );

	expect( errors ).toEqual( [] );
} );
