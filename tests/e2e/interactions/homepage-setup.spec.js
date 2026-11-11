/**
 * Setting up the homepage the way a workspace expects.
 *
 * Writing expects the latest posts on the homepage; every other workspace
 * expects a page. When the site shows the other, Home says so, and its
 * button opens a step-by-step dialog that saves as it finishes. Pages →
 * Homepage → Configure homepage opens the same dialog.
 */
const {
	expect,
	expectSnackbar,
	getSitePreview,
	test,
	visitEditor,
} = require( '../utils' );

const EDITOR_PATH = '/wp-admin/admin.php?page=create-not-learn-editor';
const PREFERENCES_SCOPE = 'create-not-learn-editor';
const READING = [ 'show_on_front', 'page_on_front', 'page_for_posts' ];
const HOMEPAGE_ROUTE = '/types/page/list/all?postId=home&previewId=home';

/**
 * Open the editor in a workspace. It stays the person's workspace until the
 * preferences are put back.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          workspace Workspace ID.
 */
async function visitWorkspace( page, workspace ) {
	await page.goto( `${ EDITOR_PATH }&workspace=${ workspace }` );
}

/**
 * Start with no notice dismissed, in Default, and put the person's
 * preferences back when the test ends.
 *
 * @param {import('./../utils/rest').RestClient} rest
 */
async function resetPreferences( rest ) {
	const user = await rest.fetch( '/wp/v2/users/me', {
		params: { context: 'edit' },
	} );
	const saved = user.meta?.persisted_preferences || {};
	const save = ( preferences ) =>
		rest.fetch( '/wp/v2/users/me', {
			data: { meta: { persisted_preferences: preferences } },
			method: 'POST',
		} );

	rest.onCleanup( () =>
		save( { ...saved, _modified: new Date().toISOString() } )
	);
	await save( {
		...saved,
		[ PREFERENCES_SCOPE ]: {
			...saved[ PREFERENCES_SCOPE ],
			dismissedHomepageNotices: [],
			workspace: 'simple',
		},
		_modified: new Date().toISOString(),
	} );
}

/**
 * Set the Reading settings for the test, and put them back after it.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @param {Object}                               settings Settings to set.
 */
async function setReading( rest, settings ) {
	const original = await rest.fetch( '/wp/v2/settings', {
		params: { _fields: READING.join( ',' ) },
	} );

	rest.onCleanup( () =>
		rest.fetch( '/wp/v2/settings', { data: original, method: 'POST' } )
	);
	await rest.fetch( '/wp/v2/settings', {
		data: { page_for_posts: 0, page_on_front: 0, ...settings },
		method: 'POST',
	} );
}

/**
 * The Reading settings as saved.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @return {Promise<Object>} `show_on_front`, `page_on_front`, `page_for_posts`.
 */
function getReading( rest ) {
	return rest.fetch( '/wp/v2/settings', {
		params: { _fields: READING.join( ',' ) },
	} );
}

/**
 * Delete, when the test ends, any page the dialog makes during it.
 *
 * @param {import('./../utils/rest').RestClient} rest
 */
async function deleteNewPagesLater( rest ) {
	const listIds = async () =>
		(
			await rest.fetch( '/wp/v2/pages', {
				params: {
					_fields: 'id',
					context: 'edit',
					per_page: 100,
					status: 'publish,draft,pending,private,future,trash',
				},
			} )
		).map( ( item ) => item.id );
	const before = new Set( await listIds() );

	rest.onCleanup( async () => {
		for ( const id of await listIds() ) {
			if ( ! before.has( id ) ) {
				await rest.fetch( `/wp/v2/pages/${ id }`, {
					method: 'DELETE',
					params: { force: true },
				} );
			}
		}
	} );
}

/**
 * A page's title and status, as saved.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @param {number}                               id   Page ID.
 * @return {Promise<Object>} `{ status, title }`.
 */
