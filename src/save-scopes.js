/**
 * What each screen beside the canvas edits, for the Save at the top right of
 * its header (`Page`'s `saves`, in `src/stage-page.jsx`). The Save only shows
 * while there's an unsaved change it's true for, and only saves those.
 * Everything else waits for Publish, at the bottom of the sidebar
 * (`src/top-bar/publish.jsx`).
 *
 * Each is called with an unsaved record, as `useChanges` lists them: its
 * `kind`, `name` and `key`, and for one of the site's settings, `property`.
 */

const IDENTITY_SETTINGS = [ 'title', 'description', 'site_logo', 'site_icon' ];
const HOMEPAGE_SETTINGS = [
	'show_on_front',
	'page_on_front',
	'page_for_posts',
];

function isPostType( record, postType ) {
	return record.kind === 'postType' && record.name === postType;
}

function isSiteSetting( record, settings ) {
	return (
		record.kind === 'root' &&
		record.name === 'site' &&
		settings.includes( record.property )
	);
}

// Design, Colors and Fonts: the site's styles.
export const savesStyles = ( record ) =>
	record.kind === 'root' && record.name === 'globalStyles';

// Name & logo.
export const savesIdentity = ( record ) =>
	isSiteSetting( record, IDENTITY_SETTINGS );

// Your homepage: which page is the homepage, and where posts go.
export const savesHomepage = ( record ) =>
	isSiteSetting( record, HOMEPAGE_SETTINGS );

// Header & footer, and each on its own.
export const savesSiteParts = ( record ) =>
	isPostType( record, 'wp_template_part' );

// Menus.
export const savesMenus = ( record ) => isPostType( record, 'wp_navigation' );

// Pages: their order, from dragging them in the list.
export const savesPages = ( record ) => isPostType( record, 'page' );
