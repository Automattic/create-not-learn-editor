/**
 * What makes a menu an auto menu, kept apart from the rest of the menu
 * helpers so app init can ask without bringing them along.
 *
 * `cnl_editor_is_auto_menu_content()` in `includes/page-list.php` is the
 * server's side, and must agree with this.
 */

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';

const EMPTY_ARRAY = [];

export function getBlockName( block ) {
	return block?.name || block?.blockName;
}

export function getParsedBlocks( content ) {
	try {
		return parse( content || '' );
	} catch {
		return [];
	}
}

/**
 * Whether a menu is an auto menu: a Page List and nothing else, so it lists
 * every page by itself. A Page List with anything beside it, even a Home link,
 * is a menu set by hand. The Pages and Menus screens both go by this.
 *
 * @param {Object[]} blocks Parsed, editor or plain menu blocks.
 * @return {boolean} Whether it is an auto menu.
 */
export function isAutoMenuBlocks( blocks ) {
	const meaningfulBlocks = ( blocks || EMPTY_ARRAY ).filter(
		( block ) => getBlockName( block ) || block.innerHTML?.trim()
	);

	return (
		meaningfulBlocks.length === 1 &&
		getBlockName( meaningfulBlocks[ 0 ] ) === 'core/page-list'
	);
}

export function isAutoMenuContent( content ) {
	return isAutoMenuBlocks( getParsedBlocks( content ) );
}

/**
 * A menu's blocks as edited: its staged blocks if it has them, or else its
 * content parsed, whether that's a string, the editor's lazy serializer or
 * the REST API's `{ raw }`.
 *
 * @param {Object} record An edited `wp_navigation` record.
 * @return {Object[]} Its blocks.
 */
export function getNavigationBlocksFromEditedRecord( record ) {
	if ( Array.isArray( record?.blocks ) ) {
		return record.blocks;
	}

	const content = record?.content;

	if ( typeof content === 'string' ) {
		return getParsedBlocks( content );
	}

	if ( typeof content === 'function' ) {
		try {
			const serializedContent = content( { blocks: EMPTY_ARRAY } );

			if ( typeof serializedContent === 'string' ) {
				return getParsedBlocks( serializedContent );
			}
		} catch {
			// Fall through to the other persisted shapes.
		}
	}

	return getParsedBlocks(
		typeof content?.raw === 'string' ? content.raw : ''
	);
}
