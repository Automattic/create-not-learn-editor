/**
 * Writing mode, for posts: written rather than designed. Posts aren't built
 * from sections, so a click reaches the words and there is no Zoom out.
 */
const {
	expect,
	getCanvasEditor,
	pickCanvasMode,
	getZoomOutToggle,
	getSitePreview,
	test,
	visitEditor,
} = require( '../utils' );

function paragraph( words ) {
	return `<!-- wp:paragraph --><p>${ words }</p><!-- /wp:paragraph -->`;
}

/**
 * Open a post on the Home screen's site canvas, which follows the preview
 * around the site.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          rest    The REST helper.
 * @param {string}                          content The post's block markup.
 */
async function openPost( page, rest, content ) {
	const post = await rest.createPost( { content } );
	const title = page.locator( '.cnl-editor-homepage-document__title' );

	await visitEditor( page );
	// Posts are reached by following a link in Browse.
	await pickCanvasMode( page, 'Browse' );
	await expect( getSitePreview( page ) ).toBeVisible( { timeout: 15000 } );
	await expect(
		page.locator( '.cnl-editor-preview-canvas__spinner' )
	).toHaveCount( 0, { timeout: 15000 } );

	const preview = await (
		await getSitePreview( page ).elementHandle()
	).contentFrame();

	await preview.evaluate( ( link ) => {
		const url = new URL( window.location.href );

		url.pathname = new URL( link ).pathname;
		window.location.href = url.toString();
	}, post.link );
	await expect( title ).toHaveText( post.title, { timeout: 15000 } );
}

/**
 * The selected block's name and editing mode.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string>} `name mode`, or nothing.
 */
function getSelection( page ) {
	return page.evaluate( () => {
		const store = window.wp.data.select( 'core/block-editor' );
		const clientId = store.getSelectedBlockClientId();

		return clientId
			? `${ store.getBlockName( clientId ) } ${ store.getBlockEditingMode(
					clientId
				) }`
			: '';
	} );
}

test.describe( 'Writing mode', () => {
	test( 'a post is edited without sections, and has nothing to zoom out to', async ( {
		page,
		rest,
	} ) => {
		await openPost(
			page,
			rest,
			paragraph( 'The first paragraph' ) +
				paragraph( 'The second paragraph' )
		);
		// Without Zoom out, Edit is waited for by its editor.
		await pickCanvasMode( page, 'Edit' );
		await expect( getCanvasEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.getByText( 'The second paragraph' )
		).toBeVisible();

		await expect( getZoomOutToggle( page ) ).toHaveCount( 0 );
		await expect(
			page.locator( '.cnl-site-canvas__zoom-controls' )
		).toHaveCount( 0 );

		// The first click reaches the words, with all their tools, tried
		// again until the editor takes clicks.
		await expect( async () => {
			await getCanvasEditor( page )
				.contentFrame()
				.getByText( 'The second paragraph' )
				.click();
			expect( await getSelection( page ) ).toBe(
				'core/paragraph default'
			);
		} ).toPass( { timeout: 15000 } );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.locator( '.block-editor-warning' )
		).toHaveCount( 0 );
	} );
} );
