/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { getMenuBlocks } from '../../../routes/content/pages/menu-items';
import {
	findHomePage,
	getHomepageSetupPlan,
	isHomepageMismatched,
	isPageInMenu,
} from '../plan';

vi.mock( '@wordpress/blocks', () => ( { createBlock: vi.fn() } ) );

const HOME_URL = 'https://example.com/';
const getTitle = ( page ) => page.title;
const labels = { home: 'Home', posts: 'Blog' };

const page = ( id, title, extra = {} ) => ( {
	id,
	slug: title.toLowerCase().replace( /\s+/g, '-' ),
	status: 'publish',
	title,
	...extra,
} );

const home = page( 1, 'Home' );
const about = page( 2, 'About' );
const blog = page( 3, 'Blog' );
const welcome = page( 4, 'Welcome' );

const AUTO_MENU = { blocks: getMenuBlocks( '<!-- wp:page-list /-->' ), id: 9 };

function linksMenu( ...links ) {
	return {
		blocks: getMenuBlocks( links.join( '' ) ),
		id: 9,
	};
}

const pageLink = ( target ) =>
	`<!-- wp:navigation-link {"label":"${ target.title }","type":"page","id":${ target.id },"url":"${ HOME_URL }${ target.slug }/","kind":"post-type"} /-->`;
const homeLink = '<!-- wp:home-link {"label":"Home"} /-->';

function plan( overrides ) {
	return getHomepageSetupPlan( {
		getTitle,
		homeUrl: HOME_URL,
		labels,
		...overrides,
	} );
}

describe( 'findHomePage', () => {
	test( 'finds the page at the address "home"', () => {
		const byAddress = page( 5, 'Start here', { slug: 'home' } );

		expect( findHomePage( [ about, byAddress ], getTitle, 'Home' ) ).toBe(
			byAddress
		);
	} );

	test( 'finds a page titled Home, whatever its case and spacing', () => {
		const shouty = page( 5, '  HOME ', { slug: 'start' } );

		expect( findHomePage( [ about, shouty ], getTitle, 'Home' ) ).toBe(
			shouty
		);
	} );

	test( 'prefers a published page called Home over a draft', () => {
		const draft = page( 5, 'Home', { status: 'draft' } );

		expect( findHomePage( [ draft, home ], getTitle, 'Home' ) ).toBe(
			home
		);
	} );

	test( 'settles for a draft when that is the only one', () => {
		const draft = page( 5, 'Home', { status: 'draft' } );

		expect( findHomePage( [ about, draft ], getTitle, 'Home' ) ).toBe(
			draft
		);
	} );

	test( 'finds nothing when no page is called Home', () => {
		expect( findHomePage( [ about, blog ], getTitle, 'Home' ) ).toBe(
			null
		);
	} );
} );

describe( 'isPageInMenu', () => {
	test( 'counts every page in a menu that lists them by itself', () => {
		const menu = { ...AUTO_MENU, isAutomatic: true };

		expect( isPageInMenu( menu, home.id ) ).toBe( true );
	} );

	test( 'leaves out a page the automatic menu leaves out', () => {
		const menu = {
			blocks: getMenuBlocks(
				'<!-- wp:page-list {"excludedPageIDs":[1]} /-->'
			),
			id: 9,
			isAutomatic: true,
		};

		expect( isPageInMenu( menu, home.id ) ).toBe( false );
		expect( isPageInMenu( menu, about.id ) ).toBe( true );
	} );

	test( 'looks for a link to the page in a menu of links', () => {
		const menu = { ...linksMenu( pageLink( about ) ), isAutomatic: false };

		expect( isPageInMenu( menu, about.id ) ).toBe( true );
		expect( isPageInMenu( menu, home.id ) ).toBe( false );
	} );

	test( 'is false without a menu or a page', () => {
		expect( isPageInMenu( null, home.id ) ).toBe( false );
		expect( isPageInMenu( { ...AUTO_MENU, isAutomatic: true }, 0 ) ).toBe(
			false
		);
	} );
} );

