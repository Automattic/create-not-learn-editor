/**
 * The menu on the block's name, for turning it into another block.
 *
 * Core's menu also lists the block's styles, which the options menu now
 * offers with the rest of the block's look, so the stylesheet hides them
 * here. In a locked section core's menu holds nothing but styles, and a
 * block may have nothing to turn into, so when nothing would be left the
 * name stays as a label: no chevron, and it doesn't open. A section's name
 * opens Layers instead.
 */

/**
 * WordPress dependencies
 */
import {
	store as blockEditorStore,
	useBlockEditingMode,
} from '@wordpress/block-editor';
import { store as blocksStore } from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { toggleSectionTool } from '../site-canvas/mode';

const LABEL_CLASS = 'cnl-block-name-is-label';
const SECTION_CLASS = 'cnl-block-name-is-section';
const SECTION_NAME = '--cnl-block-name';
const TOGGLE =
	'.block-editor-block-toolbar__block-controls .block-editor-block-switcher .components-dropdown-menu__toggle';
const OPENING_KEYS = [ 'ArrowDown', 'ArrowUp' ];
// The section whose name opens Layers, the blocks inside it, if any.
let layersSectionId = null;

/**
 * Whether the block's name has anything to offer once its styles are gone:
 * blocks, variations or patterns it can turn into. Core only offers them
 * where the block can be moved, and not for a section.
 *
 * @param {Function} select   Registry select.
 * @param {string}   clientId Block client ID.
 * @return {boolean} Whether it does.
 */
function hasTransforms( select, clientId ) {
	const {
		__experimentalGetPatternTransformItems: getPatternTransformItems,
		canRemoveBlock,
		getBlock,
		getBlockRootClientId,
	} = select( blockEditorStore );
	const { getActiveBlockVariation, getBlockVariations } =
		select( blocksStore );
	const block = getBlock( clientId );

	if ( ! block ) {
		return false;
	}

	const active = getActiveBlockVariation( block.name, block.attributes );
	const variations = (
		getBlockVariations( block.name, 'transform' ) ?? []
	).filter( ( variation ) => variation.name !== active?.name );

	if ( variations.length ) {
		return true;
	}

	const rootClientId = getBlockRootClientId( clientId );

	return (
		canRemoveBlock( clientId ) &&
		( select( blockEditorStore ).getBlockTransformItems(
			[ block ],
			rootClientId
		).length > 0 ||
			!! getPatternTransformItems?.( [ block ], rootClientId )?.length )
	);
}

/**
 * Keep the selected block's name as a label when its menu would be empty.
 * A section of the page isn't turned into another block and is called
 * Section rather than Group: its name opens Layers, the blocks inside it,
 * which the site canvas draws under it, or is a label when it holds none.
 *
 * @param {string}  clientId     Block client ID.
 * @param {?string} sectionTitle The section's name, when it is a section.
 * @param {boolean} hasLayers    Whether the section holds other blocks.
 */
export function useNameMenu(
	clientId,
	sectionTitle = null,
	hasLayers = false
) {
	const isDefaultEditingMode = useBlockEditingMode() === 'default';
	const opensLayers = Boolean( sectionTitle ) && hasLayers;
	const isLabel = useSelect(
		( select ) =>
			! opensLayers &&
			( Boolean( sectionTitle ) ||
				! isDefaultEditingMode ||
				! hasTransforms( select, clientId ) ),
		[ clientId, isDefaultEditingMode, opensLayers, sectionTitle ]
	);

	useEffect( () => {
		if ( ! opensLayers ) {
			return;
		}

		layersSectionId = clientId;

		return () => {
			layersSectionId = null;
		};
	}, [ clientId, opensLayers ] );

	// The name comes from core's label for the button, which says Group for
	// a section, so the stylesheet is given the words to show instead.
	useEffect( () => {
		if ( ! sectionTitle ) {
			return;
		}

		const root = document.documentElement;
		root.classList.add( SECTION_CLASS );
		root.style.setProperty( SECTION_NAME, JSON.stringify( sectionTitle ) );

		return () => {
			root.classList.remove( SECTION_CLASS );
			root.style.removeProperty( SECTION_NAME );
		};
	}, [ sectionTitle ] );

	useEffect( () => {
		if ( ! isLabel ) {
			return;
		}

		const root = document.documentElement;
		root.classList.add( LABEL_CLASS );

		return () => root.classList.remove( LABEL_CLASS );
	}, [ isLabel ] );
}

/**
 * Stop a press on a name that is only a label from opening core's menu,
 * and have a press on a section's name open Layers in its place.
 *
 * @param {Event} event Click or key press anywhere in the document.
 */
function onPress( event ) {
	const isLabel = document.documentElement.classList.contains( LABEL_CLASS );

	if (
		( ! isLabel && ! layersSectionId ) ||
		( event.type === 'keydown' && ! OPENING_KEYS.includes( event.key ) )
	) {
		return;
	}

	const toggle = event.target.closest?.( TOGGLE );

	if ( toggle ) {
		event.preventDefault();
		event.stopPropagation();

		if ( layersSectionId ) {
			toggleSectionTool( layersSectionId, 'layers' );
		}
	}
}

/**
 * Say a name that is only a label can't be pressed, as it is focused.
 *
 * @param {FocusEvent} event Focus anywhere in the document.
 */
function onFocus( event ) {
	const toggle = event.target.closest?.( TOGGLE );

	if ( ! toggle ) {
		return;
	}

	if ( document.documentElement.classList.contains( LABEL_CLASS ) ) {
		toggle.setAttribute( 'aria-disabled', 'true' );
	} else {
		toggle.removeAttribute( 'aria-disabled' );
	}
}

/**
 * Listen for presses on the block's name.
 */
export function registerNameMenu() {
	document.addEventListener( 'click', onPress, true );
	document.addEventListener( 'keydown', onPress, true );
	document.addEventListener( 'focusin', onFocus, true );
}
