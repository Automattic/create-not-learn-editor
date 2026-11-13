/**
 * Document Overview's List View on the expanded site canvas, which lists a
 * page built from sections as the canvas works on it: its header, sections
 * and footer, rather than core's list of blocks.
 */
const { expect, getCanvasEditor, test, visitEditor } = require( '../utils' );

function section( heading ) {
	return `<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">${ heading }</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Some words.</p><!-- /wp:paragraph --></div><!-- /wp:group -->`;
}

test.describe( 'Document Overview', () => {
	test( 'lists the page in Header, Content and Footer, and picks a section on the canvas', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( {
			content: section( 'First section' ) + section( 'Second section' ),
		} );

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );

		// The editor has the page before anything is opened over it.
		await expect(
			getCanvasEditor( page ).contentFrame().getByText( 'Second section' )
		).toBeVisible( { timeout: 15000 } );

		const canvas = page.locator( '.cnl-site-canvas' );

		// Document Overview is offered once the canvas is expanded.
		await canvas
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();
		await canvas
			.getByRole( 'button', { name: 'Document Overview' } )
			.click();

		const overview = page.locator( '.cnl-canvas-overview' );
		const content = overview.locator( '.cnl-canvas-overview__group', {
			has: page.getByRole( 'heading', { name: 'Content' } ),
		} );

		await expect( overview ).toBeVisible();
		await expect(
			overview.getByRole( 'heading', { name: 'Header' } )
		).toBeVisible();
		await expect(
			overview.getByRole( 'heading', { name: 'Footer' } )
		).toBeVisible();
		await expect(
			content.locator( '.cnl-canvas-overview__title' )
		).toContainText( [ 'First section', 'Second section' ] );
		// Core's own list of blocks is still mounted, but not shown.
		await expect(
			page.locator(
				'.editor-list-view-sidebar .block-editor-list-view-tree'
			)
		).toBeHidden();

		// A row picks its section on the canvas.
		await overview
			.getByRole( 'button', { name: 'Second section' } )
			.click();
		await expect(
			overview.locator( 'tr', { hasText: 'Second section' } )
		).toHaveAttribute( 'aria-selected', 'true' );

		// Outline is core's, and the list comes back with List View.
		await page.getByRole( 'tab', { name: 'Outline' } ).click();
		await expect( overview ).toHaveCount( 0 );
		await page.getByRole( 'tab', { name: 'List View' } ).click();
		await expect( page.locator( '.cnl-canvas-overview' ) ).toBeVisible();

		// Add section adds at the end of the page, in place.
		await page
			.locator( '.cnl-canvas-overview' )
			.getByRole( 'button', { name: 'Add section' } )
			.click();
		await expect(
			page.getByRole( 'region', { name: 'Add a section' } )
		).toBeVisible();
	} );
} );
