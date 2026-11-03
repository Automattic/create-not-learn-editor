/**
 * Internal dependencies
 */
import { parseBlocks } from '../../wordpress-packages';
import {
	getTemplatePartRawContent,
	NAVIGATION_OVERLAY_AREA,
} from '../navigation/navigation-locations';
import { EMPTY_ARRAY } from './shared';

function getBlockName( block ) {
	return block?.name || block?.blockName;
}

function getBlockAttributes( block ) {
	return block?.attributes || block?.attrs || {};
}

/**
 * Whether a Navigation block shows the menu: it points at it, or points at
 * nothing and so shows whichever menu the site falls back to.
 *
 * @param {Object} block        Navigation block, parsed or built.
 * @param {number} navigationId The menu's ID.
 * @return {boolean} Whether it shows the menu.
 */
export function showsNavigationMenu( block, navigationId ) {
	const { ref } = getBlockAttributes( block );

	return ref === undefined || ref === null || Number( ref ) === navigationId;
}

/**
 * Put the menu's blocks, unsaved edits and all, into every Navigation block
 * that shows it, so a preview shows what the tree shows.
 *
 * @param {Object[]} blocks       Blocks to look through.
 * @param {number}   navigationId The menu's ID.
 * @param {Object[]} menuBlocks   The menu's blocks.
 * @param {boolean}  isOverlay    Whether the blocks are an overlay's, whose
 *                                menus never collapse into a menu button of
 *                                their own, as core renders them.
 * @return {Object[]} The blocks, with the menu in.
 */
function injectNavigationMenuPreviewBlocks(
	blocks,
	navigationId,
	menuBlocks,
	isOverlay
) {
	return ( blocks || EMPTY_ARRAY ).map( ( block ) => {
		const innerBlocks = injectNavigationMenuPreviewBlocks(
			block.innerBlocks,
			navigationId,
			menuBlocks,
			isOverlay
		);

		if (
			getBlockName( block ) !== 'core/navigation' ||
			! showsNavigationMenu( block, navigationId )
		) {
			return {
				...block,
				innerBlocks,
			};
		}

		const attributes = { ...getBlockAttributes( block ) };

		delete attributes.ref;

		if ( isOverlay ) {
			attributes.overlayMenu = 'never';
		}

		return {
			...block,
			attributes,
			innerBlocks: menuBlocks,
		};
	} );
}

/**
 * A template part's blocks, with the menu in its Navigation blocks.
 *
 * @param {Object}   part         Template part record.
 * @param {number}   navigationId The menu's ID.
 * @param {Object[]} menuBlocks   The menu's blocks.
 * @return {Object[]} The part's blocks.
 */
export function getTemplatePartPreviewBlocks( part, navigationId, menuBlocks ) {
	return injectNavigationMenuPreviewBlocks(
		parseBlocks( getTemplatePartRawContent( part ), {
			__unstableSkipMigrationLogs: true,
		} ),
		navigationId,
		menuBlocks,
		part?.area === NAVIGATION_OVERLAY_AREA
	);
}

/**
 * The overlay template part a Navigation block's `overlay` names.
 *
 * @param {Object[]} templateParts The site's template parts.
 * @param {string}   slug          The part's slug.
 * @return {Object|undefined} The part.
 */
export function findOverlayPart( templateParts, slug ) {
	return templateParts.find(
		( part ) => part.slug === slug && part.area === NAVIGATION_OVERLAY_AREA
	);
}