async function getPage( rest, id ) {
	const saved = await rest.fetch( `/wp/v2/pages/${ id }`, {
		params: { _fields: 'status,title', context: 'edit' },
	} );

	return { status: saved.status, title: saved.title.raw };
}

/**
 * Home's places to start, there once Home has loaded.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The links.
 */
function getStartLinks( page ) {
	return page.getByRole( 'navigation', {
		name: 'Start working on your site',
	} );
}

/**
 * Wait until Home has worked out what the homepage shows, so a notice that
 * isn't there can be told apart from one still to come.
 *
 * @param {import('@playwright/test').Page} page
 */
async function waitForHome( page ) {
	await expect( getStartLinks( page ) ).toBeVisible( { timeout: 15000 } );
	await page.waitForFunction( () => {
		const site = window.wp?.data
			?.select( 'core' )
			?.getEntityRecord( 'root', 'site' );

		return site && site.show_on_front !== undefined;
	} );
}

function getDialog( page ) {
	return page.getByRole( 'dialog', { name: 'Configure site homepage' } );
}

/**
 * Press Continue until the last step, then its button, which says what it
 * does.
 *
 * @param {import('@playwright/test').Locator} dialog
 */
async function continueToFinish( dialog ) {
	const finish = dialog.getByRole( 'button', {
		name: /^(Set homepage|Show latest posts)$/,
	} );
	const next = dialog.getByRole( 'button', { name: 'Continue' } );

	// Once it's looked at the site, there's always one or the other.
	await expect( finish.or( next ) ).toBeVisible();

	while ( ! ( await finish.isVisible() ) ) {
		await next.click();
	}

	await finish.click();
	await expect( dialog ).toBeHidden( { timeout: 15000 } );
}

