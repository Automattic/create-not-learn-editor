/**
 * Top bar: the strip of boot's dark frame above the stage and canvas, on
 * every screen, the expanded canvas and small screens included.
 *
 * The site's logo and name are at the start, and open Name & logo. Go to
 * page, which opens the page finder (see `src/page-finder`), is in the
 * middle. At the end are which agent is connected, if one is (see
 * `src/webmcp/connection.js`), the site history, and Publish site, for the changes that are
 * the site's rather than one page's. See `README.md` for how changes are
 * split between Publish site and the canvas's own Save and Publish.
 */

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';
import { AgentStatus } from './agent-status';
import { PublishStatus } from './publish-status';
import { SiteHistory } from './site-history-panel';
import { SiteButton } from './site-button';

function TopBar() {
	return (
		<div className="cnl-top-bar">
			<div className="cnl-top-bar__start">
				<SiteButton />
			</div>
			<div className="cnl-top-bar__center">
				<PageFinder
					className="cnl-go-to-page"
					placeholder={ __( 'Go to page…' ) }
				/>
			</div>
			<div className="cnl-top-bar__end">
				<AgentStatus />
				<SiteHistory />
				<PublishStatus />
			</div>
		</div>
	);
}

/**
 * Add the top bar to boot's layout.
 *
 * Boot has no slot above its surfaces, so the bar is appended to boot's
 * layout element, which covers the whole screen, and positioned in the margin
 * `style.scss` opens above the surfaces. The layout can remount, so the bar
 * is put back whenever it goes missing.
 */
export function mountTopBar() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-top-bar-host';
	createRoot( container ).render( <TopBar /> );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		if ( container.isConnected ) {
			return;
		}

		const layout = document.querySelector(
			'#create-not-learn-editor-app [class*="__layout"]:has(> [class*="__surfaces"])'
		);

		if ( layout && container.parentElement !== layout ) {
			layout.append( container );
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
