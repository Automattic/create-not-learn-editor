const {
	expect,
	getSaveControls,
	getStage,
	openReviewChanges,
	test,
	visitEditor,
} = require( '../utils' );

/**
 * Follow one of the links under the site looks on Design.
 *
 * @param {import('@playwright/test').Locator} stage The white panel.
 * @param {string}                             name  The link's title.
 */
async function openDesignLink( stage, name ) {
	await stage
		.getByRole( 'navigation', { name: 'More design options' } )
		.getByRole( 'button', { name: new RegExp( `^${ name }` ) } )
		.click();
}

/**
 * Pick the second of a design screen's choices, which the editor comes on to
 * show beside the screen.
 *
 * @param {import('@playwright/test').Page} page     The page.
 * @param {string}                          selector The choices' selector.
 */
async function pickSecondChoice( page, selector ) {
	const choices = getStage( page ).locator( selector );

	await expect( choices.first() ).toBeVisible( { timeout: 15000 } );
	test.skip(
		( await choices.count() ) < 2,
		'The active theme has no other choices to pick.'
	);

	await choices.nth( 1 ).click();
	await expect( choices.nth( 1 ) ).toHaveAttribute( 'aria-pressed', 'true' );
	await expect( getSaveControls( page ) ).toContainText( '1 unsaved change' );
}

/**
 * Go Back to Design and check the editor stayed beside it. The editor came
 * on only to show a change, so it mustn't fill the editor on the way.
 *
 * @param {import('@playwright/test').Page} page The page.
 */
async function goBackToDesignBesideCanvas( page ) {
	await getStage( page ).getByRole( 'button', { name: 'Back' } ).click();
	await expect( page ).toHaveURL( /p=%2Fdesign$/ );
	await expect(
		page.getByRole( 'heading', { name: 'Design', exact: true } )
	).toBeVisible();
	await expect( page.locator( 'body' ) ).not.toHaveClass(
		/cnl-canvas-is-expanded/
	);
}

