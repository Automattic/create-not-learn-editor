/**
 * The full-width lists of templates, site parts and patterns.
 */
const {
	expect,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Advanced views', () => {
	test.beforeEach( async ( { page } ) => {
		await visitEditor( page );
	} );

	test( 'lists templates full width, as Gutenberg does', async ( {
		page,
	} ) => {
		await openSidebarLink( page, 'Templates' );
		await expect( page ).toHaveURL( /p=%2Ftemplates%2Flist%2Fall/ );

		// Gutenberg's own screen, without the editor's stage class.
		const stage = page.locator( '.template-page' );

		await expect(
			stage.getByRole( 'heading', { name: 'Templates' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Add Template' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'lists Site parts full width, by area', async ( { page } ) => {
		await openSidebarLink( page, 'Site parts' );
		await expect( page ).toHaveURL( /p=%2Ftemplate-parts/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Site parts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All', exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Headers' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'lists Patterns full width, by source', async ( { page } ) => {
		await openSidebarLink( page, 'Patterns' );
		await expect( page ).toHaveURL( /p=%2Fpatterns/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Patterns' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All patterns' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Saved by you' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );
} );
