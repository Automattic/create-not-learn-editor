/**
 * Word that the site changed without the editor's Save, such as the homepage
 * setup dialog saving straight away (`src/pickers/homepage-setup/`).
 *
 * The canvas reloads its preview when a Save finishes, as it knows the site
 * has changed. A change saved any other way says so here, and every canvas
 * reloads the same way (`use-site-canvas.js`).
 *
 * A window event rather than this module's own state: app init and each
 * route are built separately, each with its own copy of this module.
 */

export const SITE_CHANGED_EVENT = 'cnl-editor-site-changed';

/**
 * Tell every canvas the saved site has changed.
 */
export function announceSiteChanged() {
	window.dispatchEvent( new window.Event( SITE_CHANGED_EVENT ) );
}
