/**
 * Content written in the classic editor, or any HTML without block comments,
 * opens as a Classic block, as in core's post editor, on the site canvas and
 * in the full-screen editor. Edited there, it saves back as classic content.
 */
const {
	expect,
	expectBlockEditor,
	getCanvasEditor,
	getEditorCanvas,
	getSaveControls,
	openPostOnSiteCanvas,
	openReviewChanges,
	pickCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

const CLASSIC_CONTENT = [
	'A paragraph written in the classic editor.',
	'',
	'A second paragraph, with <strong>bold</strong> and <a href="https://example.com/">a link</a>.',
	'<ul>',
	'\t<li>First item</li>',
	'\t<li>Second item</li>',
	'</ul>',
	'[gallery ids="1,2"]',
	'',
	'<div class="custom-box">Some freeform HTML</div>',
].join( '\n' );

/**
 * The post's content as saved.
 *
 * @param {Object} rest The REST helper.
 * @param {number} id   The post's ID.
 * @return {Promise<string>} Its raw `post_content`.
 */
async function getSavedContent( rest, id ) {
	const post = await rest.fetch( `/wp/v2/posts/${ id }`, {
		params: { context: 'edit' },
	} );

	return post.content.raw;
}

/**
 * Select the Classic block, open it in the Classic Editor with the block
 * toolbar's Edit, add a word at the end of its first paragraph and save it
 * back to the block.
 *
 * @param {import('@playwright/test').Page}         page
 * @param {import('@playwright/test').FrameLocator} canvas The editor canvas.
 * @param {string}                                  word   The word to add.
 */
async function editClassicBlock( page, canvas, word ) {
	const block = canvas.locator( '.wp-block-freeform' );

	await expect( block ).toContainText( 'A paragraph written', {
		timeout: 15000,
	} );
	await expect( async () => {
		await block.getByText( 'A paragraph written' ).click();
		await expect(
			page.getByRole( 'toolbar', { name: 'Block tools' } )
		).toBeVisible( { timeout: 1000 } );
	} ).toPass( { timeout: 15000 } );
	await page
		.getByRole( 'toolbar', { name: 'Block tools' } )
		.getByRole( 'button', { name: 'Edit', exact: true } )
		.click();

	const modal = page.getByRole( 'dialog', { name: 'Classic Editor' } );
	const tinymce = modal
		.locator( 'iframe[id$="_ifr"]' )
		.first()
		.contentFrame();

	await expect( tinymce.locator( 'body' ) ).toContainText(
		'A paragraph written',
		{ timeout: 15000 }
	);
	const paragraph = tinymce.getByText( 'A paragraph written' );

	await paragraph.click();
	// End doesn't reach the end of a line on every platform.
	await paragraph.evaluate( ( element ) => {
		const selection = element.ownerDocument.getSelection();

		selection.selectAllChildren( element );
		selection.collapseToEnd();
	} );
	await page.keyboard.type( ` ${ word }` );
	await modal.getByRole( 'button', { name: 'Save', exact: true } ).click();
	await expect( modal ).toBeHidden();
	await expect( block ).toContainText( word );
}

/**
 * Check saved content kept what it had and gained the word, with no block
 * comments added.
 *
 * @param {string} content The saved content.
 * @param {string} word    The word added.
 */
function expectClassicContent( content, word ) {
	expect( content ).toContain(
		`A paragraph written in the classic editor. ${ word }`
	);
	expect( content ).toContain( '<strong>bold</strong>' );
	expect( content ).toContain( '[gallery ids="1,2"]' );
	expect( content ).toContain( 'Some freeform HTML' );
	expect( content ).not.toContain( '<!-- wp:' );
}

test.describe( 'Classic content', () => {
	test( 'opens as a Classic block in the full-screen editor, and saves an edit to it', async ( {
		page,
		rest,
	} ) => {
		const post = await rest.createPost( { content: CLASSIC_CONTENT } );

		await visitEditor( page, `/types/post/edit/${ post.id }` );
		await expectBlockEditor( page );

		const canvas = getEditorCanvas( page );

		await expect( canvas.locator( '.wp-block-freeform' ) ).toHaveCount( 1, {
			timeout: 15000,
		} );
		await expect( canvas.locator( '.block-editor-warning' ) ).toHaveCount(
			0
		);
		// It is only for content that has it, so it isn't offered to add.
		expect(
			await page.evaluate( () =>
				window.wp.data
					.select( 'core/block-editor' )
					.getInserterItems()
					.some( ( item ) => item.name === 'core/freeform' )
			)
		).toBe( false );
		// Paragraphs are made from blank lines, as on the site.
		await expect(
			canvas.locator( '.wp-block-freeform p' ).first()
		).toHaveText( 'A paragraph written in the classic editor.' );

		await editClassicBlock( page, canvas, 'Edited' );
		await page
			.locator( '.editor-header' )
			.getByRole( 'button', { name: 'Save', exact: true } )
			.click();
		await expect
			.poll( () => getSavedContent( rest, post.id ), { timeout: 15000 } )
			.toContain( 'Edited' );
		expectClassicContent(
			await getSavedContent( rest, post.id ),
			'Edited'
		);
	} );

	test( 'opens as a Classic block on the site canvas, and saves an edit to it', async ( {
		page,
		rest,
	} ) => {
		const post = await rest.createPost( { content: CLASSIC_CONTENT } );

		await openPostOnSiteCanvas( page, post );
		await pickCanvasMode( page, 'Edit' );
		await expect( getCanvasEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );

		const canvas = getCanvasEditor( page ).contentFrame();

		await expect( canvas.locator( '.wp-block-freeform' ) ).toHaveCount( 1, {
			timeout: 15000,
		} );
		await expect( canvas.locator( '.block-editor-warning' ) ).toHaveCount(
			0
		);

		await editClassicBlock( page, canvas, 'Changed' );

		const review = await openReviewChanges( page );

		await review.getByRole( 'button', { name: /^Save/ } ).click();
		await expect( getSaveControls( page ) ).toContainText(
			'All changes saved',
			{ timeout: 15000 }
		);
		expectClassicContent(
			await getSavedContent( rest, post.id ),
			'Changed'
		);
	} );

	test( 'loads TinyMCE only for a Classic block', async ( {
		page,
		rest,
	} ) => {
		const requests = [];

		page.on( 'request', ( request ) => {
			if ( request.url().includes( 'classic-block-assets' ) ) {
				requests.push( request.url() );
			}
		} );

		const post = await rest.createPost( {
			content:
				'<!-- wp:paragraph --><p>Written with blocks</p><!-- /wp:paragraph -->',
		} );

		await visitEditor( page, `/types/post/edit/${ post.id }` );
		await expectBlockEditor( page );
		await expect(
			getEditorCanvas( page ).getByText( 'Written with blocks' )
		).toBeVisible( { timeout: 15000 } );

		expect( await page.evaluate( () => typeof window.tinymce ) ).toBe(
			'undefined'
		);
		expect( requests ).toEqual( [] );
	} );

	test( 'saves classic content unchanged when only the title is edited', async ( {
		page,
		rest,
	} ) => {
		const post = await rest.createPost( { content: CLASSIC_CONTENT } );
		const original = await getSavedContent( rest, post.id );

		await visitEditor( page, `/types/post/edit/${ post.id }` );
		await expectBlockEditor( page );
		await expect(
			getEditorCanvas( page ).locator( '.wp-block-freeform' )
		).toHaveCount( 1, { timeout: 15000 } );

		// Opening it is not a change.
		const save = page
			.locator( '.editor-header' )
			.getByRole( 'button', { name: 'Save', exact: true } );

		await expect( save ).toBeDisabled();

		const title = getEditorCanvas( page ).getByRole( 'textbox', {
			name: 'Add title',
		} );

		await title.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' renamed' );
		await save.click();
		await expect
			.poll(
				async () =>
					(
						await rest.fetch( `/wp/v2/posts/${ post.id }`, {
							params: { context: 'edit' },
						} )
					).title.raw,
				{ timeout: 15000 }
			)
			.toBe( `${ post.title } renamed` );
		expect( await getSavedContent( rest, post.id ) ).toBe( original );
	} );
} );
