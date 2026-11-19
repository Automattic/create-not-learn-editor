/**
 * The full-screen block editor: core's "Choose a pattern" modal, which the
 * editor layer allows only for a new page in the full-screen editor and closes
 * anywhere else, and dragging a block from anywhere on it, in a post or in the
 * section of a page being edited with More control.
 */
const {
	expect,
	expectBlockEditor,
	getCanvasEditor,
	getEditorCanvas,
	pickSectionMode,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

const START_PATTERNS_MODAL = '.editor-start-page-options__modal';

/**
 * Record, from before the editor loads, each time core's modal is added to
 * the page and whether it was ever on screen in a frame the browser painted,
 * so a test can tell a modal that was closed unseen from one core never
 * opened. Checked a frame at a time because the layer closes it after it is
 * added but before it is painted.
 *
 * @param {import('@playwright/test').Page} page
 */
async function watchStartPatterns( page ) {
	await page.addInitScript( ( selector ) => {
		const openings = [];
		const findOverlay = () =>
			document
				.querySelector( selector )
				?.closest( '.components-modal__screen-overlay' );

		window.__cnlStartPatterns = openings;

		new window.MutationObserver( () => {
			const overlay = findOverlay();

			if ( overlay && ! overlay.dataset.cnlSeen ) {
				overlay.dataset.cnlSeen = 'true';
				openings.push( { visible: false } );
			}
		} ).observe( document, { childList: true, subtree: true } );

		const onFrame = () => {
			if ( findOverlay()?.checkVisibility() && openings.length ) {
				openings[ openings.length - 1 ].visible = true;
			}

			window.requestAnimationFrame( onFrame );
		};

		window.requestAnimationFrame( onFrame );
	}, START_PATTERNS_MODAL );
}

/**
 * Make a published page with no content at all, which core takes for one
 * just made. `rest.createPage()` fills in a paragraph for no content.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @return {Promise<number>} The page's ID.
 */
async function createEmptyPage( rest ) {
	const { id } = await rest.fetch( '/wp/v2/pages', {
		data: { content: '', status: 'publish', title: 'Empty page' },
		method: 'POST',
	} );

	rest.deleteLater( `/wp/v2/pages/${ id }` );

	return id;
}

function getStartPatternsOpenings( page ) {
	return page.evaluate( () => window.__cnlStartPatterns );
}

/**
 * Check core opened the modal and the layer closed it unseen, leaving no
 * modal lock on the page and the user's preference as it was.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectStartPatternsClosed( page ) {
	await expect
		.poll( () => getStartPatternsOpenings( page ), { timeout: 15000 } )
		.not.toHaveLength( 0 );
	expect( await getStartPatternsOpenings( page ) ).toEqual(
		expect.not.arrayContaining( [ { visible: true } ] )
	);

	await expect( page.locator( START_PATTERNS_MODAL ) ).toHaveCount( 0 );
	await expect( page.locator( 'body' ) ).not.toHaveClass( /\bmodal-open\b/ );
	expect(
		await page.evaluate( () =>
			window.wp.data
				.select( 'core/preferences' )
				.get( 'core', 'enableChoosePatternModal' )
		)
	).toBe( true );
}

/**
 * Save core's preference for the modal as on, as wp-admin's editor does when
 * it is closed with "Always show starter patterns" ticked, then put the
 * preferences back when the test ends. This editor doesn't default it on, so
 * without it core never opens the modal.
 *
 * @param {import('./../utils/rest').RestClient} rest
 */
async function enableStartPatterns( rest ) {
	const user = await rest.fetch( '/wp/v2/users/me', {
		params: { context: 'edit' },
	} );
	const saved = user.meta?.persisted_preferences || {};
	const save = ( preferences ) =>
		rest.fetch( '/wp/v2/users/me', {
			data: { meta: { persisted_preferences: preferences } },
			method: 'POST',
		} );

	rest.onCleanup( () => save( saved ) );
	await save( {
		...saved,
		core: { ...saved.core, enableChoosePatternModal: true },
		_modified: new Date().toISOString(),
	} );
}

test.describe( 'Choose a pattern', () => {
	test.beforeEach( async ( { page, rest } ) => {
		await enableStartPatterns( rest );
		await watchStartPatterns( page );
	} );

	test( 'opens for a new page in the full editor', async ( {
		page,
		rest,
	} ) => {
		await visitEditor( page, '/types/page/new' );
		await expectBlockEditor( page );

		const id = await page.evaluate( () =>
			window.wp.data.select( 'core/editor' ).getCurrentPostId()
		);
		rest.deleteLater( `/wp/v2/pages/${ id }` );

		await expect(
			page.getByRole( 'dialog', { name: 'Choose a pattern' } )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'stays closed for a saved empty page in the full editor', async ( {
		page,
		rest,
	} ) => {
		const id = await createEmptyPage( rest );

		await visitEditor( page, `/types/page/edit/${ id }` );
		await expectBlockEditor( page );

		await expectStartPatternsClosed( page );
	} );

	test( 'stays closed for an empty page on the site canvas', async ( {
		page,
		rest,
	} ) => {
		const id = await createEmptyPage( rest );

		await visitEditor( page, `/types/page/list/all?previewId=${ id }` );
		// Edit is where the modal would show.
		await setCanvasMode( page, 'Edit' );

		await expectStartPatternsClosed( page );
	} );
} );

const DRAG_CONTENT = `<!-- wp:paragraph -->
<p>From this week the counter is full of autumn bakes.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>We’re closed on Mondays.</p>
<!-- /wp:paragraph -->

<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p>Tuesday to Friday, 7am to 5pm.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Saturday, 8am to 2pm.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p>12 Mill Lane.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->`;

/**
 * The text of each paragraph, in order, with a column's as a list of its own.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<Array>} The tree.
 */
function getParagraphTree( page ) {
	return page.evaluate( () => {
		const walk = ( blocks ) =>
			blocks.map( ( block ) =>
				block.innerBlocks.length
					? walk( block.innerBlocks )
					: String( block.attributes.content ?? '' )
			);

		return walk( window.wp.data.select( 'core/block-editor' ).getBlocks() );
	} );
}

/**
 * Press at one point and release at another, in steps, as a person drags.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{x: number, y: number}}          from Where the press starts.
 * @param {{x: number, y: number}}          to   Where it is released.
 */
async function dragBetween( page, from, to ) {
	await page.mouse.move( from.x, from.y );
	await page.mouse.down();
	await page.mouse.move( to.x, to.y, { steps: 20 } );
	// Core throttles its drop target, so give it a moment at the drop point.
	await page.waitForTimeout( 300 );
	await page.mouse.move( to.x + 1, to.y );
	await page.mouse.up();
}

test.describe( 'Drag from anywhere', () => {
	let canvas;

	test.beforeEach( async ( { page, rest } ) => {
		const { id } = await rest.createPost( { content: DRAG_CONTENT } );

		await visitEditor( page, `/types/post/edit/${ id }` );
		await expectBlockEditor( page );
		canvas = getEditorCanvas( page );
		await expect(
			canvas.getByText( 'We’re closed on Mondays.' )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'outlines a block that isn’t being edited on hover', async () => {
		const paragraph = canvas.getByText( 'We’re closed on Mondays.' );

		await paragraph.hover();

		await expect( paragraph ).toHaveClass( /cnl-drag-from-anywhere/ );
		await expect( paragraph ).toHaveCSS( 'cursor', 'grab' );
	} );

	test( 'drags a paragraph by its text into a column', async ( { page } ) => {
		const from = await canvas
			.getByText( 'We’re closed on Mondays.' )
			.boundingBox();
		const target = await canvas
			.getByText( 'Saturday, 8am to 2pm.' )
			.boundingBox();

		await dragBetween(
			page,
			{ x: from.x + from.width / 2, y: from.y + from.height / 2 },
			{ x: target.x + 40, y: target.y + target.height * 0.85 }
		);

		await expect
			.poll( () => getParagraphTree( page ) )
			.toEqual( [
				'From this week the counter is full of autumn bakes.',
				[
					[
						'Tuesday to Friday, 7am to 5pm.',
						'Saturday, 8am to 2pm.',
						'We’re closed on Mondays.',
					],
					[ '12 Mill Lane.' ],
				],
			] );
	} );

	test( 'puts the caret where a click without a drag lands', async ( {
		page,
	} ) => {
		const paragraph = canvas.getByText(
			'From this week the counter is full of autumn bakes.'
		);
		const box = await paragraph.boundingBox();

		// A third of the way along the line, well inside a word.
		await page.mouse.click( box.x + box.width / 3, box.y + box.height / 2 );

		await expect
			.poll( () =>
				page.evaluate(
					() =>
						window.wp.data
							.select( 'core/block-editor' )
							.getSelectionStart().offset
				)
			)
			.toBeGreaterThan( 5 );
		const caret = await paragraph.evaluate( ( node ) => {
			const selection = node.ownerDocument.getSelection();

			return {
				collapsed: selection.isCollapsed,
				inParagraph: node.contains( selection.anchorNode ),
			};
		} );

		expect( caret ).toEqual( { collapsed: true, inParagraph: true } );
	} );

	test( 'selects text when dragging over a block being edited', async ( {
		page,
	} ) => {
		const paragraph = canvas.getByText(
			'From this week the counter is full of autumn bakes.'
		);
		const box = await paragraph.boundingBox();
		const y = box.y + box.height / 2;

		await page.mouse.click( box.x + box.width / 2, y );
		await dragBetween(
			page,
			{ x: box.x + 4, y },
			{ x: box.x + box.width / 2, y }
		);

		const selected = await paragraph.evaluate( ( node ) =>
			node.ownerDocument.getSelection().toString()
		);

		expect( selected.length ).toBeGreaterThan( 5 );
		expect( await getParagraphTree( page ) ).toEqual( [
			'From this week the counter is full of autumn bakes.',
			'We’re closed on Mondays.',
			[
				[ 'Tuesday to Friday, 7am to 5pm.', 'Saturday, 8am to 2pm.' ],
				[ '12 Mill Lane.' ],
			],
		] );
	} );
} );

// Two sections with room round their blocks, as a theme's sections have.
const PAGE_SECTIONS = [
	[ 'Alpha one.', 'Alpha two.', 'Alpha three.' ],
	[ 'Beta one.' ],
]
	.map(
		( paragraphs ) =>
			'<!-- wp:group {"style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:80px;padding-bottom:80px">' +
			paragraphs
				.map(
					( text ) =>
						`<!-- wp:paragraph --><p>${ text }</p><!-- /wp:paragraph -->`
				)
				.join( '' ) +
			'</div><!-- /wp:group -->'
	)
	.join( '' );

test.describe( 'Drag from anywhere on a page', () => {
	test( 'works only in the section opened with More control', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( { content: PAGE_SECTIONS } );
		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const sections = canvas.locator(
			'.is-root-container .wp-block-post-content > *'
		);
		const alphaOne = canvas.getByText( 'Alpha one.' );
		const betaOne = canvas.getByText( 'Beta one.' );
		await expect( alphaOne ).toBeVisible( { timeout: 15000 } );

		// Before a section is opened, a press picks it.
		await alphaOne.hover( { force: true } );
		await expect( alphaOne ).not.toHaveClass( /cnl-drag-from-anywhere/ );

		await pickSectionMode( page, sections.first(), 'Edit design' );
		await page
			.locator( '.cnl-section-modes__design' )
			.getByRole( 'button', { name: 'More control', exact: true } )
			.click();
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Freeform' );

		await alphaOne.hover( { force: true } );
		await expect( alphaOne ).toHaveClass( /cnl-drag-from-anywhere/ );
		await betaOne.hover( { force: true } );
		await expect( betaOne ).not.toHaveClass( /cnl-drag-from-anywhere/ );

		const from = await alphaOne.boundingBox();
		const target = await canvas.getByText( 'Alpha two.' ).boundingBox();
		await dragBetween(
			page,
			{ x: from.x + from.width / 2, y: from.y + from.height / 2 },
			{ x: target.x + 40, y: target.y + target.height * 0.85 }
		);

		await expect
			.poll( () =>
				sections
					.first()
					.locator( 'p' )
					.evaluateAll( ( paragraphs ) =>
						paragraphs.map( ( p ) => p.textContent )
					)
			)
			.toEqual( [ 'Alpha two.', 'Alpha one.', 'Alpha three.' ] );
	} );
} );
