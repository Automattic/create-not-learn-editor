/*
 * Asks the sidebar, mounted by app init, to take the stage Home and open
 * itself there. Routes are bundled apart from app init, so they ask with an
 * event rather than through a shared module.
 */
export const OPEN_SIDEBAR_HOME_EVENT = 'cnl-editor-open-sidebar-home';

/**
 * Back from a top-level screen: Home, with the sidebar open, where every
 * top-level screen is listed.
 */
export function openSidebarHome() {
	window.dispatchEvent( new window.CustomEvent( OPEN_SIDEBAR_HOME_EVENT ) );
}
