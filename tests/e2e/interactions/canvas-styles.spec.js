/**
 * The styles the section layer puts in the editor's canvas: what they do to
 * the page, read from computed styles, so they hold however the styles reach
 * the canvas.
 */
const {
	clickIntoSection,
	closeViewMenu,
	expect,
	getCanvasEditor,
	openViewMenu,
	pickSectionMode,
	pointAtSection,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// A page with no blocks. The REST helper fills in a paragraph for no content.
const EMPTY_PAGE = ' ';

const TWO_SECTIONS =
	'<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:80px;padding-bottom:80px"><!-- wp:paragraph --><p>Inside a section</p><!-- /wp:paragraph --></div><!-- /wp:group -->' +
	'<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:80px;padding-bottom:80px"><!-- wp:paragraph --><p>Another section</p><!-- /wp:paragraph --></div><!-- /wp:group -->';

async function openPage( page, rest, options = {} ) {
	const testPage = await rest.createPage( options );

	await visitEditor(
		page,
		`/types/page/list/all?previewId=${ testPage.id }`
	);
	await expect(
		page.locator( '.cnl-editor-homepage-document__title' )
	).toHaveText( testPage.title, { timeout: 15000 } );

	return testPage;
}

/**
 * A computed style of an element in the canvas.
 *
 * @param {import('@playwright/test').Locator} locator  The element.
 * @param {string}                             property CSS property.
 * @param {?string}                            pseudo   Pseudo-element.
 * @return {Promise<string>} Its value.
 */
function getStyle( locator, property, pseudo = null ) {
	return locator.evaluate(
		( element, [ name, pseudoElement ] ) =>
			element.ownerDocument.defaultView
				.getComputedStyle( element, pseudoElement )
				.getPropertyValue( name ),
		[ property, pseudo ]
	);
}

/**
 * The block wrapping some words in the canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          words
 * @return {import('@playwright/test').Locator} The paragraph block.
 */
function getWords( page, words ) {
	return getCanvasEditor( page )
		.contentFrame()
		.locator( '[data-type="core/paragraph"]', { hasText: words } );
}

/**
 * Open a section's words in Edit, so the rest of the page is outside it.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openFirstSection( page ) {
	const inside = getWords( page, 'Inside a section' );

	await expect( inside ).toBeVisible( { timeout: 15000 } );
	await expect( async () => {
		await inside.click( { position: { x: 8, y: 8 } } );
		await expect( page.locator( '.cnl-section-modes' ) ).toHaveAttribute(
			'data-level',
			'section',
			{ timeout: 1000 }
		);
	} ).toPass( { timeout: 15000 } );
	await clickIntoSection( page, inside );
}

test.describe( 'Canvas styles', () => {
	test( 'outside the open section, words show no text cursor', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: TWO_SECTIONS } );
		await setCanvasMode( page, 'Edit' );
		await openFirstSection( page );

		await expect
			.poll( () =>
				getStyle( getWords( page, 'Another section' ), 'cursor' )
			)
			.toBe( 'default' );
		await expect
			.poll( () =>
				getStyle( getWords( page, 'Inside a section' ), 'cursor' )
			)
			.not.toBe( 'default' );
	} );

	test( 'the styles hold through device and mode changes', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: TWO_SECTIONS } );
		await setCanvasMode( page, 'Compose' );
		await setCanvasMode( page, 'Edit' );

		const menu = await openViewMenu( page );

		await menu.getByRole( 'menuitemradio', { name: /Mobile/ } ).click();
		await closeViewMenu( page );

		await openFirstSection( page );
		await expect
			.poll( () =>
				getStyle( getWords( page, 'Another section' ), 'cursor' )
			)
			.toBe( 'default' );
	} );

	test( 'an empty page keeps room for its placeholder', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Edit' );
		await expect( page.locator( '.cnl-section-modes__empty' ) ).toBeVisible(
			{
				timeout: 15000,
			}
		);

		const root = getCanvasEditor( page )
			.contentFrame()
			.locator( '[data-type="core/post-content"]' );

		await expect
			.poll( async () =>
				parseFloat( await getStyle( root, 'min-height' ) )
			)
			.toBeGreaterThanOrEqual( 320 );
	} );

	test( 'composing, sections are grabbed', async ( { page, rest } ) => {
		await openPage( page, rest, { content: TWO_SECTIONS } );
		await setCanvasMode( page, 'Compose' );
		await expect( getWords( page, 'Inside a section' ) ).toBeVisible( {
			timeout: 15000,
		} );

		await expect
			.poll( () =>
				getStyle( getWords( page, 'Inside a section' ), 'cursor' )
			)
			.toBe( 'grab' );
	} );

	test( 'adding a section in place opens a gap for it', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: TWO_SECTIONS } );
		await setCanvasMode( page, 'Edit' );

		const addSection = page.locator( '.cnl-section-modes__add-section' );

		await expect( getWords( page, 'Another section' ) ).toBeVisible( {
			timeout: 15000,
		} );

		const sectionIds = await page.evaluate( () => {
			const store = window.wp.data.select( 'core/block-editor' );
			const [ root ] = store.getBlocksByName( 'core/post-content' );

			return store.getBlockOrder( root );
		} );
		const sections = sectionIds.map( ( id ) =>
			getCanvasEditor( page ).contentFrame().locator( `#block-${ id }` )
		);

		await expect( async () => {
			await page.mouse.move( 0, 0 );
			await pointAtSection( page, getWords( page, 'Another section' ), {
				timeout: 1000,
			} );
			await expect( addSection.first() ).toBeVisible( {
				timeout: 1000,
			} );
		} ).toPass( { timeout: 15000 } );
		await addSection.first().click();
		await expect(
			page.getByRole( 'region', { name: 'Add a section' } )
		).toBeVisible();

		// The gap opens on one of the sections, before or after it.
		await expect
			.poll( async () => {
				const margins = await Promise.all(
					sections.flatMap( ( section ) => [
						getStyle( section, 'margin-block-start' ),
						getStyle( section, 'margin-block-end' ),
					] )
				);

				return Math.max( ...margins.map( parseFloat ) );
			} )
			.toBeGreaterThan( 100 );
	} );

	test( 'a locked section prompts for its Add, not "/"', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"templateLock":"contentOnly","layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>Locked words</p><!-- /wp:paragraph --><!-- wp:paragraph --><p></p><!-- /wp:paragraph --></div><!-- /wp:group -->',
		} );
		await setCanvasMode( page, 'Edit' );

		const empty = getCanvasEditor( page )
			.contentFrame()
			.locator(
				'[data-rich-text-placeholder="Type / to choose a block"]'
			)
			.first();

		await expect( getWords( page, 'Locked words' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( empty ).toBeAttached();
		await expect
			.poll( () => getStyle( empty, 'content', '::after' ) )
			.toBe( '"Type here, or use Add for a heading, button or image"' );
	} );

	test( 'More control fades the page around the section', async ( {
		page,
		rest,
	} ) => {
		// Sections with a design to keep, which Edit design is for.
		await openPage( page, rest, {
			content: TWO_SECTIONS.replaceAll(
				'{"style"',
				'{"templateLock":"contentOnly","style"'
			),
		} );
		await setCanvasMode( page, 'Edit' );

		const sections = getCanvasEditor( page )
			.contentFrame()
			.locator( '.is-root-container .wp-block-post-content > *' );
		const section = sections.first();
		const other = sections.nth( 1 );

		await expect( section ).toBeVisible( { timeout: 15000 } );
		await pickSectionMode( page, section, 'Edit design' );
		await page
			.locator( '.cnl-section-modes__design' )
			.getByRole( 'button', { name: 'More control', exact: true } )
			.click();
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Freeform' );

		await expect.poll( () => getStyle( other, 'opacity' ) ).toBe( '0.2' );
		await expect.poll( () => getStyle( section, 'opacity' ) ).toBe( '1' );
	} );

	test( 'an open header turns the canvas purple', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest );
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const header = canvas
			.locator( 'header.wp-block-template-part' )
			.first();

		await expect( header ).toBeVisible( { timeout: 15000 } );
		await expect( async () => {
			await pointAtSection( page, header, { timeout: 1000 } );
			await expect(
				page
					.locator( '.cnl-section-modes__bar' )
					.getByRole( 'button', { name: 'Edit header' } )
			).toBeVisible( { timeout: 1000 } );
		} ).toPass( { timeout: 20000 } );
		await pickSectionMode( page, header, 'Edit header' );

		await expect
			.poll( async () =>
				(
					await getStyle(
						canvas.locator( 'body' ),
						'--wp-admin-theme-color'
					)
				).trim()
			)
			.toBe( '#7a00df' );
	} );
} );
