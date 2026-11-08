/**
 * The workspace presets, and which one is active.
 *
 * Kept apart from `index.js`, which switches between them, so that screens
 * and the chat can read the active workspace without bringing its side
 * effects along.
 *
 * A workspace is organised around what someone came to do, not how much they
 * know. Each one is a set of presentation settings. Surfaces read the setting
 * they care about from `getActiveWorkspace()`, never the workspace's id, so a
 * new workspace is a new entry here rather than a new branch in every
 * surface. Anything a workspace leaves out takes its value from `DEFAULTS`,
 * which is the page-building editor everyone gets to begin with.
 */

/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { layout, pencil, store, tool } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { settings } from '../settings';

export const PREFERENCES_SCOPE = 'create-not-learn-editor';
export const PREFERENCE_NAME = 'workspace';

/**
 * What every workspace starts from.
 *
 * The sidebar lists the same items in every workspace. Only `tuckAdvanced`
 * changes how it shows them.
 *
 * - `home.places`: the places to start on "Home", and in the chat, by id
 *   (see `src/start-places.js`), with `home.copy` rewording any of them. A
 *   place the site has no use for, like a shop on a site without one, is
 *   left out.
 * - `home.adminLinks`: WordPress's own screens to link to under them, by
 *   id (see `src/routes/home/blog-admin-links.js`), for jobs visitors don't
 *   see, like replying to comments. They open in a new tab, with an "All
 *   settings" link under them. One this person can't use is left out.
 * - `home.hint`: the tip under them.
 * - `home.viewLabel`: the link to the live site, under Home's title.
 * - `home.preview`: what Home's canvas opens on. `home` is the homepage;
 *   `posts` is wherever the blog's posts are listed.
 * - `posts`: how the Posts screen lists posts and says what it is for.
 *   `layout` is a DataViews layout; `statusFilter` puts a row of buttons for
 *   core's statuses (All, Published, Drafts, Trash...) under the Posts tab.
 * - `writeInFocus`: whether writing a post opens the editor with everything
 *   but the writing out of the way.
 * - `writingAids`: whether a post open in the editor gets a writer's prompt
 *   and its length (`src/editor-layer/writing-aids.jsx`).
 * - `postKinds`: whether writing a post starts by picking what kind it is,
 *   like a note, a photo or a quote (`src/pickers/post-kinds.jsx`). Each
 *   person can still opt out from the picker.
 * - `tuckAdvanced`: whether the sidebar tucks its Advanced section away:
 *   pinned to the bottom, folded whenever the editor loads, and one icon in
 *   the strip of icons. Without it, Advanced is listed like the other
 *   sections, and opens whenever the workspace is arrived in.
 * - `publishStep`: whether Publish asks "Are you ready to publish?" first,
 *   with the category, tags and when to publish to hand. Only a default:
 *   the person's own choice, from the checkbox on that step, wins.
 */
const DEFAULTS = {
	home: {
		places: [ 'home', 'pages', 'identity', 'style', 'siteParts', 'shop' ],
		copy: {},
		adminLinks: [],
		hint: __(
			'Tip: follow links on the page to visit the rest of your site. Switch to Edit to change what is on it, then zoom out to add and arrange its sections.'
		),
		preview: 'home',
		viewLabel: __( 'View site' ),
	},
	posts: {
		addLabel: null,
		statusFilter: false,
		description: __( 'Your blog posts, newest first.' ),
		layout: 'table',
	},
	writeInFocus: false,
	writingAids: false,
	publishStep: false,
	postKinds: true,
	tuckAdvanced: true,
};

/**
 * Workspace presets. The first is the default.
 *
 * `aliases` are ids the workspace was saved under before it was renamed, so
 * a saved preference still finds it.
 *
 * `isAvailable` says whether the site can use the workspace at all. One it
 * can't isn't offered, and is treated as the default if it was picked.
 */
