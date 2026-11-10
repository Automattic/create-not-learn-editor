const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	getPageItem,
	getRoute,
	getSaveControls,
	getStage,
	openPageLayouts,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Pages interactions', () => {
	test( 'picking a page opens it on the canvas', async ( { page, rest } ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );
		await getPageItem( page, testPage.title ).click();

		await expect( page ).toHaveURL(
			new RegExp( `previewId%3D${ testPage.id }` )
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );
		await expect(
			getEditorCanvas( page, '.cnl-site-canvas' ).getByText(
				testPage.body
			)
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'a page opens into its summary, and Pages goes back', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();
		const stage = getStage( page );

		await visitEditor(
			page,
			`/types/page/list/all?postId=${ testPage.id }&previewId=${ testPage.id }`
		);

		await expect( page ).toHaveURL(
			new RegExp( `postId%3D${ testPage.id }` )
		);
		await expect(
			stage.getByRole( 'region', { name: 'About this page' } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			getEditorCanvas( page, '.cnl-site-canvas' ).getByText(
				testPage.body
			)
		).toBeAttached( { timeout: 15000 } );

		await stage
			.getByRole( 'navigation', { name: 'Breadcrumbs' } )
			.getByRole( 'link', { name: 'Pages' } )
			.click();
		await expect(
			stage.locator( '.cnl-pages-list-view' ).getByRole( 'treegrid' )
		).toBeVisible();
	} );

	test( 'a page switched off stays out of the menu, waiting to be saved', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();
		const menuSwitch = getStage( page ).getByRole( 'switch', {
			name: `Show ${ testPage.title } in your menu`,
		} );

		await visitEditor( page, '/types/page' );
		await expect( menuSwitch ).toBeChecked( { timeout: 15000 } );

		await menuSwitch.click();

		await expect( menuSwitch ).not.toBeChecked();
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);

		// Switched back on, the menu is as it was.
		await menuSwitch.click();
		await expect( menuSwitch ).toBeChecked();
	} );

	test( 'adding something other than a page opens the menu to add it', async ( {
		page,
	} ) => {
		await visitEditor( page, '/types/page' );
		// The menu has loaded once its switches show.
		await expect(
			getStage( page ).getByRole( 'switch' ).first()
		).toBeVisible( { timeout: 15000 } );
		await getStage( page )
			.getByRole( 'button', { name: 'Add page' } )
			.click( { timeout: 15000 } );
		await page
			.getByRole( 'menuitem', { name: /^Link or something else/ } )
			.click();

		// A menu that updates by itself asks first.
		const confirm = page.getByRole( 'dialog', {
			name: 'Customize your menu?',
		} );

		if ( await confirm.isVisible() ) {
			await confirm
				.getByRole( 'button', { name: 'Customize menu' } )
				.click();
		}

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/navigation\/edit\// );
		await expect(
			page.getByRole( 'dialog', { name: 'Add menu items' } )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'Other menus leads on to the Menus screen', async ( { page } ) => {
		await visitEditor( page, '/types/page' );

		const otherMenus = getStage( page )
			.getByRole( 'navigation', { name: 'More menu options' } )
			.getByRole( 'button', { name: /^Other menus/ } );

		await expect( otherMenus ).toBeVisible( { timeout: 15000 } );
		await otherMenus.click();
		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toBe( '/navigation' );
		await expect(
			getStage( page ).getByRole( 'heading', { name: 'Menus' } )
		).toBeVisible();
	} );

	test( 'renames a page from its options', async ( { page, rest } ) => {
		const testPage = await rest.createPage();
		const newTitle = `Renamed page ${ Date.now() }`;
		const stage = getStage( page );

		await visitEditor(
			page,
			`/types/page/list/all?postId=${ testPage.id }`
		);
		await stage.getByRole( 'button', { name: 'Page options' } ).click();
		await page.getByRole( 'menuitem', { name: 'Rename' } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Rename page' } );
		await expect( dialog.getByLabel( 'Page title' ) ).toHaveValue(
			testPage.title
		);
		await dialog.getByLabel( 'Page title' ).fill( newTitle );
		await dialog.getByRole( 'button', { name: 'Rename' } ).click();

		// The new name waits in the top bar to be saved.
		await expect( dialog ).toHaveCount( 0 );
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( newTitle );
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
	} );

	test( 'opens a page layout in the block editor', async ( { page } ) => {
		await visitEditor( page, '/types/page' );

		const stage = getStage( page );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await openPageLayouts( page );
		await expect( page ).toHaveURL( /content%3Dtemplates/ );

		// Picking a layout previews it, styled by the theme.
		await stage
			.locator( '.routes-post-list__template-card' )
			.first()
			.click();
		await expect
			.poll(
				() =>
					getEditorCanvas( page )
						.locator( 'body' )
						.evaluate(
							( body ) =>
								window.getComputedStyle( body ).fontFamily
						),
				{ timeout: 15000 }
			)
			.not.toContain( 'Times New Roman' );

		// Back to Pages and in again.
		await stage
			.getByRole( 'navigation', { name: 'Breadcrumbs' } )
			.getByRole( 'link', { name: 'Pages' } )
			.click();
		await openPageLayouts( page );
		await canvas.getByRole( 'button', { name: 'More options' } ).click();

		const openFull = page.getByRole( 'menuitem', {
			name: 'Open in full editor',
		} );

		await expect( openFull ).toBeEnabled( { timeout: 15000 } );
		await openFull.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template\?postId=/ );
		await expectBlockEditor( page );
	} );
} );
