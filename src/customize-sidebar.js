/*
 * Asks the sidebar, mounted by app init, to open its customizer. Commands
 * are bundled apart from app init, so they ask with an event rather than
 * through a shared module, as `open-sidebar-home.js` does.
 */
export const CUSTOMIZE_SIDEBAR_EVENT = 'cnl-editor-customize-sidebar';

/**
 * Open the sidebar on its customizer, where its items can be rearranged.
 */
export function customizeSidebar() {
	window.dispatchEvent( new window.CustomEvent( CUSTOMIZE_SIDEBAR_EVENT ) );
}
