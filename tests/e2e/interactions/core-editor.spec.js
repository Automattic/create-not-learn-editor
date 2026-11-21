const {
	expect,
	expectCanvasMode,
	getPageItem,
	pickCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// Mapped into the tests site by `.wp-env.json`. Adds a meta box to posts.
const META_BOX_PLUGIN = 'cnl-e2e-meta-box/cnl-e2e-meta-box';

test.describe( "Falling back to core's editor", () => {
	test.beforeEach( async ( { rest } ) => {
		await rest.fetch( `/wp/v2/plugins/${ META_BOX_PLUGIN }`, {
			method: 'PUT',
			data: { status: 'active' },
		} );
		rest.onCleanup( () =>
			rest.fetch( `/wp/v2/plugins/${ META_BOX_PLUGIN }`, {
				method: 'PUT',
				data: { status: 'inactive' },
			} )
		);
	} );

	test( "Content opens a post with a plugin's meta box in core's editor", async ( {
		page,
		rest,
	} ) => {
		const post = await rest.createPost( {
			content:
				'<!-- wp:paragraph --><p>Meta box post.</p><!-- /wp:paragraph -->',
		} );

		await visitEditor( page, '/types/post/list/all' );
		await page.getByText( post.title ).first().click();

		await expect( page ).toHaveURL(
			new RegExp(
				`/wp-admin/post\\.php\\?post=${ post.id }&action=edit`
			),
			{ timeout: 15000 }
		);
		await expect(
			page
				.locator( '.components-notice' )
				.getByText(
					'This post has extra settings from your plugins, so it opens in the full editor.'
				)
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '#cnl-e2e-event-details' ) ).toBeAttached();
	} );

	test( "a new post of a type with meta boxes starts in core's editor", async ( {
		page,
	} ) => {
		await visitEditor( page, '/types/post/new' );

		await expect( page ).toHaveURL(
			/\/wp-admin\/post-new\.php\?post_type=post/,
			{ timeout: 15000 }
		);
	} );

	test( 'a page without meta boxes still opens in the editor', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );
		await getPageItem( page, testPage.title ).click();
		await pickCanvasMode( page, 'Edit' );
		await expectCanvasMode( page, 'Edit' );

		await expect( page ).toHaveURL( /page=create-not-learn-editor/ );
	} );

	test( "the canvas's Edit opens a page the filter marks in core's editor", async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( {
			title: `Core editor page ${ Date.now() }`,
		} );

		await visitEditor( page, '/types/page' );
		await getPageItem( page, testPage.title ).click();
		await pickCanvasMode( page, 'Browse' );
		await pickCanvasMode( page, 'Edit' );

		await expect( page ).toHaveURL(
			new RegExp(
				`/wp-admin/post\\.php\\?post=${ testPage.id }&action=edit`
			),
			{ timeout: 15000 }
		);
	} );
} );
