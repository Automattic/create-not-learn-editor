const { expect, test, visitEditor } = require( '../utils' );

// The Site overview has no save bar of its own: changes waiting to be saved
// are counted on the sidebar's Save button.
const getReviewButton = ( page ) =>
	page.getByRole( 'button', { name: /^Review \d+ changes?/ } );

test.describe( 'Site overview interactions', () => {
	test( 'drags a page under another page, waiting to be saved', async ( {
		page,
		rest,
	} ) => {
		const stamp = Date.now();
		const parent = await rest.createPage( {
			title: `Overview parent ${ stamp }`,
		} );
		const child = await rest.createPage( {
			title: `Overview sub-page ${ stamp }`,
		} );
		const getCard = ( id ) =>
			page.locator( `[data-node-id="page-${ id }"]` );
		const getParent = async () =>
			( await rest.fetch( `/wp/v2/pages/${ child.id }` ) ).parent;

		await visitEditor( page, '/site-overview' );
		await expect( getCard( child.id ) ).toBeVisible();

		const from = await getCard( child.id ).boundingBox();
		const to = await getCard( parent.id ).boundingBox();

		// The middle of a page's card puts the dragged page under it.
		await page.mouse.move(
			from.x + from.width / 2,
			from.y + from.height / 2
		);
		await page.mouse.down();
		await page.mouse.move( to.x + to.width / 2, to.y + to.height / 2, {
			steps: 10,
		} );
		await expect(
			page.locator( '.cnl-site-overview__drag-label' )
		).toContainText( `Put under “${ parent.title }”` );
		await page.mouse.up();

		await expect(
			page
				.getByTestId( 'snackbar' )
				.getByText(
					`Moved “${ child.title }” under “${ parent.title }”.`
				)
		).toBeVisible();

		// The move waits for Save, like any other change.
		await expect( getReviewButton( page ) ).toHaveText(
			/^Review 1 change/
		);
		expect( await getParent() ).toBe( 0 );
	} );

	test( 'a click on a page still selects it rather than moving it', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/site-overview' );
		await page
			.locator( `[data-node-id="page-${ testPage.id }"]` )
			.getByRole( 'button', { name: testPage.title } )
			.click();

		await expect( page ).toHaveURL(
			new RegExp( `node%3Dpage-${ testPage.id }` )
		);
		await expect( getReviewButton( page ) ).toHaveCount( 0 );
	} );
} );