describe( 'getHomepageSetupPlan, to a homepage page', () => {
	const postsFront = {
		page_for_posts: 0,
		page_on_front: 0,
		show_on_front: 'posts',
	};

	test( 'uses the page called Home when there is one', () => {
		const result = plan( {
			expects: 'page',
			pages: [ about, home ],
			site: postsFront,
		} );

		expect( result.to ).toBe( 'page' );
		expect( result.homepage.page ).toBe( home );
	} );

	test( 'offers to make a page called Home when there is none', () => {
		const result = plan( {
			expects: 'page',
			pages: [ about ],
			site: postsFront,
		} );

		expect( result.homepage.page ).toBe( null );
		expect( result.homepage.newTitle ).toBe( 'Home' );
	} );

	test( 'ignores the page the homepage showed before, unless it is called Home', () => {
		const result = plan( {
			expects: 'page',
			pages: [ welcome ],
			site: { ...postsFront, page_on_front: welcome.id },
		} );

		expect( result.homepage.page ).toBe( null );
	} );

	test( 'keeps the page that is already the homepage', () => {
		const result = plan( {
			expects: 'page',
			pages: [ home, welcome ],
			site: {
				page_for_posts: 0,
				page_on_front: welcome.id,
				show_on_front: 'page',
			},
		} );

		expect( result.homepage.page ).toBe( welcome );
	} );

	test( 'never picks the posts page as the homepage', () => {
		const postsHome = page( 5, 'Home', { slug: 'home' } );
		const result = plan( {
			expects: 'page',
			pages: [ postsHome ],
			site: { ...postsFront, page_for_posts: postsHome.id },
		} );

		expect( result.homepage.page ).toBe( null );
	} );

	test( 'skips pages in the trash', () => {
		const trashed = page( 5, 'Home', { status: 'trash' } );
		const result = plan( {
			expects: 'page',
			pages: [ trashed ],
			site: postsFront,
		} );

		expect( result.homepage.page ).toBe( null );
	} );

	test( 'makes a page for the posts by default, called Blog', () => {
		const result = plan( {
			expects: 'page',
			pages: [ home ],
			site: postsFront,
		} );

		expect( result.posts ).toEqual( {
			isOn: true,
			newTitle: 'Blog',
			page: null,
		} );
	} );

	test( 'keeps the posts page the site already has', () => {
		const result = plan( {
			expects: 'page',
			pages: [ home, blog ],
			site: { ...postsFront, page_for_posts: blog.id },
		} );

		expect( result.posts.page ).toBe( blog );
		expect( result.posts.isOn ).toBe( true );
	} );

	test( 'asks about the menu only when its links are set by hand', () => {
		const automatic = plan( {
			expects: 'page',
			menu: AUTO_MENU,
			pages: [ home ],
			site: postsFront,
		} );
		const byHand = plan( {
			expects: 'page',
			menu: linksMenu( pageLink( about ) ),
			pages: [ home, about ],
			site: postsFront,
		} );
		const noMenu = plan( {
			expects: 'page',
			pages: [ home ],
			site: postsFront,
		} );

		expect( automatic.steps ).toEqual( [ 'homepage', 'posts', 'review' ] );
		expect( automatic.useMenu ).toBe( false );
		expect( byHand.steps ).toEqual( [
			'homepage',
			'posts',
			'menu',
			'review',
		] );
		expect( byHand.useMenu ).toBe( true );
		expect( noMenu.steps ).toEqual( [ 'homepage', 'posts', 'review' ] );
		expect( noMenu.menu ).toBe( null );
	} );

	test( 'knows whether the menu already goes home', () => {
		const withHome = plan( {
			expects: 'page',
			menu: linksMenu( homeLink, pageLink( about ) ),
			pages: [ home, about ],
			site: postsFront,
		} );
		const withoutHome = plan( {
			expects: 'page',
			menu: linksMenu( pageLink( about ) ),
			pages: [ home, about ],
			site: postsFront,
		} );

		expect( withHome.menu.hasHomeLink ).toBe( true );
		expect( withoutHome.menu.hasHomeLink ).toBe( false );
	} );
} );

