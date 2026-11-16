/**
 * Save controls in the canvas toolbar.
 *
 * There used to be a top bar of its own above the stage and canvas, with Go
 * to page, the save controls and an Options menu. Go to page is now the page's
 * name in the canvas toolbar (`src/site-canvas/page-switcher.jsx`), and
 * Preferences is in the workspace menu at the foot of the sidebar. What's left
 * sits at the end of the canvas toolbar: which agent is connected, if one is
 * (see `src/webmcp/connection.js`), and the save controls. The way to the
 * full-screen editor is in the canvas's View menu.
 *
 * A screen with no canvas toolbar, like Media or Posts, has them at the end of
 * its header instead, the same corner of the screen. Boot's own save button,
 * at the foot of the sidebar, would be cut off there: picking a screen folds
 * the sidebar to its strip of icons. `body.cnl-has-canvas-save` says the
 * controls are placed, for `style.scss`, which hides boot's then.
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { AgentStatus } from './agent-status';
import { SaveControls } from './save-controls';

const HAS_CANVAS_SAVE_CLASS = 'cnl-has-canvas-save';

const TOOLBAR_END_SELECTOR =
	'#create-not-learn-editor-app .cnl-editor-homepage-toolbar__right';

// Admin UI's page header, whose class names are hashed: its actions, like
// Add post, when it has some, or else the row its title is in.
const HEADER_SELECTOR =
	'#create-not-learn-editor-app [class*="__page"] > [class*="__header"]';
const HEADER_END_SELECTORS = [
	`${ HEADER_SELECTOR } [class*="__header-actions"]`,
	`${ HEADER_SELECTOR } [class*="__header-content"]`,
];

function CanvasSave() {
	return (
		<div className="cnl-canvas-save">
			<AgentStatus />
			<SaveControls />
		</div>
	);
}

/**
 * Add the save controls to the canvas toolbar on show.
 *
 * Boot has no slot in the canvas's toolbar, and the toolbar comes and goes
 * with the screen, so the controls are rendered once and moved into whichever
 * toolbar is on show, whenever the page changes.
 */
export function mountSaveControls() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-canvas-save-host';
	createRoot( container ).render( <CanvasSave /> );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const toolbarEnd = document.querySelector( TOOLBAR_END_SELECTOR );
		const end =
			toolbarEnd ||
			HEADER_END_SELECTORS.map( ( selector ) =>
				document.querySelector( selector )
			).find( Boolean );

		document.body.classList.toggle( HAS_CANVAS_SAVE_CLASS, Boolean( end ) );
		container.classList.toggle( 'is-in-header', ! toolbarEnd && !! end );

		if ( ! end ) {
			container.remove();
			return;
		}

		// Last, as Save is in core's editor.
		if ( end.lastElementChild !== container ) {
			end.append( container );
		}
	};

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	place();
}
