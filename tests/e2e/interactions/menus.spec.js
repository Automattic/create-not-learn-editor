const {
	expect,
	expectBlockEditor,
	expectSnackbar,
	getFrameTexts,
	getRoute,
	getSaveControls,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

const LINK_MENU_CONTENT =
	'<!-- wp:navigation-link {"label":"Example","url":"https://example.com/","kind":"custom"} /-->';

/**
 * Open a menu on its own screen.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          menu From `rest.createNavigationMenu`.
 * @return {Promise<import('@playwright/test').Locator>} The menu's tree.
 */
async function openMenu( page, menu ) {
	await visitEditor( page, `/navigation/edit/${ menu.id }` );
	await expect(
		getStage( page ).getByRole( 'heading', { level: 1, name: menu.title } )
	).toBeVisible( { timeout: 15000 } );

	const tree = page.getByRole( 'treegrid', {
		name: 'Block navigation structure',
	} );
	await expect( tree ).toBeVisible( { timeout: 15000 } );

	return tree;
}

/**
 * Check a change is waiting in the top bar to be saved.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectUnsavedChanges( page ) {
	await expect(
		getSaveControls( page ).getByRole( 'button', {
			name: 'Save',
			exact: true,
		} )
	).toBeVisible();
}

test.describe( 'Menus interactions', () => {
	test( 'customizing an auto menu lets its pages be changed', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();
		const menu = await rest.createNavigationMenu();
		const tree = await openMenu( page, menu );
		const stage = getStage( page );
		const row = tree.getByRole( 'row', { name: testPage.title } );

		await expect( row ).toBeVisible( { timeout: 15000 } );
		await stage
			.getByRole( 'button', { name: 'Customize', exact: true } )
			.click();
		await page.getByRole( 'button', { name: 'Customize menu' } ).click();

		await expectSnackbar(
			page,
			'Menu customized. New pages won’t be added to it automatically.'
		);
		await expectUnsavedChanges( page );
		await expect(
			stage.getByRole( 'heading', { name: 'Auto menu' } )
		).toHaveCount( 0 );

		await row.getByRole( 'button', { name: 'Options' } ).click();
		await page.getByRole( 'menuitem', { name: /^Remove/ } ).click();
		await expect( row ).toHaveCount( 0 );
	} );

	test( 'Add menu item offers pages, links, submenus and more', async ( {
		page,
		rest,
	} ) => {
		const menu = await rest.createNavigationMenu( {
			content: LINK_MENU_CONTENT,
		} );
		await openMenu( page, menu );

		const addItem = page.getByRole( 'button', { name: 'Add menu item' } );
		const urlField = page.getByRole( 'combobox', {
			name: 'Search or type URL',
		} );

		await addItem.click();
		for ( const name of [
			'Add existing page',
			'Custom link',
			'Submenu',
		] ) {
			await expect(
				page.getByRole( 'menuitem', { name } )
			).toBeVisible();
		}
		await expect(
			page.getByRole( 'menuitem', { name: /More/ } )
		).toBeVisible();

		// Submenu opens a second level, and Back returns from it.
		await page.getByRole( 'menuitem', { name: 'Submenu' } ).click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Existing page' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Label only' } )
		).toBeVisible();
		await page.getByRole( 'menuitem', { name: 'Back' } ).click();

		// Pages and links are both picked with the link field.
		await page
			.getByRole( 'menuitem', { name: 'Add existing page' } )
			.click();
		await expect( urlField ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( urlField ).toHaveCount( 0 );

		await addItem.click();
		await page.getByRole( 'menuitem', { name: 'Custom link' } ).click();
		await expect( urlField ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( urlField ).toHaveCount( 0 );
	} );

	test( 'types and corrects a custom link URL', async ( { page, rest } ) => {
		const menu = await rest.createNavigationMenu( {
			content: LINK_MENU_CONTENT,
		} );
		const tree = await openMenu( page, menu );
		const urlField = page.getByRole( 'combobox', {
			name: 'Search or type URL',
		} );

		await page.getByRole( 'button', { name: 'Add menu item' } ).click();
		await page.getByRole( 'menuitem', { name: 'Custom link' } ).click();

		// Editing keys stay in the field rather than reaching the new item's
		// row, where Backspace and Delete would remove the item.
		await urlField.pressSequentially( 'wordpress.orgg' );
		await page.keyboard.press( 'Backspace' );
		await page.keyboard.press( 'Home' );
		await page.keyboard.press( 'Delete' );
		await page.keyboard.type( 'w' );
		await expect( urlField ).toHaveValue( 'wordpress.org' );

		await page.keyboard.press( 'Enter' );
		await expect( urlField ).toHaveCount( 0 );
		await expect(
			tree.getByRole( 'link', { name: 'wordpress.org' } )
		).toBeVisible();
	} );

	test( 'adds a label-only submenu, then links inside it', async ( {
		page,
		rest,
	} ) => {
		const menu = await rest.createNavigationMenu( {
			content: LINK_MENU_CONTENT,
		} );
		const tree = await openMenu( page, menu );
		const label = `Label submenu ${ Date.now() }`;

		await page.getByRole( 'button', { name: 'Add menu item' } ).click();
		await page.getByRole( 'menuitem', { name: 'Submenu' } ).click();
		await page.getByRole( 'menuitem', { name: 'Label only' } ).click();
		await page.getByLabel( 'Submenu label' ).fill( label );
		await page.getByRole( 'button', { name: 'Add drop-down' } ).click();

		await expect( tree.getByText( label ).first() ).toBeVisible();
		await expect(
			tree.getByText( 'This submenu is empty.' )
		).toBeVisible();
		await expectUnsavedChanges( page );

		const addToSubmenu = page.getByRole( 'button', {
			name: 'Add to submenu',
		} );
		await addToSubmenu.click();
		await page.getByRole( 'menuitem', { name: 'Custom link' } ).click();
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toBeVisible();
	} );

	test( 'adds a custom link from the More dialog', async ( {
		page,
		rest,
	} ) => {
		const menu = await rest.createNavigationMenu( {
			content: LINK_MENU_CONTENT,
		} );
		const tree = await openMenu( page, menu );
		const label = `Modal link ${ Date.now() }`;

		await page.getByRole( 'button', { name: 'Add menu item' } ).click();
		await page.getByRole( 'menuitem', { name: /More/ } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Add menu items' } );
		await expect(
			dialog.getByRole( 'tab', { name: 'Pages' } )
		).toBeVisible();
		await expect(
			dialog.locator( '.navigation-add-items-modal__picker-scroll' )
		).toBeVisible();

		await dialog.getByRole( 'button', { name: 'More' } ).click();
		await dialog.getByRole( 'tab', { name: 'Custom link' } ).click();
		await dialog
			.getByLabel( 'URL' )
			.fill( 'https://example.com/modal-navigation-test/' );
		await dialog.getByLabel( 'Link text' ).fill( label );
		await dialog.getByRole( 'button', { name: 'Add to menu' } ).click();

		await expectSnackbar(
			page,
			'Menu items added. Review and save changes when you are ready.'
		);
		await expect( tree.getByText( label ) ).toBeVisible();
	} );

	test( 'renames a menu, waiting to be saved', async ( { page, rest } ) => {
		const menu = await rest.createNavigationMenu();
		const newTitle = `Renamed menu ${ Date.now() }`;

		await openMenu( page, menu );
		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Rename' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Rename navigation menu',
		} );
		await dialog.getByLabel( 'Name' ).fill( newTitle );
		await dialog.getByRole( 'button', { name: 'Save' } ).click();

		await expectSnackbar(
			page,
			'Navigation menu renamed. Review and save changes when you are ready.'
		);
		await expectUnsavedChanges( page );
		await expect(
			getStage( page ).getByRole( 'heading', {
				level: 1,
				name: newTitle,
			} )
		).toBeVisible();
	} );

	test( 'deletes a menu straight away', async ( { page, rest } ) => {
		const menu = await rest.createNavigationMenu();

		await openMenu( page, menu );
		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Delete' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Delete navigation menu',
		} );
		await expect( dialog.getByText( menu.title ) ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Delete' } ).click();

		await expectSnackbar( page, 'Navigation menu deleted.' );
		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.not.toBe( `/navigation/edit/${ menu.id }` );
		await expect(
			rest.fetch( `/wp/v2/navigation/${ menu.id }` )
		).rejects.toThrow( /404/ );
	} );

	test( 'makes a site a menu again when it is left with none', async ( {
		page,
		rest,
	} ) => {
		const existing = await rest.fetch( '/wp/v2/navigation', {
			params: { _fields: 'id,status', status: 'publish,draft' },
		} );

		// Trashing keeps each menu's ID, so a later test's own menu, or a
		// location pointing at one of these by ID, still finds it.
		for ( const menu of existing ) {
			await rest.fetch( `/wp/v2/navigation/${ menu.id }`, {
				method: 'DELETE',
			} );
			rest.onCleanup( () =>
				rest.fetch( `/wp/v2/navigation/${ menu.id }`, {
					data: { status: menu.status },
					method: 'POST',
				} )
			);
		}

		await visitEditor( page );

		let menus;
		await expect
			.poll(
				async () => {
					menus = await rest.fetch( '/wp/v2/navigation', {
						params: {
							_fields: 'id,title,content',
							context: 'edit',
							status: 'publish,draft',
						},
					} );

					return menus.length;
				},
				{ timeout: 15000 }
			)
			.toBe( 1 );

		const [ menu ] = menus;

		expect( menu.title.raw ).toBe( 'Main menu' );
		expect( menu.content.raw ).toBe( '<!-- wp:page-list /-->' );
		rest.deleteLater( `/wp/v2/navigation/${ menu.id }` );
	} );

	test( 'opens a location to edit with the menu picked', async ( {
		page,
		rest,
	} ) => {
		await visitEditor(
			page,
			`/navigation/edit/${ await rest.getMainMenuId() }`
		);

		const canvas = page.locator( '.routes-navigation-canvas' );
		await canvas
			.getByRole( 'radio', { name: 'Locations', exact: true } )
			.click();
		await canvas
			.locator( '.routes-navigation-locations-canvas__card' )
			.first()
			.getByRole( 'button', { name: 'Edit' } )
			.click( { timeout: 15000 } );

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template_part\?postId=/ );
		await expectBlockEditor( page );
		await expect
			.poll(
				() =>
					page.evaluate( () => {
						const blockEditor =
							window.wp.data.select( 'core/block-editor' );

						return blockEditor.getBlockName(
							blockEditor.getSelectedBlockClientId()
						);
					} ),
				{ timeout: 15000 }
			)
			.toBe( 'core/navigation' );
	} );

	test( 'opens a menu in the block editor', async ( { page, rest } ) => {
		const menu = await rest.createNavigationMenu();

		await openMenu( page, menu );
		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await page
			.getByRole( 'menuitem', { name: 'Open block editor' } )
			.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toBe( `/types/wp_navigation/edit/${ menu.id }` );
		await expectBlockEditor( page );
	} );

	test( 'puts a menu in a site location without saving the site', async ( {
		page,
		rest,
	} ) => {
		const savedParts = await rest.getNavigationTemplateParts();
		test.skip(
			savedParts.length === 0,
			'No site parts with a navigation block to put a menu in.'
		);

		const menu = await rest.createNavigationMenu();
		await openMenu( page, menu );

		const canvas = page.locator( '.routes-navigation-canvas' );
		const meta = canvas.locator( '.cnl-editor-homepage-document__meta' );

		await expect( meta ).toHaveText( 'Not shown on your site', {
			timeout: 15000,
		} );
		await canvas
			.getByRole( 'radio', { name: 'Locations', exact: true } )
			.click();
		await canvas.getByRole( 'button', { name: 'Choose location' } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Choose location' } );
		await dialog.getByRole( 'checkbox' ).first().check();
		await dialog.getByRole( 'button', { name: 'Add to location' } ).click();

		await expectSnackbar(
			page,
			'Menu locations updated. Review and save changes when you are ready.'
		);
		await expectUnsavedChanges( page );
		await expect( meta ).toHaveText( 'Shown in 1 location' );

		// Nothing is saved until the change is reviewed.
		expect( await rest.getNavigationTemplateParts() ).toEqual( savedParts );

		await expect(
			canvas.locator( '.routes-navigation-locations-canvas__card' )
		).toHaveCount( 1, { timeout: 15000 } );
		await expect
			.poll(
				async () =>
					(
						await getFrameTexts(
							page,
							'.routes-navigation-locations-canvas__preview iframe'
						)
					).some( ( text ) => text.trim().length ),
				{ timeout: 15000 }
			)
			.toBe( true );
	} );

	test( 'shows changes from the tree in the location previews', async ( {
		page,
		rest,
	} ) => {
		const savedParts = await rest.getNavigationTemplateParts();
		test.skip(
			savedParts.length === 0,
			'No site parts with a navigation block to put a menu in.'
		);

		const menu = await rest.createNavigationMenu( {
			content: [
				'<!-- wp:navigation-link {"label":"Removed link","url":"https://example.com/removed/","kind":"custom"} /-->',
				'<!-- wp:navigation-link {"label":"Kept link","url":"https://example.com/kept/","kind":"custom"} /-->',
			].join( '\n' ),
		} );
		const tree = await openMenu( page, menu );
		const canvas = page.locator( '.routes-navigation-canvas' );
		const getPreviewText = async () =>
			(
				await getFrameTexts(
					page,
					'.routes-navigation-locations-canvas__preview iframe'
				)
			).join( '\n' );

		await canvas
			.getByRole( 'radio', { name: 'Locations', exact: true } )
			.click();
		await canvas.getByRole( 'button', { name: 'Choose location' } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Choose location' } );
		await dialog.getByRole( 'checkbox' ).first().check();
		await dialog.getByRole( 'button', { name: 'Add to location' } ).click();

		await expect
			.poll( getPreviewText, { timeout: 15000 } )
			.toContain( 'Removed link' );

		const row = tree.getByRole( 'row', { name: 'Removed link' } );
		await row.getByRole( 'button', { name: 'Options' } ).click();
		await page.getByRole( 'menuitem', { name: /^Remove/ } ).click();
		await expect( row ).toHaveCount( 0 );

		await expect
			.poll( getPreviewText, { timeout: 15000 } )
			.not.toContain( 'Removed link' );
		expect( await getPreviewText() ).toContain( 'Kept link' );
	} );
} );
