/**
 * Carry out a homepage setup plan (`plan.js`), saving straight away.
 *
 * Unlike the rest of the editor, nothing here waits for Save: the person has
 * just been walked through every step, and finishing is their go-ahead. Only
 * the records it changes are saved, each with only the fields it changes, so
 * other unsaved changes stay unsaved.
 *
 * The order keeps a failure harmless: pages first, then the menu, and the
 * Reading settings last. Until those are saved the homepage hasn't changed,
 * so stopping part way leaves visitors with what they had.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, resolveSelect, select } from '@wordpress/data';

/**
 * Internal dependencies
 */
import {
	createNavigationLinkBlockFromPage,
	getNavigationContentFromEditedRecord,
	serializeNavigationBlocks,
} from '../../routes/navigation-edit/navigation-blocks';
import { replacePageLinksWithHomeLinks } from '../../routes/content/pages/homepage-state';
import { announceSiteChanged } from '../../site-canvas/site-changed';
import {
	addItemFirst,
	getMenuBlocks,
	isPageItem,
	removeItem,
	setPageExcluded,
} from '../../routes/content/pages/menu-items';

const READING_SETTINGS = [ 'show_on_front', 'page_on_front', 'page_for_posts' ];

/**
 * Save a page, creating it when it has no ID.
 *
 * @param {Object} record Page fields to save.
 * @return {Promise<Object>} The saved page.
 */
async function savePage( record ) {
	const saved = await dispatch( coreDataStore ).saveEntityRecord(
		'postType',
		'page',
		record,
		{ throwOnError: true }
	);

	return saved;
}

/**
 * A page published, keeping whatever else it has. A page already published
 * is left alone.
 *
 * @param {Object} page Page record.
 * @return {Promise<Object>} The page.
 */
async function publishPage( page ) {
	if ( page.status === 'publish' ) {
		return page;
	}

	return savePage( { id: page.id, status: 'publish' } );
}

/**
 * Change the menu as saved, and the same way in any unsaved changes to it, so
 * saving those later doesn't take this back.
 *
 * @param {number}   menuId    Menu ID.
 * @param {Function} transform Takes the menu's blocks, returns new ones, or
 *                             the same ones when nothing changes.
 */
async function changeMenu( menuId, transform ) {
	const args = [ 'postType', 'wp_navigation', menuId ];
	const saved = await resolveSelect( coreDataStore ).getEntityRecord(
		...args
	);
	const savedBlocks = getMenuBlocks(
		saved?.content?.raw ?? saved?.content ?? ''
	);
	const next = transform( savedBlocks );

	if ( next === savedBlocks ) {
		return;
	}

	const store = select( coreDataStore );
	const hadEdits = store.hasEditsForEntityRecord( ...args );
	const edited = hadEdits
		? getMenuBlocks(
				getNavigationContentFromEditedRecord(
					store.getEditedEntityRecord( ...args )
				)
			)
		: null;

	await dispatch( coreDataStore ).saveEntityRecord(
		'postType',
		'wp_navigation',
		{ id: menuId, content: serializeNavigationBlocks( next ) },
		{ throwOnError: true }
	);

	if ( edited ) {
		dispatch( coreDataStore ).editEntityRecord( ...args, {
			blocks: undefined,
			content: serializeNavigationBlocks( transform( edited ) ),
			selection: undefined,
		} );
	}
}

/**
 * Move a page to the trash, and tell the editor so.
 *
 * Core-data's own `deleteEntityRecord` trashes the page, then throws while
 * taking it out of the lists it holds, so the REST API is asked directly
 * and the lists are fetched again.
 *
 * @param {number} pageId Page ID.
 */
async function trashPage( pageId ) {
	const trashed = await apiFetch( {
		method: 'DELETE',
		path: `/wp/v2/pages/${ pageId }`,
	} );
	const store = dispatch( coreDataStore );

	store.receiveEntityRecords( 'postType', 'page', [ trashed ] );
	store.invalidateResolutionForStoreSelector( 'getEntityRecords' );
}

/**
 * A menu of links without its links to a page. Any under one of them move
 * up into its place.
 *
 * @param {Object[]} blocks Menu blocks.
 * @param {number}   pageId Page ID.
 * @return {Object[]} New blocks, the same ones when none linked the page.
 */
function removePageItems( blocks, pageId ) {
	const matches = ( block ) => isPageItem( block, pageId );
	let next = blocks;
	let removed = removeItem( next, matches );

	while ( removed !== next ) {
		next = removed;
		removed = removeItem( next, matches );
	}

	return next;
}

/**
 * Save the Reading settings, then drop any unsaved changes to them, so a
 * later Save can't undo the switch.
 *
 * @param {Object} settings Reading settings to save.
 */
