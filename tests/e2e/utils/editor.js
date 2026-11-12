const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );
const { expect } = require( '@playwright/test' );

const EDITOR_PATH = '/wp-admin/admin.php?page=create-not-learn-editor';
const PARITY_SCREENSHOTS_DIR = path.join( process.cwd(), '.context' );

/**
 * The admin URL of an editor route.
 *
 * @param {string} [route] Route path, such as `/design/colors`.
 * @return {string} The URL.
 */
function editorUrl( route ) {
	return route
		? `${ EDITOR_PATH }&p=${ encodeURIComponent( route ) }`
		: EDITOR_PATH;
}

/**
 * Open the editor, optionally straight on a route.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          [route] Route path.
 */
async function visitEditor( page, route ) {
	await page.goto( editorUrl( route ) );
}

/**
 * The route the editor is on, decoded, such as `/navigation/edit/12`.
 *
 * @param {import('@playwright/test').Page} page
 * @return {string} The route.
 */
function getRoute( page ) {
	return new URL( page.url() ).searchParams.get( 'p' ) || '';
}

/*
 * Where the editor's screens are in wp-admin's menu, which the editor shows
 * in place of its sidebar (`includes/admin-menu.php`): the menu, then its
 * submenu link when the menu's own link goes elsewhere. Screens wp-admin's
 * menu has no place for are opened by their route.
 */
const SIDEBAR_LINKS = {
	Home: [ 'Dashboard' ],
	Pages: [ 'Pages' ],
	Posts: [ 'Posts' ],
	Media: [ 'Media' ],
	Colors: [ 'Appearance', 'Colors' ],
	Fonts: [ 'Appearance', 'Fonts' ],
	'Site Identity': [ 'Appearance', 'Site Identity' ],
};

const SCREEN_ROUTES = {
	Menus: '/navigation',
	Patterns: '/patterns',
	'Site Overview': '/site-overview',
	'Site parts': '/template-parts',
	Styles: '/styles',
	Templates: '/templates',
};

/**
 * Open one of the editor's screens: from wp-admin's menu, hovering its menu
 * to show the submenu link if need be, or by its route when the menu has no
 * link to it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The screen's name.
 */
async function openSidebarLink( page, name ) {
	if ( SCREEN_ROUTES[ name ] ) {
		await visitEditor( page, SCREEN_ROUTES[ name ] );
		return;
	}

	const menu = page.locator( '#adminmenu' );
	const [ top, sub ] = SIDEBAR_LINKS[ name ] || [ name ];
	const topLink = menu
		.locator( 'li.menu-top > a' )
		.filter( { hasText: new RegExp( `^${ top }` ) } );

	if ( ! sub ) {
		await topLink.click();
		return;
	}

	// wp-admin parks a submenu off screen until its menu is current or
	// hovered, where it still counts as visible.
	const link = menu.getByRole( 'link', { name: sub, exact: true } );
	await expect( async () => {
		await topLink.hover();
		await expect( link ).toBeInViewport( { timeout: 1000 } );
	} ).toPass( { timeout: 15000 } );
	await link.click();
}

/**
 * The white panel beside the canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The panel.
 */
function getStage( page ) {
	return page.locator( '.cnl-editor-stage' );
}

/**
 * Open page layouts from the Pages screen's options menu.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openPageLayouts( page ) {
	await getStage( page )
		.getByRole( 'button', { name: 'Page options', exact: true } )
		.click();
	await page.getByRole( 'menuitem', { name: 'Manage layouts' } ).click();
}

/**
 * A page in the Pages screen's list, whether it is in the main menu or not.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          title The page's title.
 * @return {import('@playwright/test').Locator} The page's item.
 */
function getPageItem( page, title ) {
	const list = getStage( page ).locator( '.cnl-pages-list-view' );

	return list
		.getByRole( 'link', { name: title, exact: true } )
		.or( list.getByRole( 'button', { name: title, exact: true } ) );
}

/**
 * The block editor's content frame.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          [scope] Selector to look within.
 * @return {import('@playwright/test').FrameLocator} The frame.
 */
function getEditorCanvas( page, scope = '' ) {
	return page
		.locator( `${ scope } iframe[name="editor-canvas"]`.trim() )
		.first()
		.contentFrame();
}

/**
 * The site preview frame on Home, Pages and Design.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The frame.
 */
