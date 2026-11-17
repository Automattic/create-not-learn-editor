/**
 * A section's own tools on core's toolbar, once the site canvas has picked
 * it and core has its block selected: Add, then its design choices, Layout,
 * Colour and Width, each only when it has something to choose, and Layers,
 * the blocks inside it. Each has its icon and its name.
 *
 * The canvas knows what a section can choose, and draws each choice's
 * options, so this only reads which choices there are and asks for one.
 * Both go through the canvas's store (`src/site-canvas/mode.js`), as the
 * toolbar is built with app init and the canvas with each route.
 */

/**
 * WordPress dependencies
 */
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Core's List View, for the blocks in the section.
	__experimentalListView as ListView,
} from '@wordpress/block-editor';
import { Dropdown, ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { color, layout, listView, stretchWide } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { requestSectionDesign } from '../site-canvas/mode';
import { AddBlockButton, useContainerTitle } from './layout-menu';

// The canvas's names for the choices, and their icons. See `design-bar.jsx`.
const VIEW_ICONS = { layout, color, width: stretchWide };

function getViewLabels() {
	return {
		layout: __( 'Layout' ),
		color: __( 'Colour' ),
		width: __( 'Width' ),
	};
}

/**
 * Layers: the blocks in the section, as core's List View has them, to see
 * how it is built and reach any of them.
 *
 * @param {Object} props
 * @param {string} props.clientId The section.
 * @return {Element} The button and its list.
 */
function LayersButton( { clientId } ) {
	return (
		<Dropdown
			contentClassName="cnl-section-layers"
			popoverProps={ { placement: 'bottom-start' } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<ToolbarButton
					aria-expanded={ isOpen }
					aria-haspopup="true"
					className="cnl-section-tools__button"
					icon={ listView }
					isPressed={ isOpen }
					onClick={ onToggle }
				>
					{ __( 'Layers' ) }
				</ToolbarButton>
			) }
			renderContent={ () => (
				<div className="cnl-section-layers__list">
					<ListView isExpanded rootClientId={ clientId } />
				</div>
			) }
		/>
	);
}

/**
 * @param {Object}   props
 * @param {string}   props.clientId    The section's block.
 * @param {string}   props.name        Its block name.
 * @param {string[]} props.views       The design choices it has.
 * @param {boolean}  props.isContainer Whether it holds other blocks.
 * @return {Element} The controls.
 */
export function SectionControls( { clientId, name, views, isContainer } ) {
	const title = useContainerTitle( clientId, name );
	const labels = getViewLabels();

	return (
		<>
			{ isContainer && (
				<AddBlockButton
					clientId={ clientId }
					text={ __( 'Add' ) }
					title={ title }
				/>
			) }
			{ views.map( ( view ) => (
				<ToolbarButton
					className="cnl-section-tools__button"
					icon={ VIEW_ICONS[ view ] }
					key={ view }
					onClick={ () => requestSectionDesign( { clientId, view } ) }
				>
					{ labels[ view ] }
				</ToolbarButton>
			) ) }
			{ isContainer && <LayersButton clientId={ clientId } /> }
		</>
	);
}