async function saveReadingSettings( settings ) {
	await dispatch( coreDataStore ).saveEntityRecord(
		'root',
		'site',
		settings,
		{
			throwOnError: true,
		}
	);

	const saved = select( coreDataStore ).getEntityRecord( 'root', 'site' );

	// An edit back to the saved value is no edit at all.
	dispatch( coreDataStore ).editEntityRecord(
		'root',
		'site',
		undefined,
		Object.fromEntries(
			READING_SETTINGS.map( ( name ) => [
				name,
				saved?.[ name ] ?? settings[ name ],
			] )
		),
		{ undoIgnore: true }
	);
}

/**
 * Move the homepage to a page, with the posts on a page of their own.
 *
 * @param {Object} plan      Result of `getHomepageSetupPlan`, as changed in
 *                           the dialog.
 * @param {string} homeLabel What a Home link is called.
 * @return {Promise<Object>} `{ homepage, postsPage }`, the pages used.
 */
async function applyToPage( plan, homeLabel ) {
	const homepage = plan.homepage.page
		? await publishPage( plan.homepage.page )
		: await savePage( {
				content: '',
				status: 'publish',
				title: plan.homepage.newTitle,
			} );
	let postsPage = null;

	if ( plan.posts.isOn ) {
		postsPage = plan.posts.page
			? await publishPage( plan.posts.page )
			: await savePage( {
					content: '',
					status: 'publish',
					title: plan.posts.newTitle,
				} );
	}

	if ( plan.menu ) {
		const pageIds = [ homepage.id, postsPage?.id ].filter( Boolean );

		await changeMenu( plan.menu.id, ( blocks ) => {
			// A menu that lists every page takes both by itself, as long as
			// it isn't leaving them out.
			if ( plan.menu.isAutomatic ) {
				return pageIds.reduce(
					( next, id ) => setPageExcluded( next, id, false ),
					blocks
				);
			}

			if ( ! plan.useMenu ) {
				return blocks;
			}

			let next = blocks;

			if ( ! plan.menu.hasHomeLink ) {
				// A Home link, as the homepage row adds, so it keeps going
				// home whatever the homepage shows.
				next = addItemFirst( next, {
					attributes: { label: homeLabel },
					innerBlocks: [],
					name: 'core/home-link',
				} );
			}

			if (
				postsPage &&
				! next.some( ( block ) => isPageItem( block, postsPage.id ) )
			) {
				next = [
					...next,
					createNavigationLinkBlockFromPage( {
						...postsPage,
						title: postsPage.title?.raw ?? plan.posts.newTitle,
					} ),
				];
			}

			return next;
		} );
	}

	await saveReadingSettings( {
		page_for_posts: postsPage ? postsPage.id : 0,
		page_on_front: homepage.id,
		show_on_front: 'page',
	} );

	return { homepage, postsPage };
}

/**
 * Move the homepage to the latest posts.
 *
 * @param {Object} plan      Result of `getHomepageSetupPlan`, as changed in
 *                           the dialog.
 * @param {string} homeLabel What a Home link is called.
 * @return {Promise<Object>} `{}`.
 */
async function applyToPosts( plan, homeLabel ) {
	const { menu, oldHomepage, oldPostsPage } = plan;

	if ( menu ) {
		await changeMenu( menu.id, ( blocks ) => {
			let next = blocks;

			if ( oldHomepage?.leaveMenu ) {
				next = menu.isAutomatic
					? setPageExcluded( next, oldHomepage.page.id, true )
					: // Links to the page become Home links, so the menu
						// still goes home.
						replacePageLinksWithHomeLinks(
							next,
							oldHomepage.page.id,
							homeLabel
						);
			}

			if ( oldPostsPage?.leaveMenu ) {
				next = menu.isAutomatic
					? setPageExcluded( next, oldPostsPage.page.id, true )
					: removePageItems( next, oldPostsPage.page.id );
			}

			return next;
		} );
	}

	await saveReadingSettings( {
		page_for_posts: 0,
		show_on_front: 'posts',
	} );

	// Last, once they're no longer the homepage or the posts page. To the
	// trash rather than gone, so they can still be brought back.
	for ( const old of [ oldHomepage, oldPostsPage ] ) {
		if ( old?.toTrash ) {
			await trashPage( old.page.id );
		}
	}

	return {};
}

/**
 * Carry out a homepage setup plan.
 *
 * @param {Object} plan              Result of `getHomepageSetupPlan`, as
 *                                   changed in the dialog.
 * @param {Object} options
 * @param {string} options.homeLabel What a Home link is called.
 * @return {Promise<Object>} The pages used.
 */
export async function applyHomepageSetup( plan, { homeLabel } ) {
	const result =
		plan.to === 'posts'
			? await applyToPosts( plan, homeLabel )
			: await applyToPage( plan, homeLabel );

	// Saved without Save, so the canvas has to be told to show it.
	announceSiteChanged();

	return result;
}
