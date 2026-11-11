/**
 * Making and finding things on the lists of templates, site parts and patterns.
 */
const {
	expect,
	expectBlockEditor,
	getRoute,
	getStage,
	getCanvasEditor,
	pickCanvasMode,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

// Posts' Layouts, which opens on the theme's single post layout. The default
// theme's places patterns in it, which core makes content-only sections.
const POST_LAYOUTS = '/types/post/list/all?content=templates';

/**
 * The editing modes of the blocks patterns put in what the editor has open,
 * the pattern's own blocks and everything in them. Not in a header or
 * footer, which keep core's lock.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string[]>} The modes, one per block.
 */
function getPatternBlockModes( page ) {
	return page.evaluate( () => {
		const store = window.wp.data.select( 'core/block-editor' );

		return store
			.getClientIdsWithDescendants()
			.filter(
				( clientId ) =>
					store.getBlockAttributes( clientId )?.metadata
						?.patternName &&
					! store.getBlockParentsByBlockName(
						clientId,
						'core/template-part'
					).length
			)
			.flatMap( ( clientId ) => [
				clientId,
				...store.getClientIdsOfDescendants( clientId ),
			] )
			.map( ( clientId ) => store.getBlockEditingMode( clientId ) );
	} );
}

/**
 * Open Posts' Layouts in Edit.
 *
 * @param {import('@playwright/test').Page} page
 */
async function editPostLayout( page ) {
	await visitEditor( page, POST_LAYOUTS );
	await pickCanvasMode( page, 'Edit' );
	await expect( getCanvasEditor( page ) ).toBeVisible( { timeout: 15000 } );
}

/**
 * Whether core's editor and block editor are set to open up patterns.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<boolean[]>} The editor's setting, then the block editor's.
 */
function getPatternsOpened( page ) {
	return page.evaluate( () => [
		!! window.wp.data.select( 'core/editor' ).getEditorSettings()
			.disableContentOnlyForUnsyncedPatterns,
		!! window.wp.data.select( 'core/block-editor' ).getSettings()
			.disableContentOnlyForUnsyncedPatterns,
	] );
}

/**
 * The `postId` in the route, for routes like `/wp_template?postId=…`.
 *
 * @param {import('@playwright/test').Page} page
 * @return {string|null} The ID.
 */
function getRoutePostId( page ) {
	const [ , search = '' ] = getRoute( page ).split( '?' );

	return new URLSearchParams( search ).get( 'postId' );
}

test.describe( 'Advanced interactions', () => {
	test( 'adds a template and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created template ${ Date.now() }`;

		// Gutenberg's own templates list, which opens what it adds at
		// `/types/wp_template/edit/$id`, sent on to the template editor.
		await visitEditor( page, '/templates' );
		await page.getByRole( 'button', { name: 'Add Template' } ).click();

		await page
			.getByRole( 'dialog', { name: 'Add template' } )
			.getByRole( 'button', { name: /Custom template/ } )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Create custom template',
		} );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog.getByRole( 'button', { name: 'Create' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template\?/ );
		await expectBlockEditor( page );

		const id = getRoutePostId( page );
		expect( id ).toBeTruthy();
		rest.deleteLater( `/wp/v2/templates/${ id }` );

		const template = await rest.fetch( `/wp/v2/templates/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( template.title.raw ).toBe( title );
	} );

	test( 'adds a header site part and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created site part ${ Date.now() }`;

		await visitEditor( page, '/template-parts' );
		await getStage( page )
			.getByRole( 'button', { name: 'Add site part' } )
			.click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a site part' } );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog
			.getByRole( 'combobox' )
			.selectOption( { label: 'Header' } );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template_part\?/ );
		await expectBlockEditor( page );

		const id = getRoutePostId( page );
		expect( id ).toBeTruthy();
		rest.deleteLater( `/wp/v2/template-parts/${ id }` );

		const part = await rest.fetch( `/wp/v2/template-parts/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( part.title.raw ).toBe( title );
		expect( part.area ).toBe( 'header' );
	} );

	test( 'adds a pattern and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created pattern ${ Date.now() }`;

		await visitEditor( page, '/patterns' );
		await getStage( page )
			.getByRole( 'button', { name: 'Add pattern' } )
			.click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a pattern' } );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog.getByRole( 'combobox' ).selectOption( {
			label: 'Let each copy be changed on its own',
		} );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/types\/wp_block\/edit\/\d+$/ );
		await expectBlockEditor( page );

		const id = getRoute( page ).match( /(\d+)$/ )[ 1 ];
		rest.deleteLater( `/wp/v2/blocks/${ id }` );

		const pattern = await rest.fetch( `/wp/v2/blocks/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( pattern.title.raw ).toBe( title );
	} );

	test( 'opens a site part from its card, with nothing selected first', async ( {
		page,
	} ) => {
		await visitEditor( page, '/template-parts' );

		const stage = getStage( page );
		const firstTitle = stage
			.locator( '.cnl-editor-dataviews-title' )
			.first();

		await expect( firstTitle ).toBeVisible( { timeout: 15000 } );
		await expect( stage.getByText( /selected/i ) ).toHaveCount( 0 );

		await firstTitle.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template_part\?/ );
		await expectBlockEditor( page );
	} );

	test( 'finds a saved section by searching', async ( { page, rest } ) => {
		const pattern = await rest.createPattern();

		await visitEditor( page, '/patterns' );

		const stage = getStage( page );
		await stage.getByRole( 'tab', { name: 'Saved by you' } ).click();
		await expect( page ).toHaveURL( /type(?:=|%3D)my-patterns/ );

		await stage.locator( '.dataviews-search input' ).fill( pattern.title );
		await expect(
			stage.getByRole( 'button', { name: pattern.title } ).first()
		).toBeVisible( { timeout: 15000 } );
	} );

	test( "edits the blocks a layout's patterns add with core's full tools", async ( {
		page,
	} ) => {
		await editPostLayout( page );

		await expect
			.poll( async () => ( await getPatternBlockModes( page ) ).length, {
				timeout: 15000,
			} )
			.toBeGreaterThan( 0 );
		await expect
			.poll( async () => [
				...new Set( await getPatternBlockModes( page ) ),
			] )
			.toEqual( [ 'default' ] );
	} );

	test( "hands patterns back to core's lock after a layout", async ( {
		page,
	} ) => {
		await editPostLayout( page );
		await expect
			.poll( () => getPatternsOpened( page ), { timeout: 15000 } )
			.toEqual( [ true, true ] );

		await openSidebarLink( page, 'Pages' );

		await expect
			.poll( () => getPatternsOpened( page ), { timeout: 15000 } )
			.toEqual( [ false, false ] );
	} );
} );