test.describe( 'Homepage setup', () => {
	test.beforeEach( async ( { rest } ) => {
		await resetPreferences( rest );
	} );

	test( 'sets up a homepage page and a page for the posts from the notice', async ( {
		page,
		rest,
	} ) => {
		await setReading( rest, { show_on_front: 'posts' } );
		await deleteNewPagesLater( rest );
		const postsTitle = `Journal ${ Date.now() }`;

		await visitWorkspace( page, 'simple' );
		await page.getByRole( 'button', { name: 'Set up a homepage' } ).click();

		const dialog = getDialog( page );
		await expect(
			dialog.getByRole( 'heading', {
				name: 'Which page should be your homepage?',
			} )
		).toBeVisible();
		// The usual choice is made already, and says so.
		await expect(
			dialog.getByRole( 'radio', {
				name: 'A new page called “Home” Recommended',
			} )
		).toBeChecked();
		await dialog.getByRole( 'button', { name: 'Continue' } ).click();

		await expect(
			dialog.getByRole( 'heading', {
				name: 'Where should your posts go?',
			} )
		).toBeVisible();
		await expect(
			dialog.getByRole( 'radio', { name: 'On a new page' } )
		).toBeChecked();
		await dialog
			.getByRole( 'textbox', { name: 'Page name' } )
			.fill( postsTitle );
		await continueToFinish( dialog );

		await expectSnackbar( page, `Your posts are on “${ postsTitle }”.` );

		const reading = await getReading( rest );
		expect( reading.show_on_front ).toBe( 'page' );
		expect( await getPage( rest, reading.page_on_front ) ).toEqual( {
			status: 'publish',
			title: 'Home',
		} );
		expect( await getPage( rest, reading.page_for_posts ) ).toEqual( {
			status: 'publish',
			title: postsTitle,
		} );

		// Saved straight away, so nothing waits for Save.
		await expect( page.getByText( /unsaved change/ ) ).toHaveCount( 0 );

		// The site matches now, so Home has nothing to say.
		await visitEditor( page );
		await waitForHome( page );
		await expect(
			page.getByText( 'Visitors land on your latest posts' )
		).toHaveCount( 0 );
	} );

	test( 'can leave the posts without a page of their own', async ( {
		page,
		rest,
	} ) => {
		await setReading( rest, { show_on_front: 'posts' } );
		await deleteNewPagesLater( rest );

		await visitWorkspace( page, 'simple' );
		await page.getByRole( 'button', { name: 'Set up a homepage' } ).click();

		const dialog = getDialog( page );
		await dialog.getByRole( 'button', { name: 'Continue' } ).click();
		await dialog
			.getByRole( 'radio', { name: 'I don’t want a blog' } )
			.check();
		await expect(
			dialog.getByRole( 'textbox', { name: 'Page name' } )
		).toBeHidden();
		await continueToFinish( dialog );

		const reading = await getReading( rest );
		expect( reading.show_on_front ).toBe( 'page' );
		expect( reading.page_on_front ).toBeGreaterThan( 0 );
		expect( reading.page_for_posts ).toBe( 0 );
	} );

	test( 'shows the posts first from Writing’s notice, deleting the old homepage when asked', async ( {
		page,
		rest,
	} ) => {
		const oldHome = await rest.createPage( {
			title: `Old home ${ Date.now() }`,
		} );
		await setReading( rest, {
			page_on_front: oldHome.id,
			show_on_front: 'page',
		} );

		await visitWorkspace( page, 'writing' );
		await page
			.getByRole( 'button', { name: 'Show my posts first' } )
			.click();

		const dialog = getDialog( page );
		await expect(
			dialog.getByRole( 'heading', { name: 'Keep your old page?' } )
		).toBeVisible();
		await expect(
			dialog.getByRole( 'radio', {
				name: `Keep “${ oldHome.title }” Recommended`,
			} )
		).toBeChecked();
		await dialog
			.getByRole( 'radio', { name: `Delete “${ oldHome.title }”` } )
			.check();
		// One question, so no steps to count.
		await expect( dialog.getByText( /^Step \d/ ) ).toHaveCount( 0 );
		await continueToFinish( dialog );

		await expectSnackbar(
			page,
			'Your homepage now lists your latest posts.'
		);
		expect( ( await getReading( rest ) ).show_on_front ).toBe( 'posts' );
		expect( ( await getPage( rest, oldHome.id ) ).status ).toBe( 'trash' );
	} );

	test( 'keeps the old homepage by default', async ( { page, rest } ) => {
		const oldHome = await rest.createPage( {
			title: `Old home ${ Date.now() }`,
		} );
		await setReading( rest, {
			page_on_front: oldHome.id,
			show_on_front: 'page',
		} );

		const post = await rest.createPost( {
			content:
				'<!-- wp:paragraph --><p>A post for the homepage</p><!-- /wp:paragraph -->',
		} );
		const preview = getSitePreview( page ).contentFrame();

		await visitWorkspace( page, 'writing' );
		// The preview is Browse's: the canvas opens in Edit.
		await page.getByRole( 'checkbox', { name: 'Browse' } ).check();
		await expect( preview.getByText( oldHome.body ) ).toBeVisible( {
			timeout: 15000,
		} );
		await page
			.getByRole( 'button', { name: 'Show my posts first' } )
			.click();
		await continueToFinish( getDialog( page ) );

		expect( ( await getReading( rest ) ).show_on_front ).toBe( 'posts' );
		expect( ( await getPage( rest, oldHome.id ) ).status ).toBe(
			'publish'
		);

		// The preview shows the homepage as it is now, without a reload.
		await expect(
			preview.getByRole( 'link', { name: post.title } ).first()
		).toBeVisible( { timeout: 15000 } );
		await expect( preview.getByText( oldHome.body ) ).toHaveCount( 0 );
	} );

	test( 'keeps quiet in Writing when the posts have a page of their own', async ( {
		page,
		rest,
	} ) => {
		const homepage = await rest.createPage( { title: 'Front' } );
		const postsPage = await rest.createPage( { title: 'Writing' } );
		await setReading( rest, {
			page_for_posts: postsPage.id,
			page_on_front: homepage.id,
			show_on_front: 'page',
		} );

		await visitWorkspace( page, 'writing' );
		await waitForHome( page );
		await expect(
			page.getByRole( 'button', { name: 'Show my posts first' } )
		).toHaveCount( 0 );
	} );

	test( 'says nothing when the homepage is what the workspace expects', async ( {
		page,
		rest,
	} ) => {
		const homepage = await rest.createPage( { title: 'Front' } );
		await setReading( rest, {
			page_on_front: homepage.id,
			show_on_front: 'page',
		} );

		await visitWorkspace( page, 'simple' );
		await waitForHome( page );
		await expect(
			page.getByRole( 'button', { name: 'Set up a homepage' } )
		).toHaveCount( 0 );
	} );

	test( 'remembers a dismissed notice in that workspace only', async ( {
		page,
		rest,
	} ) => {
		await setReading( rest, { show_on_front: 'posts' } );
		const setUp = page.getByRole( 'button', { name: 'Set up a homepage' } );

		await visitWorkspace( page, 'simple' );
		await expect( setUp ).toBeVisible();
		await page
			.getByRole( 'button', { name: 'Don’t show this again here' } )
			.click();
		await expect( setUp ).toBeHidden();

		await page.waitForFunction(
			( scope ) =>
				window.wp.data
					.select( 'core/preferences' )
					.get( scope, 'dismissedHomepageNotices' )
					?.includes( 'simple' ),
			PREFERENCES_SCOPE
		);
		await visitEditor( page );
		await waitForHome( page );
		await expect( setUp ).toHaveCount( 0 );

		// Another workspace that expects a homepage page still says so.
		await visitWorkspace( page, 'builder' );
		await expect( setUp ).toBeVisible();
	} );

	test( 'Configure homepage opens the same setup, starting on what the homepage shows', async ( {
		page,
		rest,
	} ) => {
		await setReading( rest, { show_on_front: 'posts' } );

		await visitEditor( page, HOMEPAGE_ROUTE );
		await page
			.getByRole( 'button', { name: /^Configure homepage/ } )
			.click();

		const dialog = getDialog( page );
		await expect(
			dialog.getByRole( 'heading', {
				name: 'What should visitors see first?',
			} )
		).toBeVisible();
		await expect(
			dialog.getByRole( 'radio', { name: 'Your latest posts' } )
		).toBeChecked();
		// What the workspace expects is recommended, whatever shows now.
		await expect(
			dialog.getByRole( 'radio', { name: 'A page Recommended' } )
		).toBeVisible();
		// Nothing else to ask, so there are no steps to count.
		await expect( dialog.getByText( /^Step \d/ ) ).toHaveCount( 0 );

		// Choosing a page brings in the steps for one.
		await dialog.getByRole( 'radio', { name: 'A page' } ).check();
		await expect( dialog.getByText( /^Step 1 of [34]$/ ) ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Continue' } ).click();
		await expect(
			dialog.getByRole( 'heading', {
				name: 'Which page should be your homepage?',
			} )
		).toBeVisible();

		// Closing it changes nothing.
		await page.keyboard.press( 'Escape' );
		await expect( dialog ).toBeHidden();
		expect( ( await getReading( rest ) ).show_on_front ).toBe( 'posts' );
	} );

	test( 'links to WordPress’s own guides, opening in a new tab', async ( {
		page,
		rest,
	} ) => {
		await setReading( rest, { show_on_front: 'posts' } );

		await visitWorkspace( page, 'simple' );
		await page.getByRole( 'button', { name: 'Set up a homepage' } ).click();

		const guide = getDialog( page ).getByRole( 'link', {
			name: /Learn more about homepages/,
		} );
		await expect( guide ).toHaveAttribute(
			'href',
			'https://wordpress.org/documentation/article/create-a-static-front-page/'
		);
		await expect( guide ).toHaveAttribute( 'target', '_blank' );
	} );
} );
