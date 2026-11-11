const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	getPageItem,
	getRoute,
	getSaveControls,
	getStage,
	openPageLayouts,
	openReviewChanges,
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

	test( 'a menu set by hand is changed on the Menus screen, not from Pages', async ( {
		page,
		rest,
	} ) => {
		const menuId = await rest.getMainMenuId();
		const menuPath = `/wp/v2/navigation/${ menuId }`;
		const { content } = await rest.fetch( menuPath, {
			params: { context: 'edit' },
		} );

		await rest.fetch( menuPath, {
			data: {
				content:
					'<!-- wp:navigation-link {"label":"Elsewhere","url":"https://example.com","kind":"custom"} /-->',
			},
			method: 'POST',
		} );

		try {
			const stage = getStage( page );

			await visitEditor( page, '/types/page' );
			await expect(
				stage.getByText( /Your menu is set by hand/ )
			).toBeVisible( { timeout: 15000 } );
			// A plain list of pages, not the tree that looks like a menu.
			await expect(
				stage.locator( '.dataviews-view-list__item' ).first()
			).toBeVisible( { timeout: 15000 } );
			await expect( stage.locator( '.cnl-pages-list-view' ) ).toHaveCount(
				0
			);
			await expect( stage.getByRole( 'switch' ) ).toHaveCount( 0 );

			// Picking a page opens its details.
			await stage.locator( '.dataviews-view-list__item' ).first().click();
			await expect( page ).toHaveURL( /postId%3D/ );
			await expect(
				stage.getByRole( 'region', { name: /this page$/ } )
			).toBeVisible( { timeout: 15000 } );

			await visitEditor( page, '/types/page' );

			await stage.getByRole( 'button', { name: 'Edit menu' } ).click();
			await expect
				.poll( () => getRoute( page ), { timeout: 15000 } )
				.toBe( `/navigation/edit/${ menuId }` );
		} finally {
			await rest.fetch( menuPath, {
				data: { content: content.raw },
				method: 'POST',
			} );
		}
	} );

	test( 'Manage all menus leads on to the Menus screen', async ( {
		page,
	} ) => {
		await visitEditor( page, '/types/page' );

		const allMenus = getStage( page )
			.getByRole( 'navigation', { name: 'More options' } )
			.getByRole( 'button', { name: /^Manage all menus/ } );

		await expect( allMenus ).toBeVisible( { timeout: 15000 } );
		await allMenus.click();
		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toBe( '/navigation' );
		await expect(
			getStage( page ).getByRole( 'heading', {
				exact: true,
				name: 'Menus',
			} )
		).toBeVisible();
	} );

	test( 'System pages lists the pages the site makes for itself', async ( {
		page,
	} ) => {
		await visitEditor( page, '/types/page' );

		const stage = getStage( page );
		const systemPages = stage
			.getByRole( 'navigation', { name: 'More options' } )
			.getByRole( 'button', { name: /^System pages/ } );

		await expect( systemPages ).toBeVisible( { timeout: 15000 } );
		await systemPages.click();
		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toBe( '/types/page/list/all?content=system' );

		const notFound = stage.getByRole( 'button', {
			name: /^Page not found/,
		} );

		await expect( notFound ).toBeVisible( { timeout: 15000 } );
		await expect( notFound ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			stage.getByRole( 'button', { name: /^Search results/ } )
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

	test( 'drags a page under another page, and back out, waiting to be saved', async ( {
		page,
		rest,
	} ) => {
		const stamp = Date.now();
		// Titles that list the sub-page straight after its parent.
		const parent = await rest.createPage( {
			title: `Nest parent ${ stamp }`,
		} );
		const child = await rest.createPage( {
			title: `Nest sub-page ${ stamp }`,
		} );
		const getParent = async () =>
			( await rest.fetch( `/wp/v2/pages/${ child.id }` ) ).parent;
		const getRow = ( title ) =>
			getStage( page )
				.locator( '.cnl-pages-list-view [data-block]' )
				.filter( { hasText: title } );
		// Rows move aside as a page is dragged, so where it goes is given as
		// a row and a spot on it, measured once the drag has started.
		const drag = async ( title, getPoint ) => {
			// A moved page's row is redrawn once a save brings back its new
			// address, which can drop a drag just started, so start again
			// until it takes.
			await expect( async () => {
				const from = await getPageItem(
					page,
					child.title
				).boundingBox();

				await page.mouse.move( from.x + 40, from.y + from.height / 2 );
				await page.mouse.down();
				await page.mouse.move( from.x + 50, from.y + from.height / 2, {
					steps: 5,
				} );

				if (
					! ( await getRow( child.title ).getAttribute( 'class' ) )
						.split( ' ' )
						.includes( 'is-dragging' )
				) {
					await page.mouse.up();
					throw new Error( 'The drag didn’t start.' );
				}
			} ).toPass( { timeout: 10000 } );

			const to = getPoint( await getRow( title ).boundingBox() );

			// The list works out where a drop goes a little after each move.
			for ( let step = 0; step < 10; step++ ) {
				await page.mouse.move( to.x + ( step % 2 ), to.y, {
					steps: 2,
				} );
				await page.waitForTimeout( 60 );
			}

			await page.mouse.up();
		};

		await visitEditor( page, '/types/page' );
		await getRow( child.title ).scrollIntoViewIfNeeded();

		// Low on the parent's row and well to the right puts it underneath.
		await drag( parent.title, ( row ) => ( {
			x: row.x + 120,
			y: row.y + row.height * 0.8,
		} ) );
		await expect(
			page
				.getByTestId( 'snackbar' )
				.getByText(
					`Moved “${ child.title }” under “${ parent.title }”.`
				)
		).toBeVisible();
		await expect( getRow( child.title ) ).toHaveAttribute(
			'aria-level',
			'2'
		);

		// The move waits for Save, like any other change.
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
		expect( await getParent() ).toBe( 0 );

		const review = await openReviewChanges( page );

		await review.getByRole( 'button', { name: 'Save 1 change' } ).click();
		await expect( getSaveControls( page ) ).toContainText(
			'All changes saved',
			{ timeout: 15000 }
		);
		expect( await getParent() ).toBe( parent.id );

		// High on the parent's row and to the far left brings it back out,
		// above its parent.
		await drag( parent.title, ( row ) => ( {
			x: row.x + 4,
			y: row.y + row.height * 0.25,
		} ) );
		await expect( getRow( child.title ) ).toHaveAttribute(
			'aria-level',
			'1'
		);
		await expect( getSaveControls( page ) ).toContainText(
			'unsaved change'
		);
		expect( await getParent() ).toBe( parent.id );
	} );

	test( 'opens a page layout in the block editor', async ( { page } ) => {
		await visitEditor( page, '/types/page' );

		const stage = getStage( page );

		await openPageLayouts( page );
		await expect( page ).toHaveURL( /content%3Dtemplates/ );

		// Picking a layout previews it, styled by the theme.
		await stage
			.getByRole( 'list', { name: 'Layouts' } )
			.getByRole( 'button' )
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
		// The advanced editor is in the top bar's Options menu.
		await page
			.getByRole( 'button', { name: 'Options', exact: true } )
			.click();

		const openFull = page.getByRole( 'menuitem', {
			name: /Open in advanced editor/,
		} );

		await expect( openFull ).toBeEnabled( { timeout: 15000 } );
		await openFull.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template\?postId=/ );
		await expectBlockEditor( page );
	} );
} );
