const {
	expect,
	expectCanvasMode,
	getSitePreview,
	setCanvasMode,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
	writeParityScreenshot,
} = require( '../utils' );

test.describe( 'Home view', () => {
	test.beforeEach( async ( { page } ) => {
		await visitEditor( page );
	} );

	test( 'offers places to start working on the site', async ( { page } ) => {
		await expect(
			page.getByRole( 'heading', { level: 1, name: 'Home' } )
		).toBeVisible();
		// The site's address links to the live site.
		await expect(
			page.getByRole( 'link', { name: /opens in a new tab/ } ).first()
		).toHaveAttribute( 'target', '_blank' );

		const links = page.getByRole( 'navigation', {
			name: 'Start working on your site',
		} );
		await expect( links.getByRole( 'button' ) ).toHaveCount( 5 );
		for ( const title of [
			'Your homepage',
			'Pages & menu',
			'Name & logo',
			'Colors & fonts',
			'Header & footer',
		] ) {
			await expect(
				links.getByRole( 'button', {
					name: new RegExp( `^${ title }` ),
				} )
			).toBeVisible();
		}
		// Nothing is ticked off or counted.
		await expect( page.getByRole( 'progressbar' ) ).toHaveCount( 0 );
	} );

	test( 'keeps the sidebar links the same size when another screen loads', async ( {
		page,
	} ) => {
		const names = [ 'Dashboard', 'Posts', 'Pages', 'Comments' ];
		const getHeights = () =>
			Promise.all(
				names.map( async ( name ) => {
					const box = await page
						.locator( '#adminmenu li.menu-top > a' )
						.filter( { hasText: new RegExp( `^${ name }` ) } )
						.boundingBox();
					return box.height;
				} )
			);

		const before = await getHeights();

		// Each screen's script arrives when it is first opened, or hovered.
		// One that brings its own copy of a component's styles overrides the
		// sidebar's, which once made every link taller.
		await openSidebarLink( page, 'Pages' );
		await expect(
			getStage( page ).getByRole( 'heading', { level: 2, name: 'Pages' } )
		).toBeVisible();

		expect( await getHeights() ).toEqual( before );
	} );

	test( 'opens the homepage, and shows it in Browse', async ( { page } ) => {
		await page.setViewportSize( { height: 1003, width: 2048 } );

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const document = toolbar.locator( '.cnl-editor-homepage-document' );

		// The canvas opens in Edit; Browse is a switch away.
		await expectCanvasMode( page, 'Edit' );
		await setCanvasMode( page, 'Browse' );
		await expect( getSitePreview( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			toolbar.getByRole( 'group', { name: 'Preview history' } )
		).toBeVisible();
		// Compose is only offered while editing.
		await expect(
			toolbar.getByRole( 'button', { name: 'Compose' } )
		).toHaveCount( 0 );
		await expect(
			toolbar.getByRole( 'button', { name: 'View', exact: true } )
		).toBeVisible();
		await expect(
			document.getByRole( 'heading', { level: 1, name: 'Home' } )
		).toBeVisible();
		await expect(
			document.locator( '.cnl-editor-homepage-document__icon' )
		).toHaveCount( 1 );

		await writeParityScreenshot(
			page.locator( 'body' ),
			'homepage-parity',
			'plugin-homepage-full.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__left' ),
			'homepage-parity',
			'plugin-homepage-left-controls.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__center' ),
			'homepage-parity',
			'plugin-homepage-title-controls.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__right' ),
			'homepage-parity',
			'plugin-homepage-device-controls.png'
		);
	} );
} );