const PRESETS = [
	{
		id: 'simple',
		label: __( 'Default' ),
		icon: layout,
	},
	{
		id: 'writing',
		aliases: [ 'blogging' ],
		label: __( 'Writing' ),
		icon: pencil,
		home: {
			// The homepage is the same place, and the same screen, as in
			// every other workspace. Name & logo is left to the logo in
			// Home's header, which opens it, and a shop to Plugins in the
			// sidebar.
			// Most used first. A blog's look matters to more people than its
			// homepage, which usually just lists the posts.
			places: [ 'write', 'posts', 'style', 'home' ],
			copy: {
				style: { description: __( 'Pick the look of your blog.' ) },
			},
			// Kept to two, most used first. Every other setting is one
			// "All settings" link under them.
			adminLinks: [ 'comments', 'categories' ],
			hint: __(
				'Tip: follow links on your blog to read it here as visitors do. Open a post to change it.'
			),
			preview: 'posts',
			viewLabel: __( 'View blog' ),
		},
		posts: {
			addLabel: __( 'Write a post' ),
			statusFilter: true,
			description: __(
				'Everything you’ve written. Pick up a draft, or change something you’ve published.'
			),
			layout: 'list',
		},
		writeInFocus: true,
		writingAids: true,
		publishStep: true,
	},
	{
		id: 'selling',
		label: __( 'Selling' ),
		icon: store,
		isAvailable: () => !! settings.shop,
		// The shop first on Home. The rest is as Default has it, so the site
		// is still built the same way.
		home: {
			places: [
				'shop',
				'home',
				'pages',
				'identity',
				'style',
				'siteParts',
			],
		},
	},
	{
		id: 'builder',
		label: __( 'Builder' ),
		icon: tool,
		// For agencies, in-house developers and theme authors, who know what
		// they've come to change: Home goes straight to the site editor's
		// own pieces, site-wide ones first, with no tip under them.
		home: {
			places: [
				'globalStyles',
				'templates',
				'templateParts',
				'patterns',
				'pages',
			],
			copy: {
				pages: {
					description: __( 'Add and edit pages.' ),
					title: __( 'Pages' ),
				},
			},
			hint: null,
		},
		// Templates, template parts and patterns are what these people
		// came for, so they're out with the rest.
		tuckAdvanced: false,
	},
];

export const WORKSPACES = PRESETS.map( ( preset ) => ( {
	...DEFAULTS,
	...preset,
	home: { ...DEFAULTS.home, ...preset.home },
	posts: { ...DEFAULTS.posts, ...preset.posts },
} ) );

export const DEFAULT_WORKSPACE = WORKSPACES[ 0 ];

/**
 * The workspaces this site can use.
 *
 * @return {Object[]} Workspace presets.
 */
export function getAvailableWorkspaces() {
	return WORKSPACES.filter(
		( { isAvailable } ) => ! isAvailable || isAvailable()
	);
}

/**
 * Find a workspace this site can use by id.
 *
 * @param {string} id Workspace id, or one it was saved under before.
 * @return {Object|undefined} Workspace preset, if there is one.
 */
export function findWorkspace( id ) {
	return getAvailableWorkspaces().find(
		( workspace ) =>
			workspace.id === id || workspace.aliases?.includes( id )
	);
}

/**
 * Get a workspace by id, falling back to the default.
 *
 * @param {string} id Workspace id, or one it was saved under before.
 * @return {Object} Workspace preset.
 */
export function getWorkspace( id ) {
	return findWorkspace( id ) || DEFAULT_WORKSPACE;
}

/**
 * Select the active workspace preset.
 *
 * @param {Function} selectFn `select` from `@wordpress/data` or a `useSelect` callback.
 * @return {Object} Workspace preset.
 */
export function getActiveWorkspace( selectFn = select ) {
	return getWorkspace(
		selectFn( preferencesStore ).get( PREFERENCES_SCOPE, PREFERENCE_NAME )
	);
}
