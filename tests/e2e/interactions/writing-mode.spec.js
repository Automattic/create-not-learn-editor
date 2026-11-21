/**
 * Writing mode, for posts: written rather than designed. Posts aren't built
 * from sections, so a click reaches the words and there is no Zoom out.
 */
const {
	expect,
	getCanvasEditor,
	openPostOnSiteCanvas,
	pickCanvasMode,
	getZoomOutToggle,
	test,
} = require( '../utils' );

function paragraph( words ) {
	return `<!-- wp:paragraph --><p>${ words }</p><!-- /wp:paragraph -->`;
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
		await openPostOnSiteCanvas(
			page,
			await rest.createPost( {
				content:
					paragraph( 'The first paragraph' ) +
					paragraph( 'The second paragraph' ),
			} )
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