function getSitePreview( page ) {
	return page.locator( 'iframe[title="Site preview"]' );
}

const CANVAS_MODES = [ 'Browse', 'Edit', 'Compose' ];

/**
 * The site canvas's Browse switch: on shows the saved site, off edits it.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The switch.
 */
function getBrowseSwitch( page ) {
	return page
		.locator( '.cnl-site-canvas__browse-toggle' )
		.getByRole( 'checkbox', { name: 'Browse' } );
}

/**
 * Open the site canvas's View menu, with the device and, while editing,
 * Zoom out. Like core's, it stays open when something in it is picked, so
 * it is only opened when it isn't already.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<import('@playwright/test').Locator>} The open menu.
 */
async function openViewMenu( page ) {
	const toggle = page.locator( '.cnl-site-canvas__view-menu-toggle' );

	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) !== 'true' ) {
		await toggle.click();
	}

	const menu = page.getByRole( 'menu', { name: 'View' } );

	await expect( menu ).toBeVisible();

	return menu;
}

/**
 * Close the site canvas's View menu with its button, as Escape could also
 * step out of Compose.
 *
 * @param {import('@playwright/test').Page} page
 */
async function closeViewMenu( page ) {
	const toggle = page.locator( '.cnl-site-canvas__view-menu-toggle' );

	if ( ( await toggle.getAttribute( 'aria-expanded' ) ) === 'true' ) {
		await toggle.click();
	}

	await expect( page.getByRole( 'menu', { name: 'View' } ) ).toHaveCount( 0 );
}

/**
 * The site canvas's Zoom out toggle, which is Compose, offered while editing.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The button.
 */
function getZoomOutToggle( page ) {
	return page.locator( '.cnl-site-canvas__zoom-out-toggle' );
}

/**
 * The mode the site canvas is in, from its controls: Browse or Edit from the
 * Browse switch, and Compose when Zoom out is pressed.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<?string>} `Browse`, `Edit` or `Compose`.
 */
async function getCanvasMode( page ) {
	if ( await getBrowseSwitch( page ).isChecked() ) {
		return 'Browse';
	}

	const zoomOut = getZoomOutToggle( page );

	// Canvases without sections have no Zoom out, so no Compose.
	if ( ( await zoomOut.count() ) === 0 ) {
		return 'Edit';
	}

	return ( await zoomOut.getAttribute( 'aria-pressed' ) ) === 'true'
		? 'Compose'
		: 'Edit';
}

/**
 * Switch the canvas's mode with its controls, without waiting for the canvas
 * to follow. Use `setCanvasMode` unless something, such as the unsaved
 * changes dialog, is expected to hold the switch back.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to pick.
 */
