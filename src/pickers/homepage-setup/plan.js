/**
 * What setting up the homepage will do, worked out from the site as it is.
 *
 * WordPress keeps the homepage in three Reading settings: whether the front
 * shows a page or the latest posts (`show_on_front`), which page
 * (`page_on_front`) and which page lists the posts (`page_for_posts`). A
 * workspace expects one way or the other (`home.expectsHomepage` in
 * `src/workspaces/presets.js`). The plan picks the sensible choice for every
 * step, so most people only have to press Continue, and says which steps
 * are worth showing at all.
 *
 * Pure, so it can be tested without a site.
 */

/**
 * Internal dependencies
 */
import { findHomeMenuItem } from '../../routes/content/pages/homepage-state';
import {
	findItemPath,
	getExcludedPageIds,
	hasPageList,
	isPageItem,
} from '../../routes/content/pages/menu-items';

/**
 * Whether a page can stand in for the homepage or the posts: it exists and
 * isn't in the trash.
 *
 * @param {?Object} page Page record.
 * @return {boolean} Whether it can.
 */
function isUsable( page ) {
	return !! page && page.status !== 'trash';
}

/**
 * What the main menu means for the plan.
 *
 * @param {?Object} menu `{ id, blocks }`, the menu in the site header.
 * @return {?Object} `{ id, isAutomatic, blocks }`, or null without a menu.
 */
function getMenuPlan( menu ) {
	if ( ! menu?.id ) {
		return null;
	}

	return {
		blocks: menu.blocks || [],
		id: menu.id,
		// A menu that lists every page picks new ones up by itself.
		isAutomatic: hasPageList( menu.blocks || [] ),
	};
}

/**
 * The page called Home, the obvious homepage. Its address is checked first,
 * then its title, and a published one wins over one that isn't.
 *
 * @param {Object[]} pages     Pages that could be the homepage.
 * @param {Function} getTitle  Returns a page's plain title.
 * @param {string}   homeTitle What a homepage is usually called.
 * @return {?Object} The page, or null when there isn't one.
 */
export function findHomePage( pages, getTitle, homeTitle ) {
	const home = String( homeTitle ).toLowerCase();
	const isHome = ( page ) =>
		page.slug === 'home' ||
		String( getTitle( page ) ).trim().toLowerCase() === home;
	const matches = pages.filter( isHome );

	return (
		matches.find( ( page ) => page.status === 'publish' ) ||
		matches[ 0 ] ||
		null
	);
}

/**
 * Whether a menu already links to a page, or lists it by itself.
 *
 * @param {Object} menu   Result of `getMenuPlan`.
 * @param {number} pageId Page ID.
 * @return {boolean} Whether it does.
 */
export function isPageInMenu( menu, pageId ) {
	if ( ! menu || ! pageId ) {
		return false;
	}

	if ( menu.isAutomatic ) {
		return ! getExcludedPageIds( menu.blocks ).has( Number( pageId ) );
	}

	return !! findItemPath( menu.blocks, ( block ) =>
		isPageItem( block, pageId )
	);
}

/**
 * The plan for moving the homepage to a page.
 *
 * @param {Object}   args
 * @param {Object}   args.site     Reading settings.
 * @param {Object[]} args.pages    Every page.
 * @param {?Object}  args.menu     Result of `getMenuPlan`.
 * @param {Function} args.getTitle Returns a page's plain title.
 * @param {Object}   args.labels   `{ home, posts }`, what new pages
 *                                 are called.
 * @param {string}   args.homeUrl  The site's address.
 * @return {Object} The plan.
 */
function planToPage( { site, pages, menu, getTitle, labels, homeUrl } ) {
	const byId = ( id ) =>
		pages.find( ( page ) => Number( page.id ) === Number( id ) );
	const postsPage = byId( site.page_for_posts );
	const currentHomepage =
		site.show_on_front === 'page' ? byId( site.page_on_front ) : null;
	// The page that's the homepage already, when there is one. Otherwise the
	// page called Home, or else a new one made with that name. Any other
	// page is a choice the person makes for themselves.
	const homepage =
		isUsable( currentHomepage ) &&
		Number( currentHomepage.id ) !== Number( site.page_for_posts )
			? currentHomepage
			: findHomePage(
					pages.filter(
						( page ) =>
							isUsable( page ) &&
							Number( page.id ) !== Number( site.page_for_posts )
					),
					getTitle,
					labels.home
				);
	const reusedPostsPage = isUsable( postsPage ) ? postsPage : null;
	const steps = [ 'homepage', 'posts' ];
	// Only a menu of links needs the pages adding: one that lists every page
	// takes them by itself.
	const needsMenuStep = !! menu && ! menu.isAutomatic;

	if ( needsMenuStep ) {
		steps.push( 'menu' );
	}

	return {
		homepage: {
			newTitle: labels.home,
			page: homepage,
		},
		menu: menu && {
			...menu,
			// Whether the menu already takes visitors home, by a Home link or
			// a link to the page.
			hasHomeLink: !! findHomeMenuItem( menu.blocks, {
				frontPageId: homepage?.id || 0,
				homeUrl,
			} ),
		},
		posts: {
			// A page for the posts is the obvious choice. Some sites don't
			// want a blog at all, so it's one of two, and can change later.
			isOn: true,
			newTitle: labels.posts,
			page: reusedPostsPage,
		},
		steps,
		to: 'page',
		useMenu: needsMenuStep,
	};
}