describe( 'getHomepageSetupPlan, to the latest posts', () => {
	const pageFront = {
		page_for_posts: 0,
		page_on_front: home.id,
		show_on_front: 'page',
	};

	test( 'asks about the old homepage, kept and out of the menu by default', () => {
		const result = plan( {
			expects: 'posts',
			menu: AUTO_MENU,
			pages: [ home, about ],
			site: pageFront,
		} );

		expect( result.to ).toBe( 'posts' );
		expect( result.steps ).toEqual( [ 'posts', 'oldHomepage', 'review' ] );
		expect( result.oldHomepage ).toEqual( {
			isInMenu: true,
			leaveMenu: true,
			page: home,
			toTrash: false,
		} );
		expect( result.oldPostsPage ).toBe( null );
	} );

	test( 'leaves the menu alone for an old homepage that is not in it', () => {
		const result = plan( {
			expects: 'posts',
			menu: linksMenu( pageLink( about ) ),
			pages: [ home, about ],
			site: pageFront,
		} );

		expect( result.oldHomepage.isInMenu ).toBe( false );
		expect( result.oldHomepage.leaveMenu ).toBe( false );
	} );

	test( 'asks about the old posts page too, when it is published', () => {
		const result = plan( {
			expects: 'posts',
			menu: AUTO_MENU,
			pages: [ home, blog ],
			site: { ...pageFront, page_for_posts: blog.id },
		} );

		expect( result.steps ).toEqual( [
			'posts',
			'oldHomepage',
			'oldPostsPage',
			'review',
		] );
		expect( result.oldPostsPage ).toEqual( {
			isInMenu: true,
			leaveMenu: true,
			page: blog,
			toTrash: false,
		} );
	} );

	test( 'skips an old posts page that is not published', () => {
		const draftBlog = { ...blog, status: 'draft' };
		const result = plan( {
			expects: 'posts',
			pages: [ home, draftBlog ],
			site: { ...pageFront, page_for_posts: draftBlog.id },
		} );

		expect( result.steps ).toEqual( [ 'posts', 'oldHomepage', 'review' ] );
		expect( result.oldPostsPage ).toBe( null );
	} );

	test( 'has nothing to ask when the latest posts already show', () => {
		const result = plan( {
			expects: 'posts',
			pages: [ home ],
			site: {
				page_for_posts: 0,
				page_on_front: home.id,
				show_on_front: 'posts',
			},
		} );

		expect( result.steps ).toEqual( [ 'posts', 'review' ] );
		expect( result.oldHomepage ).toBe( null );
	} );
} );

describe( 'isHomepageMismatched', () => {
	const showsPosts = { problem: '', shows: 'posts' };
	const showsPage = { problem: '', shows: 'page' };

	test( 'is true when the homepage shows the other thing', () => {
		expect( isHomepageMismatched( showsPosts, 'page' ) ).toBe( true );
		expect( isHomepageMismatched( showsPage, 'posts' ) ).toBe( true );
	} );

	test( 'is false when the homepage shows what is expected', () => {
		expect( isHomepageMismatched( showsPosts, 'posts' ) ).toBe( false );
		expect( isHomepageMismatched( showsPage, 'page' ) ).toBe( false );
	} );

	test( 'ignores a theme that designs the homepage itself', () => {
		expect(
			isHomepageMismatched( { problem: '', shows: 'theme' }, 'page' )
		).toBe( false );
	} );

	test( 'leaves a homepage with a problem to the Pages screen', () => {
		expect(
			isHomepageMismatched(
				{ problem: 'unpublished', shows: 'page' },
				'posts'
			)
		).toBe( false );
	} );

	test( 'lets a blog open on a page when its posts have a page', () => {
		expect(
			isHomepageMismatched( showsPage, 'posts', { hasPostsPage: true } )
		).toBe( false );
		expect(
			isHomepageMismatched( showsPage, 'posts', { hasPostsPage: false } )
		).toBe( true );
	} );

	test( 'still offers a homepage page when the posts have a page', () => {
		expect(
			isHomepageMismatched( showsPosts, 'page', { hasPostsPage: true } )
		).toBe( true );
	} );

	test( 'is false without a state or an expectation', () => {
		expect( isHomepageMismatched( null, 'page' ) ).toBe( false );
		expect( isHomepageMismatched( showsPosts, undefined ) ).toBe( false );
	} );
} );
