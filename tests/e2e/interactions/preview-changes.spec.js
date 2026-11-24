/**
 * Unsaved changes in the site preview: Browse shows the site as it would be
 * once saved, without saving it.
 */
const {
	expect,
	expectCanvasMode,
	getSaveControls,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Unsaved changes in the preview', () => {
	test( 'Browse shows an unsaved site name, and visitors still see the saved one', async ( {
		page,
		rest,
	} ) => {
		const original = await rest.fetch( '/wp/v2/settings', {
			params: { _fields: 'title' },
		} );
		rest.onCleanup( () =>
			rest.fetch( '/wp/v2/settings', { data: original, method: 'POST' } )
		);

		const title = `Unsaved ${ Date.now() }`;

		await visitEditor( page, '/design/identity' );
		await getStage( page ).getByLabel( 'Site name' ).fill( title );
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);

		await openSidebarLink( page, 'Home' );
		await expectCanvasMode( page, 'Browse' );

		const preview = page.locator( 'iframe[title="Site preview"]' );

		await expect( preview ).toHaveAttribute( 'src', /cnl-editor-changes=/ );
		await expect(
			preview.contentFrame().getByText( title ).first()
		).toBeVisible( { timeout: 15000 } );

		// Nothing was saved: the site still has its old name.
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
		const saved = await rest.fetch( '/wp/v2/settings', {
			params: { _fields: 'title' },
		} );
		expect( saved.title ).toBe( original.title );

		// Without the editor's session, the page is the saved one.
		const response = await page.request.get( '/?cnl-editor-preview=1' );
		expect( await response.text() ).not.toContain( title );
	} );
} );