test.describe( 'Design interactions', () => {
	test( 'links lead to each design screen, and breadcrumbs lead back', async ( {
		page,
	} ) => {
		// The sidebar links to Colors and Fonts; Design itself is reached
		// from Home.
		await visitEditor( page, '/design' );

		const stage = getStage( page );
		const backToDesign = stage
			.getByRole( 'navigation', { name: 'Breadcrumbs' } )
			.getByRole( 'link', { name: 'Design' } );

		for ( const [ name, route ] of [
			[ 'Colors', 'colors' ],
			[ 'Fonts', 'fonts' ],
			[ 'Name & logo', 'identity' ],
		] ) {
			await openDesignLink( stage, name );
			await expect( page ).toHaveURL(
				new RegExp( `p=%2Fdesign%2F${ route }` )
			);

			await backToDesign.click();
			await expect( page ).toHaveURL( /p=%2Fdesign$/ );
		}
	} );

	test( 'picking a look previews it, and discarding it puts the theme’s back', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design' );

		const stage = getStage( page );
		const looks = stage.locator( '.routes-styles__look' );
		const themeDefault = stage
			.getByRole( 'button', { name: 'Theme default' } )
			.first();

		await expect( themeDefault ).toHaveAttribute( 'aria-pressed', 'true' );
		test.skip(
			( await looks.count() ) < 2,
			'The active theme has no style variations to pick.'
		);

		await looks.nth( 1 ).click();
		await expect( looks.nth( 1 ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);

		const review = await openReviewChanges( page );
		await review
			.getByRole( 'button', { name: 'Discard change to Site look' } )
			.click();

		await expect( themeDefault ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( getSaveControls( page ) ).not.toContainText( 'unsaved' );
	} );

	test( 'picking a color palette waits to be saved, and Back leaves the editor beside Design', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design/colors' );
		await pickSecondChoice( page, '.routes-styles__palette' );
		await goBackToDesignBesideCanvas( page );
	} );

	test( 'Back from a picked font pairing leaves the editor beside Design', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design/fonts' );
		await pickSecondChoice( page, '.routes-styles__font' );
		await goBackToDesignBesideCanvas( page );
	} );

	test( 'opening a page after a change was shown still fills the editor', async ( {
		page,
		rest,
	} ) => {
		const target = await rest.createPage();

		await visitEditor( page, '/design/colors' );
		await pickSecondChoice( page, '.routes-styles__palette' );
		await goBackToDesignBesideCanvas( page );

		// Picking a page means editing it, so the editor fills the screen.
		await page
			.getByRole( 'button', { name: /Go to another page$/ } )
			.click();
		await page
			.getByRole( 'combobox', { name: 'Find or go to any page' } )
			.fill( target.title );
		await page.getByRole( 'option', { name: target.title } ).click();

		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( target.title, { timeout: 15000 } );
		await expect( page.locator( 'body' ) ).toHaveClass(
			/cnl-canvas-is-expanded/
		);
	} );

	test( 'saves the site name and tagline, previewing them first', async ( {
		page,
		rest,
	} ) => {
		const original = await rest.fetch( '/wp/v2/settings', {
			params: { _fields: 'title,description' },
		} );
		rest.onCleanup( () =>
			rest.fetch( '/wp/v2/settings', { data: original, method: 'POST' } )
		);

		const timestamp = Date.now();
		const title = `Create Not Learn ${ timestamp }`;
		const tagline = `Tagline ${ timestamp }`;

		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );
		await stage.getByLabel( 'Site name' ).fill( title );
		await stage.getByLabel( 'Tagline' ).fill( tagline );

		// The preview reads unsaved edits, so the header updates before saving.
		await expect(
			page
				.frameLocator( '.cnl-site-canvas iframe[name="editor-canvas"]' )
				.getByText( title )
				.first()
		).toBeVisible( { timeout: 15000 } );

		await expect( getSaveControls( page ) ).toContainText(
			'2 unsaved changes'
		);
		const review = await openReviewChanges( page );
		await review.getByRole( 'button', { name: 'Save 2 changes' } ).click();

		await expect( getSaveControls( page ) ).toContainText(
			'All changes saved',
			{ timeout: 15000 }
		);
		expect(
			await rest.fetch( '/wp/v2/settings', {
				params: { _fields: 'title,description' },
			} )
		).toEqual( { description: tagline, title } );
	} );

	test( 'discards unsaved changes one at a time or all at once', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );
		const saveControls = getSaveControls( page );
		const siteName = stage.getByLabel( 'Site name' );
		const tagline = stage.getByLabel( 'Tagline' );

		await expect( siteName ).toBeEditable( { timeout: 15000 } );

		const savedName = await siteName.inputValue();
		const savedTagline = await tagline.inputValue();

		await siteName.fill( `Discarded name ${ Date.now() }` );
		await tagline.fill( `Discarded tagline ${ Date.now() }` );
		await expect( saveControls ).toContainText( '2 unsaved changes' );

		// One change, from the review.
		const review = await openReviewChanges( page );
		await review
			.getByRole( 'button', { name: 'Discard change to Site name' } )
			.click();
		await expect( siteName ).toHaveValue( savedName );
		await expect( review.getByRole( 'listitem' ) ).toHaveCount( 1 );

		// Discard all asks first, and Keep changes goes back to the list.
		const confirm = page.getByRole( 'dialog', {
			name: 'Discard changes?',
		} );
		await review.getByRole( 'button', { name: 'Discard all' } ).click();
		await confirm.getByRole( 'button', { name: 'Keep changes' } ).click();
		await expect( review.getByRole( 'listitem' ) ).toHaveCount( 1 );
		await page.keyboard.press( 'Escape' );
		await expect( review ).toHaveCount( 0 );

		// The rest, all at once.
		await openReviewChanges( page );
		await review.getByRole( 'button', { name: 'Discard all' } ).click();
		await confirm
			.getByRole( 'button', { name: 'Discard changes' } )
			.click();
		await expect( tagline ).toHaveValue( savedTagline );
		await expect( saveControls ).not.toContainText( 'unsaved' );
	} );
} );
