/**
 * Document Overview on the expanded site canvas: a rail of icons down its
 * left edge opens Details, about the page, Layers, which lists a page built
 * from sections as the canvas works on it, its header, sections and footer,
 * rather than core's list of blocks, and Outline, the page's headings.
 */
const { expect, getCanvasEditor, test, visitEditor } = require( '../utils' );

function getRail( page ) {
	return page.getByRole( 'navigation', { name: 'Document panels' } );
}

function section( heading ) {
	return `<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">${ heading }</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Some words.</p><!-- /wp:paragraph --></div><!-- /wp:group -->`;
}

test.describe( 'Document Overview', () => {
	test( 'opens Details, and Layers lists the page in Header, Content and Footer and picks a section on the canvas', async ( {
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

		// The rail is offered once the canvas is expanded.
		await expect( getRail( page ) ).toBeHidden();
		await canvas
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();

		const rail = getRail( page );

		await rail.getByRole( 'button', { name: 'Details' } ).click();

		// Details is about the page.
		const panel = page.locator( '.cnl-document-panel' );

		await expect(
			panel.getByRole( 'heading', { name: 'Details' } )
		).toBeVisible();
		// Its title is a field of the form, to change in place.
		await expect(
			panel.getByRole( 'button', { name: 'Edit Title' } )
		).toBeVisible();
		await expect( panel.getByText( testPage.title ) ).toBeVisible();

		await rail.getByRole( 'button', { name: 'Layers' } ).click();

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
				'.editor-list-view-sidebar .block-editor-list-view-tree:not(.cnl-canvas-overview__tree)'
			)
		).toBeHidden();

		// A row picks its section on the canvas.
		await overview
			.getByRole( 'button', { name: 'Second section' } )
			.click();
		await expect(
			overview.locator( 'tr', { hasText: 'Second section' } )
		).toHaveAttribute( 'aria-selected', 'true' );

		// A section opens, as a row in core's list view does, to its blocks,
		// and a block's row selects it on the canvas.
		const secondRow = overview.locator( 'tr', {
			hasText: 'Second section',
		} );

		await expect( secondRow.first() ).toHaveAttribute(
			'aria-expanded',
			'false'
		);
		await overview
			.getByRole( 'button', { name: 'Second section' } )
			.first()
			.press( 'ArrowRight' );
		await expect( secondRow.first() ).toHaveAttribute(
			'aria-expanded',
			'true'
		);

		const paragraphRow = content
			.locator( 'tr[aria-level="2"]' )
			.filter( { hasText: 'Paragraph' } );

		await paragraphRow.getByRole( 'button' ).click();
		await expect( paragraphRow ).toHaveAttribute( 'aria-selected', 'true' );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.locator( '.wp-block-paragraph.is-selected' )
		).toHaveText( 'Some words.' );

		// The section's row steps back out to the section.
		await overview
			.getByRole( 'button', { name: 'Second section' } )
			.first()
			.click();
		await expect( secondRow.first() ).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect( paragraphRow ).toHaveAttribute(
			'aria-selected',
			'false'
		);
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.locator( '.wp-block-paragraph.is-selected' )
		).toHaveCount( 0 );

		// The header doesn't open until Edit header opens it.
		const headerRow = overview
			.locator( '.cnl-canvas-overview__group', {
				has: page.getByRole( 'heading', { name: 'Header' } ),
			} )
			.locator( 'tr' )
			.first();

		await expect( headerRow ).not.toHaveAttribute( 'aria-expanded' );
		// Its row's edit button opens it, as Edit header on the canvas does,
		// and goes while it is open.
		await headerRow.getByRole( 'button', { name: 'Edit header' } ).click();
		await expect( headerRow ).toHaveAttribute( 'aria-expanded', 'true' );
		await expect(
			headerRow.getByRole( 'button', { name: 'Edit header' } )
		).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Done editing' } ).click();
		await expect( headerRow ).not.toHaveAttribute( 'aria-expanded' );
		await expect(
			headerRow.getByRole( 'button', { name: 'Edit header' } )
		).toBeVisible();

		// Details hides the list, and Layers brings it back.
		await rail.getByRole( 'button', { name: 'Details' } ).click();
		await expect( overview ).toBeHidden();
		await rail.getByRole( 'button', { name: 'Layers' } ).click();
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

	test( 'names each panel in its tooltip, opens Outline, and closes on a second click or Escape', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( {
			content: section( 'Our story' ) + section( 'Visit us' ),
		} );

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await expect(
			getCanvasEditor( page ).contentFrame().getByText( 'Visit us' )
		).toBeVisible( { timeout: 15000 } );
		await page
			.locator( '.cnl-site-canvas' )
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();

		const rail = getRail( page );
		const details = rail.getByRole( 'button', { name: 'Details' } );
		const outline = rail.getByRole( 'button', { name: 'Outline' } );
		const panel = page.locator( '.cnl-document-panel' );

		// The Document info button gave way to the rail.
		await expect(
			page.getByRole( 'button', { name: 'Document info' } )
		).toHaveCount( 0 );

		// Each icon says what its panel is for, about this kind of document,
		// in its tooltip and to screen readers.
		await expect( details ).toHaveAccessibleDescription(
			'See and change this page’s title, status, address and layout.'
		);
		await details.hover();
		await expect(
			page.locator( '.cnl-document-rail__tooltip' )
		).toContainText(
			'See and change this page’s title, status, address and layout.'
		);

		// Details wears the page's own icon, as core's editor picks it: the
		// lines of the page icon in the Gutenberg plugin wp-env runs.
		await expect( details.locator( 'svg path' ).first() ).toHaveAttribute(
			'd',
			/^M15\.5 7\.5h-7V9h7V7\.5Z/
		);

		// Outline lists the page's headings.
		await outline.click();
		await expect( outline ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			panel.getByRole( 'heading', { name: 'Outline' } )
		).toBeVisible();
		await expect( panel.locator( '.document-outline' ) ).toContainText(
			'Our story'
		);
		await expect( panel.locator( '.document-outline' ) ).toContainText(
			'Visit us'
		);
		// Core's own sidebar, with its list, is hidden beside it.
		await expect(
			page.locator(
				'.editor-list-view-sidebar .block-editor-tabbed-sidebar'
			)
		).toBeHidden();

		// A second click on its icon closes it.
		await outline.click();
		await expect( panel ).toHaveCount( 0 );
		await expect( outline ).toHaveAttribute( 'aria-pressed', 'false' );

		// Escape closes it too, and hands focus back to the rail.
		await details.click();
		await expect(
			panel.getByRole( 'heading', { name: 'Details' } )
		).toBeVisible();
		await panel.getByRole( 'button', { name: 'Close' } ).focus();
		await page.keyboard.press( 'Escape' );
		await expect( panel ).toHaveCount( 0 );
		await expect( details ).toBeFocused();
	} );
} );
