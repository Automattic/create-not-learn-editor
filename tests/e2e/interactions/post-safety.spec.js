/**
 * Autosaves and post locks, as core's post editor has them: an edited post is
 * autosaved on the server and backed up in the browser, discarding its
 * changes throws both away, and a post someone else has open says so, and
 * can be taken over.
 */
const {
	clickIntoSection,
	expect,
	expectCanvasMode,
	getCanvasEditor,
	getEditorCanvas,
	getExitButton,
	pickCanvasMode,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

const SECOND_USER = {
	email: 'cnl-second-editor@example.com',
	name: 'Second Editor',
	password: 'second-editor-password',
	username: 'cnl-second-editor',
};

/**
 * Set how often the editor autosaves on the server and backs up in the
 * browser, in seconds, once it has the post open. Core's are a minute and 15
 * seconds. Each autosave on the server clears the backup in the browser, as
 * the server then has the changes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          intervals
 * @param {number}                          intervals.autosave Server.
 * @param {number}                          intervals.local    Browser.
 */
async function setAutosaveIntervals( page, { autosave, local } ) {
	await page.waitForFunction(
		() =>
			window.wp?.data?.select( 'core/editor' )?.getEditorSettings()
				?.postLockUtils
	);
	await page.evaluate(
		( settings ) =>
			window.wp.data
				.dispatch( 'core/editor' )
				.updateEditorSettings( settings ),
		{ autosaveInterval: autosave, localAutosaveInterval: local }
	);
}

/**
 * The user's autosaves of a post, from the REST API.
 *
 * @param {Object} rest     The REST client.
 * @param {string} restBase The post type's REST base.
 * @param {number} id       The post.
 * @return {Promise<Array>} The autosaves.
 */
function getAutosaves( rest, restBase, id ) {
	return rest.fetch( `/wp/v2/${ restBase }/${ id }/autosaves`, {
		params: { context: 'edit' },
	} );
}

/**
 * Make a second administrator and log them in, in a browser of their own.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {Object}                             rest
 * @param {string}                             baseURL
 * @return {Promise<import('@playwright/test').Page>} Their page.
 */
async function logInSecondUser( browser, rest, baseURL ) {
	const existing = await rest.fetch( '/wp/v2/users', {
		params: { context: 'edit', search: SECOND_USER.username },
	} );
	const user =
		existing.find(
			( { username } ) => username === SECOND_USER.username
		) ||
		( await rest.fetch( '/wp/v2/users', {
			data: { ...SECOND_USER, roles: [ 'administrator' ] },
			method: 'POST',
		} ) );

	rest.onCleanup( () =>
		rest.fetch( `/wp/v2/users/${ user.id }`, {
			method: 'DELETE',
			params: { force: true, reassign: 1 },
		} )
	);

	const context = await browser.newContext( {
		baseURL,
		storageState: { cookies: [], origins: [] },
	} );

	// The login form refuses to log in without its test cookie.
	await context.request.get( '/wp-login.php' );
	await context.request.post( '/wp-login.php', {
		form: {
			log: SECOND_USER.username,
			pwd: SECOND_USER.password,
			redirect_to: '/wp-admin/',
			testcookie: '1',
			'wp-submit': 'Log In',
		},
	} );

	return context.newPage();
}

test.describe( 'Autosaves', () => {
	test( 'an edited post is autosaved on the server, not published', async ( {
		page,
		rest,
	} ) => {
		const post = await rest.createPost( {
			content:
				'<!-- wp:paragraph --><p>Saved words</p><!-- /wp:paragraph -->',
		} );

		await visitEditor( page, `/types/post/edit/${ post.id }` );
		await setAutosaveIntervals( page, { autosave: 1, local: 3600 } );

		const paragraph = getEditorCanvas( page ).getByText( 'Saved words' );
		await paragraph.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' and autosaved words' );

		await expect
			.poll(
				async () =>
					( await getAutosaves( rest, 'posts', post.id ) )[ 0 ]
						?.content?.raw || '',
				{ timeout: 15000 }
			)
			.toContain( 'Saved words and autosaved words' );

		// A published post's autosave is a revision: the post is as it was.
		const saved = await rest.fetch( `/wp/v2/posts/${ post.id }`, {
			params: { context: 'edit' },
		} );
		expect( saved.content.raw ).not.toContain( 'autosaved words' );
	} );

	test( 'a page edited on the site canvas is autosaved and backed up, and Exit throws both away', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( { body: 'Saved page words' } );

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await setCanvasMode( page, 'Edit' );
		await setAutosaveIntervals( page, { autosave: 1, local: 3600 } );

		const words = getCanvasEditor( page )
			.contentFrame()
			.getByText( 'Saved page words' );
		await clickIntoSection( page, words );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );

		await expect
			.poll(
				async () =>
					( await getAutosaves( rest, 'pages', testPage.id ) )[ 0 ]
						?.content?.raw || '',
				{ timeout: 15000 }
			)
			.toContain( 'Saved page words changed' );

		// Then backed up in the browser, without the server.
		await setAutosaveIntervals( page, { autosave: 3600, local: 1 } );
		await page.keyboard.type( ' again' );

		const backupKey = `wp-autosave-block-editor-post-${ testPage.id }`;
		await expect
			.poll(
				() =>
					page.evaluate(
						( key ) => window.sessionStorage.getItem( key ) || '',
						backupKey
					),
				{ timeout: 10000 }
			)
			.toContain( 'Saved page words changed again' );

		await getExitButton( page ).click();

		await expect
			.poll( () =>
				page.evaluate(
					( key ) => window.sessionStorage.getItem( key ),
					backupKey
				)
			)
			.toBeNull();
		await expect
			.poll(
				async () =>
					( await getAutosaves( rest, 'pages', testPage.id ) ).length
			)
			.toBe( 0 );
	} );
} );

