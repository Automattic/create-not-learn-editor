/**
 * The site canvas beside Home, Pages and Design: its Browse, Edit and Compose
 * modes, the preview's history, the full editor, devices and the More options
 * menu. Compose has its own file.
 */
const {
	expect,
	expectBlockEditor,
	expectCanvasMode,
	getCanvasEditor,
	getBrowseSwitch,
	getZoomOutToggle,
	getRoute,
	getSitePreview,
	openSidebarLink,
	openViewMenu,
	pickCanvasMode,
	clickIntoSection,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Site canvas interactions', () => {
	test( 'Browse shows the site as visitors see it, and Edit switches to the editor', async ( {
		page,
	} ) => {
		await visitEditor( page );
		// The canvas opens in Edit.
		await expectCanvasMode( page, 'Edit' );
		await setCanvasMode( page, 'Browse' );

		const preview = getSitePreview( page );
		const frame = page.frameLocator( 'iframe[title="Site preview"]' );

		await expect( preview ).toHaveAttribute(
			'src',
			/cnl-editor-preview=1/
		);
		await expect( frame.locator( 'body' ) ).toBeVisible();
		await expect( frame.locator( '#wpadminbar' ) ).toHaveCount( 0 );
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toBeVisible();

		await setCanvasMode( page, 'Edit' );
		await expect( preview ).toBeHidden();
		await expect( getCanvasEditor( page ) ).toBeVisible();
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toHaveCount( 0 );

		await setCanvasMode( page, 'Browse' );
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toBeVisible();
	} );

	test( 'Browse is a switch; Compose is offered while editing a page', async ( {
		page,
		rest,
	} ) => {
		// Only pages have sections to compose, not the posts list's layout.
		const testPage = await rest.createPage();

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );

		const browseSwitch = getBrowseSwitch( page );
		const zoomOut = getZoomOutToggle( page );

		await setCanvasMode( page, 'Browse' );
		await expect( browseSwitch ).toBeChecked();
		await expect( zoomOut ).toHaveCount( 0 );

		await setCanvasMode( page, 'Edit' );
		await expect( zoomOut ).toBeVisible( { timeout: 15000 } );
		await expect( zoomOut ).toHaveAttribute( 'aria-pressed', 'false' );

		// Compose is editing from further away: Browse stays off.
		await zoomOut.click();
		await expectCanvasMode( page, 'Compose' );
		await expect( browseSwitch ).not.toBeChecked();

		// Escape, with nothing picked, steps back in to Edit.
		await page.keyboard.press( 'Escape' );
		await expectCanvasMode( page, 'Edit' );
	} );

	test( 'the mode carries over to another screen, but not a reload', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await setCanvasMode( page, 'Browse' );

		await openSidebarLink( page, 'Pages' );
		await expect.poll( () => getRoute( page ) ).toMatch( /^\/types\/page/ );
		await expectCanvasMode( page, 'Browse' );

		await page.reload();
		await expectCanvasMode( page, 'Edit' );
	} );

	test( 'leaving Edit with unsaved changes asks to save them', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );
		await setCanvasMode( page, 'Edit' );

		const paragraph = getCanvasEditor( page )
			.contentFrame()
			.getByText( testPage.body );

		await clickIntoSection( page, paragraph );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );

		await pickCanvasMode( page, 'Browse' );

		const dialog = page.getByRole( 'dialog', {
			name: 'Save your changes?',
		} );

		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Discard' } ).click();
		await expectCanvasMode( page, 'Browse' );
		await expect(
			page
				.frameLocator( 'iframe[title="Site preview"]' )
				.getByText( testPage.body, { exact: true } )
		).toBeVisible();
	} );

	test( 'switches the canvas between desktop, tablet and mobile', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const preview = page.locator( '.cnl-site-canvas__preview' );

		for ( const device of [ 'Mobile', 'Tablet', 'Desktop' ] ) {
			const menu = await openViewMenu( page );

			await menu
				.getByRole( 'menuitemradio', { name: new RegExp( device ) } )
				.click();
			await expect( preview ).toHaveClass(
				new RegExp( `is-${ device.toLowerCase() }` )
			);
			// As in core's, the menu stays open to compare them.
			await expect(
				menu.getByRole( 'menuitemradio', {
					name: new RegExp( device ),
				} )
			).toBeChecked();
		}
	} );

	test( 'follows links in the preview, and back again', async ( {
		page,
		rest,
	} ) => {
		const target = await rest.createPage( {
			title: `Preview target ${ Date.now() }`,
		} );
		const source = await rest.createPage( {
			content: `<!-- wp:paragraph --><p><a href="${ target.link }">Preview target link</a></p><!-- /wp:paragraph -->`,
			title: `Preview source ${ Date.now() }`,
		} );

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ source.id }`
		);

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const title = toolbar.locator( '.cnl-editor-homepage-document__title' );
		const meta = toolbar.locator( '.cnl-editor-homepage-document__meta' );
		const back = toolbar.getByRole( 'button', { name: 'Back in preview' } );
		const frame = page.frameLocator( 'iframe[title="Site preview"]' );

		await expect( title ).toHaveText( source.title, { timeout: 15000 } );
		await setCanvasMode( page, 'Browse' );
		await expect( title ).toHaveText( source.title );
		await expect( meta ).toHaveText( 'Page · Published' );
		await expect( back ).toBeDisabled();

		await frame
			.getByRole( 'link', { name: 'Preview target link' } )
			.click();

		await expect( title ).toHaveText( target.title, { timeout: 15000 } );
		await expect( frame.locator( '#wpadminbar' ) ).toHaveCount( 0 );
		await expect( back ).toBeEnabled();

		await back.click();
		await expect( title ).toHaveText( source.title, { timeout: 15000 } );
	} );

	test( 'offers homepage options for the homepage', async ( { page } ) => {
		await visitEditor( page );

		await page.getByRole( 'button', { name: 'Page options' } ).click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Manage homepage' } )
		).toBeVisible();
	} );

	test( 'Options opens the page in the full-screen editor', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const openFull = page.getByRole( 'menuitem', {
			name: 'Open in advanced editor',
		} );

		// It's in the top bar's Options menu; the canvas has no menu of its own.
		await expect(
			page
				.locator( '.cnl-editor-homepage-toolbar' )
				.getByRole( 'button', { name: 'More options' } )
		).toHaveCount( 0 );
		await page
			.getByRole( 'button', { name: 'Options', exact: true } )
			.click();
		await expect( openFull ).toBeEnabled( { timeout: 15000 } );
		await openFull.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			// A page, or the layout on a site without a static homepage.
			.toMatch( /^\/(types\/page\/edit\/\d+|wp_template\?postId=.+)$/ );
		await expectBlockEditor( page );
	} );

	test( 'the View menu opens the site in a new tab', async ( {
		context,
		page,
	} ) => {
		await visitEditor( page );

		await page.getByRole( 'button', { name: 'View', exact: true } ).click();
		const [ tab ] = await Promise.all( [
			context.waitForEvent( 'page' ),
			page.getByRole( 'menuitem', { name: 'Open in a new tab' } ).click(),
		] );

		await tab.waitForLoadState();
		expect(
			new URL( tab.url() ).searchParams.has( 'cnl-editor-preview' )
		).toBe( false );
		await expect( tab.locator( 'body' ) ).toBeVisible();
	} );
} );
