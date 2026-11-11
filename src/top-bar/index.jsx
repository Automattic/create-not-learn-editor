/**
 * Save controls in the canvas toolbar.
 *
 * There used to be a top bar of its own above the stage and canvas, with Go
 * to page, the save controls and an Options menu. Go to page is now the page's
 * name in the canvas toolbar (`src/site-canvas/page-switcher.jsx`), and
 * Preferences is in the workspace menu at the foot of the sidebar. What's left
 * sits at the end of the canvas toolbar: which agent is connected, if one is
 * (see `src/webmcp/connection.js`), the save controls, and the Options menu,
 * to open the canvas in the full-screen editor.
 *
 * A screen with no canvas toolbar, like Media or Posts, keeps boot's own save
 * button at the foot of the sidebar instead. `body.cnl-has-canvas-save` says
 * which, for `style.scss`.
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { AgentStatus } from './agent-status';
import { OptionsMenu } from './options-menu';
import { SaveControls } from './save-controls';

const HAS_CANVAS_SAVE_CLASS = 'cnl-has-canvas-save';

const TOOLBAR_END_SELECTOR =
	'#create-not-learn-editor-app .cnl-editor-homepage-toolbar__right';

function CanvasSave() {
	return (
		<div className="cnl-canvas-save">
			<AgentStatus />
			<SaveControls />
			<OptionsMenu />
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

		document.body.classList.toggle(
			HAS_CANVAS_SAVE_CLASS,
			Boolean( toolbarEnd )
		);

		if ( ! toolbarEnd ) {
			container.remove();
			return;
		}

		// Last in the toolbar, as Save and Options are in core's editor.
		if ( toolbarEnd.lastElementChild !== container ) {
			toolbarEnd.append( container );
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
