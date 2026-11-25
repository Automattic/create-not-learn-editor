/**
 * The site canvas beside Home, Pages and Design: the page on view, Edit and
 * Exit, Compose, the preview's history, the full editor, devices and the More
 * options menu. Compose has its own file.
 */
const {
	expect,
	expectBlockEditor,
	expectCanvasMode,
	getCanvasEditor,
	getEditButton,
	getExitButton,
	getRoute,
	getSaveControls,
	getZoomOutToggle,
	getSitePreview,
	openViewMenu,
	clickIntoSection,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Site canvas interactions', () => {
	test( 'opens the site on view as visitors see it, and Edit switches to the editor', async ( {
		page,
	} ) => {
		await visitEditor( page );
		// The canvas opens with the page on view.
		await expectCanvasMode( page, 'Browse' );

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

	test( 'Edit fills the editor and gives way to Exit and Save, and Exit puts the sidebar back', async ( {
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

		const body = page.locator( 'body' );
		const zoomOut = getZoomOutToggle( page );

		await expectCanvasMode( page, 'Browse' );
		await expect( getEditButton( page ) ).toBeVisible();
		await expect( getExitButton( page ) ).toHaveCount( 0 );
		await expect( zoomOut ).toHaveCount( 0 );
		// Nothing to save yet, so no Save while on view.
		await expect( getSaveControls( page ) ).toBeHidden();
		await expect( body ).not.toHaveClass( /cnl-canvas-is-expanded/ );

		await setCanvasMode( page, 'Edit' );
		await expect( getEditButton( page ) ).toHaveCount( 0 );
		await expect( getExitButton( page ) ).toBeVisible();
		await expect( getSaveControls( page ) ).toBeVisible();
		await expect( body ).toHaveClass( /cnl-canvas-is-expanded/ );
		await expect( zoomOut ).toBeVisible( { timeout: 15000 } );
		await expect( zoomOut ).toHaveAttribute( 'aria-pressed', 'false' );

		// Compose is editing from further away: Exit stays.
		await zoomOut.click();
		await expectCanvasMode( page, 'Compose' );
		await expect( getExitButton( page ) ).toBeVisible();

		// Escape, with nothing picked, steps back in to Edit.
		await page.keyboard.press( 'Escape' );
		await expectCanvasMode( page, 'Edit' );

		await setCanvasMode( page, 'Browse' );
		await expect( getEditButton( page ) ).toBeVisible();
		await expect( body ).not.toHaveClass( /cnl-canvas-is-expanded/ );
	} );

	test( 'a reload opens the page on view again', async ( { page } ) => {
		await visitEditor( page );
		await setCanvasMode( page, 'Edit' );

		await page.reload();
		await expectCanvasMode( page, 'Browse' );
	} );

	test( 'Exit leaves without saving, discarding unsaved changes', async ( {
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

		await expect(
			getSaveControls( page ).getByRole( 'button', { name: /Save/ } )
		).toBeEnabled();

		// No asking: Exit is the way out without saving.
		await getExitButton( page ).click();
		await expect(
			page.getByRole( 'dialog', { name: 'Save your changes?' } )
		).toHaveCount( 0 );
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
		// The status is an icon, named in the bar's own name.
		const bar = toolbar.locator( '.cnl-page-switcher__toggle' );
		const back = toolbar.getByRole( 'button', { name: 'Back in preview' } );
		const frame = page.frameLocator( 'iframe[title="Site preview"]' );

		await expect( title ).toHaveText( source.title, { timeout: 15000 } );
		await setCanvasMode( page, 'Browse' );
		await expect( title ).toHaveText( source.title );
		await expect( bar ).toHaveAccessibleName(
			`${ source.title }, Published. Go to another page`
		);
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

	for ( const from of [ 'Home', 'a page on the Pages screen' ] ) {
		test( `going to another page from the switcher on ${ from } keeps the page on view`, async ( {
			page,
			rest,
		} ) => {
			const target = await rest.createPage( {
				title: `Switcher target ${ Date.now() }`,
			} );

			if ( from === 'Home' ) {
				await visitEditor( page );
			} else {
				const source = await rest.createPage( {
					title: `Switcher source ${ Date.now() }`,
				} );
				await visitEditor(
					page,
					`/types/page/list/all?postId=${ source.id }&previewId=${ source.id }`
				);
			}
			await expectCanvasMode( page, 'Browse' );

			const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );

			await toolbar.locator( '.cnl-page-switcher__toggle' ).click();
			await page.keyboard.type( target.title );
			await page.getByRole( 'option', { name: target.title } ).click();

			await expect(
				toolbar.locator( '.cnl-editor-homepage-document__title' )
			).toHaveText( target.title, { timeout: 15000 } );
			await expectCanvasMode( page, 'Browse' );
		} );
	}

	test( 'offers homepage options for the homepage', async ( { page } ) => {
		await visitEditor( page );

		await page.getByRole( 'button', { name: 'Page options' } ).click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Manage homepage' } )
		).toBeVisible();
	} );

	test( 'the View menu opens the page in the full-screen editor', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const openFull = page.getByRole( 'menuitem', {
			name: 'Open in advanced editor',
		} );

		// It's in the View menu; the canvas has no overflow menu of its own.
		await expect(
			page
				.locator( '.cnl-editor-homepage-toolbar' )
				.getByRole( 'button', { name: /^(More options|Options)$/ } )
		).toHaveCount( 0 );
		await page
			.locator( '.cnl-editor-homepage-toolbar' )
			.getByRole( 'button', { name: 'View', exact: true } )
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