async function pickCanvasMode( page, mode ) {
	if ( ! CANVAS_MODES.includes( mode ) ) {
		throw new Error( `Unknown canvas mode: ${ mode }` );
	}

	const current = await getCanvasMode( page );

	if ( mode === current ) {
		return;
	}

	// Leaving Compose for Edit is Zoom out, pressed again.
	if ( mode === 'Edit' && current === 'Compose' ) {
		await getZoomOutToggle( page ).click();
		return;
	}

	const browseSwitch = getBrowseSwitch( page );

	// Leaving Browse waits for there to be something to edit.
	await expect( browseSwitch ).toBeEnabled( { timeout: 15000 } );

	// Clicked rather than checked, as the canvas may hold the switch back,
	// to ask about unsaved changes first.
	if ( ( mode === 'Browse' ) !== ( current === 'Browse' ) ) {
		await browseSwitch.click();
	}

	if ( mode === 'Compose' ) {
		await expect( getZoomOutToggle( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await getZoomOutToggle( page ).click();
	}
}

/**
 * The block editor inside the site canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The editor's frame element.
 */
function getCanvasEditor( page ) {
	return page.locator( '.cnl-site-canvas iframe[name="editor-canvas"]' );
}

/**
 * Wait for the site canvas to show a mode's surface: the site preview for
 * Browse, the editor for Edit, and the editor zoomed out for Compose.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode.
 */
async function expectCanvasMode( page, mode ) {
	await expect
		.poll( () => getCanvasMode( page ), { timeout: 15000 } )
		.toBe( mode );

	if ( mode === 'Browse' ) {
		await expect( getSitePreview( page ) ).toBeVisible();
		// The canvas only follows pages it has seen finish loading.
		await expect(
			page.locator( '.cnl-editor-preview-canvas__spinner' )
		).toHaveCount( 0, { timeout: 15000 } );
		return;
	}

	await expect( getSitePreview( page ) ).toBeHidden();
	await expect( getCanvasEditor( page ) ).toBeVisible( { timeout: 15000 } );

	// Compose is the same editor, zoomed out.
	const isZoomedOut = () =>
		getCanvasEditor( page )
			.contentFrame()
			.locator( 'html' )
			.getAttribute( 'class' )
			.then( ( value ) => /\bis-zoomed-out\b/.test( value || '' ) );

	await expect
		.poll( isZoomedOut, { timeout: 15000 } )
		.toBe( mode === 'Compose' );
}

/**
 * Switch the site canvas to a mode, and wait for it to show.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to switch to.
 */
async function setCanvasMode( page, mode ) {
	await pickCanvasMode( page, mode );
	await expectCanvasMode( page, mode );
}

/**
 * In Edit, point at a section and pick one of the ways to edit it from the
 * bar over it: Edit design, or Edit header or Edit footer.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target Something in the
 *                                                    section, in the canvas.
 * @param {string}                             mode   The way to edit it.
 */
async function pickSectionMode( page, target, mode ) {
	/*
	 * Pointed at again until the right section is in the mode: the layer
	 * only hears the pointer once the canvas has loaded, and while the page
	 * is still settling, the browser can move a neighbour under the pointer.
	 */
	await expect( async () => {
		const done = page.locator( '.cnl-section-modes__done' );

		if ( await done.count() ) {
			await done.first().click();
		}

		// Edit design has no Done: Escape steps out, a level at a time.
		while ( await page.locator( '.cnl-section-modes__design' ).count() ) {
			await page.keyboard.press( 'Escape' );
		}

		await pointAtSection( page, target, { timeout: 1000 } );
		await page
			.locator( '.cnl-section-modes__bar' )
			.getByRole( 'button', { name: mode, exact: true } )
			.click( { timeout: 2000 } );
		expect(
			await isWithin( page, target, '.cnl-section-modes__outline' )
		).toBe( true );
	} ).toPass( { timeout: 20000 } );
}

/**
 * In Edit, click into a section until the blocks in it are reached: the
 * first click picks the section, a click on a row of cards opens the row,
 * and the next reaches the block, with the caret in its text.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target A block in the section,
 *                                                    in the canvas.
 */
async function clickIntoSection( page, target ) {
	const layer = page.locator( '.cnl-section-modes' );

	await pointAtSection( page, target );
	await expect( async () => {
		const level = await layer.getAttribute( 'data-level' );

		// Near the start of the words, clear of "Add section" in the middle
		// of a short section's edges.
		if ( level !== 'blocks' ) {
			await target.click( { position: { x: 8, y: 8 } } );
		}

		await expect( layer ).toHaveAttribute( 'data-level', 'blocks', {
			timeout: 1000,
		} );
	} ).toPass( { timeout: 20000 } );
}

/**
 * Whether the middle of something on the canvas is inside one of the
 * layer's boxes.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target   On the canvas.
 * @param {string}                             selector The layer's box.
 * @return {Promise<boolean>} Whether it is.
 */
async function isWithin( page, target, selector ) {
	const lit = await page.locator( selector ).first().boundingBox();
	const box = await target.boundingBox();
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;

	return (
		Boolean( lit ) &&
		x >= lit.x &&
		x <= lit.x + lit.width &&
		y >= lit.y &&
		y <= lit.y + lit.height
	);
}

/**
 * In Edit or Compose, point at the section holding something until the
 * layer lights it up, with its bar. Forced, as the bar over a short section
 * covers it once it shows.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target          Something in
 *                                                             the section.
 * @param {Object}                             options
 * @param {number}                             options.timeout How long to
 *                                                             keep trying.
 */
async function pointAtSection( page, target, { timeout = 15000 } = {} ) {
	await expect( async () => {
		await page.mouse.move( 0, 0 );
		await target.hover( { force: true } );
		await expect( page.locator( '.cnl-section-modes__bar' ) ).toBeVisible( {
			timeout: 1000,
		} );
		expect(
			await isWithin( page, target, '.cnl-section-modes__tint' )
		).toBe( true );
	} ).toPass( { timeout } );
}

/**
 * The text of every frame matching a selector.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          selector Frames to read.
 * @return {Promise<string[]>} Their text.
 */
async function getFrameTexts( page, selector ) {
	const texts = [];

	for ( const handle of await page.locator( selector ).elementHandles() ) {
		const frame = await handle.contentFrame();

		if ( frame ) {
			texts.push( await frame.locator( 'body' ).innerText() );
		}
	}

	return texts;
}

/**
 * Check the full block editor opened inside the plugin, not wp-admin's.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectBlockEditor( page ) {
	await expect(
		page.locator( 'iframe[src*="post-new.php"], iframe[src*="post.php"]' )
	).toHaveCount( 0 );
	await expect(
		page
			.locator(
				[
					'.interface-interface-skeleton',
					'.edit-site-layout',
					'.edit-post-layout',
					'.block-editor-writing-flow',
				].join( ', ' )
			)
			.first()
	).toBeVisible( { timeout: 15000 } );
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp}                   message Snackbar text.
 */
async function expectSnackbar( page, message ) {
	await expect(
		page.locator( '.components-snackbar' ).getByText( message )
	).toBeVisible( { timeout: 15000 } );
}

/**
 * The unsaved-changes summary and Save button in the top bar.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The controls.
 */
function getSaveControls( page ) {
	return page.locator( '.cnl-save-controls' );
}

/**
 * Open the Review changes dialog from the top bar.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<import('@playwright/test').Locator>} The dialog.
 */
async function openReviewChanges( page ) {
	await getSaveControls( page )
		.getByRole( 'button', { name: 'Save', exact: true } )
		.click();

	return page.getByRole( 'dialog', { name: 'Review changes' } );
}

/**
 * Add one of the plugin's section templates from the Add a section picker,
 * already open, in place on the canvas or as a modal. The picker in place
 * only shows a few at random, so it goes on to View all sections.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The template's title.
 */
async function pickSectionTemplate( page, name ) {
	const inline = page.getByRole( 'region', { name: 'Add a section' } );
	const modal = page.getByRole( 'dialog', { name: 'Add a section' } );

	await expect( inline.or( modal ) ).toBeVisible();

	if ( await inline.isVisible() ) {
		await inline
			.getByRole( 'button', { name: 'View all sections' } )
			.click();
	}

	await expect( modal ).toBeVisible();
	await modal.getByText( 'Templates', { exact: true } ).click();
	await modal
		.getByRole( 'button', { name: `Add ${ name }`, exact: true } )
		.click();
	await expect( modal ).toBeHidden();
}

/**
 * Save a screenshot for comparing against the prototype by eye. These are
 * not asserted on.
 *
 * @param {import('@playwright/test').Locator} locator What to capture.
 * @param {string}                             folder  Folder in `.context`.
 * @param {string}                             name    File name.
 */
async function writeParityScreenshot( locator, folder, name ) {
	const dir = path.join( PARITY_SCREENSHOTS_DIR, folder );

	await fs.mkdir( dir, { recursive: true } );
	await locator.screenshot( {
		animations: 'disabled',
		path: path.join( dir, name ),
	} );
}

/**
 * Open the Add a page dialog from the Pages screen. With a main menu, Add page
 * is a menu, and Page is one of its options.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openAddPage( page ) {
	const stage = getStage( page );
	await stage
		.getByRole( 'button', { name: 'Add page' } )
		.click( { timeout: 15000 } );

	const pageItem = page.getByRole( 'menuitem', { name: /^Page/ } );
	const dialog = page.getByRole( 'dialog', { name: 'Add a page' } );

	await pageItem.or( dialog ).first().waitFor();

	if ( await pageItem.isVisible() ) {
		await pageItem.click();
	}
}

module.exports = {
	editorUrl,
	expectBlockEditor,
	expectSnackbar,
	expectCanvasMode,
	getCanvasEditor,
	getEditorCanvas,
	getFrameTexts,
	getCanvasMode,
	getBrowseSwitch,
	getPageItem,
	getZoomOutToggle,
	getRoute,
	getSaveControls,
	getSitePreview,
	getStage,
	openAddPage,
	openPageLayouts,
	openReviewChanges,
	openSidebarLink,
	closeViewMenu,
	openViewMenu,
	pickCanvasMode,
	clickIntoSection,
	pickSectionMode,
	pickSectionTemplate,
	pointAtSection,
	setCanvasMode,
	visitEditor,
	writeParityScreenshot,
};
