/**
 * A section in Edit is worked on with core's own block toolbar: while it is
 * picked, its block is selected in core, and what the toolbar's Layout,
 * Colour, Width and Layers open is drawn under it. See
 * `src/block-toolbar/section-controls.jsx` and `section-tool-popover.jsx`.
 */

/**
 * Internal dependencies
 */
import { blockEditorStore, useEffect } from '../../wordpress-packages';
import { setSectionTool, useSectionTool } from '../mode';

// Takes the layer's state and actions it needs, by name.
export function useSectionToolbar( {
	active,
	focusId,
	isComposing,
	isTextSection,
	pickedSection,
	registry,
	sectionIds,
} ) {
	/*
	 * Not a run of text, which has no block of its own, nor zoomed out,
	 * where core's toolbar is hidden, nor on a canvas about one part.
	 */
	const usesToolbar = ( clientId ) =>
		Boolean( clientId ) &&
		! isComposing &&
		! focusId &&
		sectionIds.includes( clientId ) &&
		! isTextSection( clientId );
	const toolbarId =
		! active && usesToolbar( pickedSection ) ? pickedSection : null;

	// Core's selection follows the section picked, and lets go of a section
	// once it isn't.
	useEffect( () => {
		if ( active || isComposing ) {
			return;
		}

		const selected = registry
			.select( blockEditorStore )
			.getSelectedBlockClientId();

		if ( toolbarId ) {
			if ( selected !== toolbarId ) {
				// No initial position, so core leaves focus and the scroll
				// where they are.
				registry
					.dispatch( blockEditorStore )
					.selectBlock( toolbarId, null );
			}
		} else if ( selected && sectionIds.includes( selected ) ) {
			registry.dispatch( blockEditorStore ).clearSelectedBlock();
		}
		// `sectionIds` is read as the section picked changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ active, isComposing, registry, toolbarId ] );

	// What its toolbar's buttons open under it closes once the section isn't
	// the one with the toolbar, unless a new layout has just taken its place.
	const tool = useSectionTool();
	const openTool = tool?.clientId === toolbarId ? tool : null;

	useEffect( () => {
		if ( tool && tool.clientId !== toolbarId ) {
			setSectionTool( null );
		}
	}, [ tool, toolbarId ] );

	return { openTool, toolbarId, usesToolbar };
}
