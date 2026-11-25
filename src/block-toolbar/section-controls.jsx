/**
 * A section's own tools on core's toolbar, once the site canvas has picked
 * it and core has its block selected: Add, then its design choices, Layout,
 * Colour and Width, each only when it has something to choose. Each has its
 * icon and its name, and all but Add open under the toolbar. Layers, the
 * blocks inside it, opens from the section's name (`name-menu.js`).
 *
 * The canvas knows what a section can choose, and draws what each button
 * opens, in a popover hung from the button
 * (`src/site-canvas/section-modes/section-tool-popover.jsx`), so this only
 * reads which choices there are and says which is open. Both go through the
 * canvas's store (`src/site-canvas/mode.js`), as the toolbar is built with
 * app init and the canvas with each route.
 */

/**
 * WordPress dependencies
 */
import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { color, layout, stretchWide } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { toggleSectionTool, useSectionTool } from '../site-canvas/mode';
import { AddBlockButton } from './layout-menu';

// The canvas's names for the choices, and their icons. See `design-bar.jsx`.
const VIEW_ICONS = { layout, color, width: stretchWide };

function getViewLabels() {
	return {
		layout: __( 'Layout', 'create-not-learn-editor' ),
		color: __( 'Colour', 'create-not-learn-editor' ),
		width: __( 'Width', 'create-not-learn-editor' ),
	};
}

/**
 * @param {Object}   props
 * @param {string}   props.clientId    The section's block.
 * @param {string}   props.title       Its name.
 * @param {string[]} props.views       The design choices it has.
 * @param {boolean}  props.isContainer Whether it holds other blocks.
 * @return {Element} The controls.
 */
export function SectionControls( { clientId, title, views, isContainer } ) {
	const labels = getViewLabels();
	const open = useSectionTool();

	return (
		<>
			{ isContainer && (
				<AddBlockButton
					clientId={ clientId }
					text={ __( 'Add', 'create-not-learn-editor' ) }
					title={ title }
				/>
			) }
			{ views.map( ( view ) => {
				const isOpen =
					open?.clientId === clientId && open.view === view;

				return (
					<ToolbarButton
						aria-expanded={ isOpen }
						aria-haspopup="true"
						className="cnl-section-tools__button"
						// Where the canvas hangs the tool's popover.
						data-cnl-section-tool={ view }
						icon={ VIEW_ICONS[ view ] }
						isPressed={ isOpen }
						key={ view }
						onClick={ () => toggleSectionTool( clientId, view ) }
					>
						{ labels[ view ] }
					</ToolbarButton>
				);
			} ) }
		</>
	);
}