/**
 * The plan for moving the homepage to the latest posts.
 *
 * @param {Object}   args
 * @param {Object}   args.site  Reading settings.
 * @param {Object[]} args.pages Every page.
 * @param {?Object}  args.menu  Result of `getMenuPlan`.
 * @return {Object} The plan.
 */
function planToPosts( { site, pages, menu } ) {
	const byId = ( id ) =>
		pages.find( ( page ) => Number( page.id ) === Number( id ) );
	const homepage =
		site.show_on_front === 'page' ? byId( site.page_on_front ) : null;
	const postsPage = byId( site.page_for_posts );
	const oldHomepage = isUsable( homepage ) ? homepage : null;
	const oldPostsPage =
		isUsable( postsPage ) && postsPage.status === 'publish'
			? postsPage
			: null;

	// One step for both old pages, when there are any. Without them there's
	// nothing to choose, only the switch to explain.
	const steps = oldHomepage || oldPostsPage ? [ 'oldPages' ] : [ 'latest' ];

	return {
		menu,
		oldHomepage: oldHomepage && {
			// Out of the menu, so it doesn't link home twice.
			isInMenu: isPageInMenu( menu, oldHomepage.id ),
			leaveMenu: isPageInMenu( menu, oldHomepage.id ),
			page: oldHomepage,
			// Kept by default: it's still a page, under Pages.
			toTrash: false,
		},
		oldPostsPage: oldPostsPage && {
			// Out of the menu: its posts are on the homepage now, so it would
			// only show the same thing twice.
			isInMenu: isPageInMenu( menu, oldPostsPage.id ),
			leaveMenu: isPageInMenu( menu, oldPostsPage.id ),
			page: oldPostsPage,
			// Kept by default, like the old homepage.
			toTrash: false,
		},
		steps,
		to: 'posts',
	};
}

/**
 * What setting up the homepage will do, with every choice made sensibly.
 *
 * @param {Object}   args
 * @param {string}   args.expects  `page` or `posts`, what the
 *                                 workspace expects.
 * @param {Object}   args.site     Reading settings:
 *                                 `show_on_front`, `page_on_front`,
 *                                 `page_for_posts`.
 * @param {Object[]} args.pages    Every page that isn't trashed.
 * @param {?Object}  args.menu     `{ id, blocks }`, the menu in the
 *                                 site header, if there is one.
 * @param {Function} args.getTitle Returns a page's plain title.
 * @param {Object}   args.labels   `{ home, posts }`, what new pages
 *                                 are called.
 * @param {string}   args.homeUrl  The site's address.
 * @return {Object} The plan: `to`, the `steps` to show, and one entry per
 *                  thing it changes.
 */
export function getHomepageSetupPlan( {
	expects,
	site = {},
	pages = [],
	menu = null,
	getTitle = ( page ) => page?.title?.raw ?? page?.title ?? '',
	labels = { home: 'Home', posts: 'Blog' },
	homeUrl = '',
} ) {
	const menuPlan = getMenuPlan( menu );

	if ( expects === 'posts' ) {
		return planToPosts( { site, pages, menu: menuPlan } );
	}

	return planToPage( {
		site,
		pages,
		menu: menuPlan,
		getTitle,
		labels,
		homeUrl,
	} );
}

/**
 * Whether the homepage visitors get matches what a workspace expects.
 *
 * @param {Object}  state                  Result of `getHomepageState`.
 * @param {string}  expects                `page` or `posts`.
 * @param {Object}  [options]
 * @param {boolean} [options.hasPostsPage] Whether the site has a page that
 *                                         lists its posts.
 * @return {boolean} Whether they differ, and setting up would help. A theme
 *                   that designs the homepage itself, or a homepage with a
 *                   problem of its own, never counts. Nor does a homepage
 *                   page when the posts have a page of their own: plenty
 *                   of blogs open on a page on purpose, and their posts are
 *                   still a click away.
 */
export function isHomepageMismatched( state, expects, { hasPostsPage } = {} ) {
	if ( ! state || ! expects || state.shows === 'theme' || state.problem ) {
		return false;
	}

	if ( expects === 'posts' && state.shows === 'page' && hasPostsPage ) {
		return false;
	}

	return state.shows !== expects;
}