test.describe( 'Recovering an autosave', () => {
	test( 'a newer autosave, as a closed tab leaves, is offered and put back as unsaved changes', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage( { body: 'Published words' } );

		// The server stamps the autosave a second after the page, at least.
		await page.waitForTimeout( 1100 );
		await rest.fetch( `/wp/v2/pages/${ testPage.id }/autosaves`, {
			data: {
				content:
					'<!-- wp:paragraph --><p>Words from a closed tab</p><!-- /wp:paragraph -->',
				title: testPage.title,
			},
			method: 'POST',
		} );

		await visitEditor( page, `/types/page/edit/${ testPage.id }` );

		const notice = page
			.locator( '.components-notice' )
			.filter( { hasText: 'There is an autosave of this post' } );
		await expect( notice ).toBeVisible( { timeout: 15000 } );
		await notice
			.getByRole( 'button', { name: 'Restore the autosave' } )
			.click();

		await expect(
			getEditorCanvas( page ).getByText( 'Words from a closed tab' )
		).toBeVisible();
		await expect( notice ).toBeHidden();
		expect(
			await page.evaluate( () =>
				window.wp.data.select( 'core/editor' ).isEditedPostDirty()
			)
		).toBe( true );
	} );
} );

test.describe( 'Post locks', () => {
	test( 'a post someone else has open says so, leaves for the editor, and can be taken over', async ( {
		browser,
		page,
		rest,
	}, testInfo ) => {
		const testPage = await rest.createPage( { body: 'Locked words' } );
		const route = `/types/page/edit/${ testPage.id }`;

		await visitEditor( page, route );
		await expect(
			getEditorCanvas( page ).getByText( 'Locked words' )
		).toBeVisible( { timeout: 15000 } );
		await expect
			.poll( () =>
				page.evaluate( () =>
					window.wp.data.select( 'core/editor' ).getActivePostLock()
				)
			)
			.toBeTruthy();

		// Kept with the editor's own heartbeat, not `heartbeat.js`.
		expect( await page.evaluate( () => typeof window.wp.heartbeat ) ).toBe(
			'undefined'
		);

		const second = await logInSecondUser(
			browser,
			rest,
			testInfo.project.use.baseURL
		);
		const lockedDialog = second.getByRole( 'dialog', {
			name: 'This post is already being edited',
		} );

		await visitEditor( second, route );
		await expect( lockedDialog ).toBeVisible( { timeout: 15000 } );
		await expect( lockedDialog ).toContainText( 'admin' );

		// Exit editor leaves for the editor's own list, not wp-admin's.
		await lockedDialog.getByRole( 'link', { name: 'Exit editor' } ).click();
		await expect( lockedDialog ).toBeHidden();
		await expect( second ).toHaveURL( /page=create-not-learn-editor/ );
		await expect
			.poll( () => new URL( second.url() ).searchParams.get( 'p' ) )
			.toBe( '/types/page' );

		// Taking over comes back to where it was taken over.
		await visitEditor( second, route );
		await lockedDialog.getByRole( 'link', { name: 'Take over' } ).click();
		await expect( second ).toHaveURL( /page=create-not-learn-editor/ );
		await expect(
			getEditorCanvas( second ).getByText( 'Locked words' )
		).toBeVisible( { timeout: 15000 } );
		await expect( lockedDialog ).toBeHidden();

		// And the first user hears of it on their next heartbeat, within
		// 10 seconds while their tab is showing.
		await page.bringToFront();
		await expect(
			page.getByRole( 'dialog', {
				name: 'Someone else has taken over this post',
			} )
		).toBeVisible( { timeout: 30000 } );

		await second.context().close();
	} );

	test( 'on the site canvas, a locked page says so, and Exit editor shows the page', async ( {
		browser,
		rest,
	}, testInfo ) => {
		const testPage = await rest.createPage( {
			body: 'Canvas locked words',
		} );

		// Opened by the first user, as their editor does.
		await rest.fetch(
			`/create-not-learn-editor/v1/post-lock/${ testPage.id }`,
			{ method: 'POST' }
		);

		const second = await logInSecondUser(
			browser,
			rest,
			testInfo.project.use.baseURL
		);
		const lockedDialog = second.getByRole( 'dialog', {
			name: 'This post is already being edited',
		} );

		await visitEditor(
			second,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		// Only viewing the page doesn't need its lock. Editing it does.
		await expectCanvasMode( second, 'Browse' );
		await expect( lockedDialog ).toBeHidden();
		await pickCanvasMode( second, 'Edit' );
		await expect( lockedDialog ).toBeVisible( { timeout: 15000 } );

		await lockedDialog.getByRole( 'link', { name: 'Exit editor' } ).click();
		await expect( lockedDialog ).toBeHidden();
		await expectCanvasMode( second, 'Browse' );
		await expect( second ).toHaveURL( /page=create-not-learn-editor/ );

		await second.context().close();
	} );
} );
