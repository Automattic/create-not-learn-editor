/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';
import { decodeEntities } from '@wordpress/html-entities';
import { __, _n, sprintf } from '@wordpress/i18n';

const EXPLICITLY_UNASSIGNED_NAVIGATION_LOCATION = 'rsm-unassigned';

/**
 * The template parts query the Menus, Pages and page finder screens share.
 * Every screen asks with this one object, so core-data fetches it once.
 */
export const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};
const EMPTY_ARRAY = [];

/**
 * The template part area core gives a Navigation block's custom overlay, from
 * WordPress 7.0.
 */
export const NAVIGATION_OVERLAY_AREA = 'navigation-overlay';

function getTemplatePartAreaPriority( part ) {
	switch ( part.area ) {
		case 'header':
			return 0;
		case 'footer':
			return 1;
		case 'sidebar':
			return 2;
		case 'navigation-overlay':
			return 3;
		case 'uncategorized':
			return 4;
		default:
			return 5;
	}
}

export function compareTemplatePartsByArea( firstPart, secondPart ) {
	const areaDifference =
		getTemplatePartAreaPriority( firstPart ) -
		getTemplatePartAreaPriority( secondPart );

	if ( areaDifference !== 0 ) {
		return areaDifference;
	}

	return getLocationLabel( firstPart ).localeCompare(
		getLocationLabel( secondPart )
	);
}

export function getTemplatePartTitle( part ) {
	const title =
		typeof part?.title === 'string'
			? part.title
			: part?.title?.rendered || part?.title?.raw;

	return title ? decodeEntities( title.replace( /<[^>]+>/g, '' ) ) : '';
}

export function getLocationLabel( part ) {
	const title = getTemplatePartTitle( part );

	if ( title ) {
		return title;
	}

	switch ( part?.area ) {
		case 'header':
			return __( 'Header' );
		case 'footer':
			return __( 'Footer' );
		case 'sidebar':
			return __( 'Side area' );
		case 'navigation-overlay':
			return __( 'Navigation overlay' );
		case 'uncategorized':
			return __( 'General area' );
		default:
			return __( 'Site area' );
	}
}

export function getLocationAreaLabel( part ) {
	switch ( part?.area ) {
		case 'header':
			return __( 'Header' );
		case 'footer':
			return __( 'Footer' );
		case 'sidebar':
			return __( 'Side area' );
		case 'navigation-overlay':
			return __( 'Navigation overlay' );
		case 'uncategorized':
			return __( 'General area' );
		default:
			return part?.area || __( 'Site area' );
	}
}

export function getLocationsSummary( locations ) {
	if ( ! locations?.length ) {
		return __( 'Not used' );
	}

	return sprintf(
		/* translators: %d: Number of locations where this navigation menu is shown. */
		_n( '%d location', '%d locations', locations.length ),
		locations.length
	);
}

export function getTemplatePartRawContent( part ) {
	if ( typeof part?.content === 'string' ) {
		return part.content;
	}

	return part?.content?.raw || '';
}

/**
 * The part's content with its edits. Once the editor has changed a part's
 * blocks, core keeps its edited content as a function that serialises them,
 * not a string, so it is called here. Read as it is, the part would look
 * empty, and the menus in it would seem to have gone.
 *
 * @param {Object} part       Template part record.
 * @param {Object} editedPart The part's edited record.
 * @return {*} Its content, as the record keeps it.
 */
function getEditedContent( part, editedPart ) {
	if ( typeof editedPart.content === 'function' ) {
		return editedPart.content( editedPart );
	}

	return editedPart.content === undefined ? part.content : editedPart.content;
}

export function mergeTemplatePartWithEditedRecord( part, editedPart ) {
	if ( ! editedPart ) {
		return part;
	}

	return {
		...part,
		...editedPart,
		content: getEditedContent( part, editedPart ),
		id: part.id,
	};
}

/**
 * Merge template parts with their edits, handing back the same list until a
 * part or its edits change.
 *
 * Meant to be called from a `useSelect`, which runs on every change in core
 * data. A new list each time would re-render its users and parse every part
 * again to find its menus.
 *
 * @return {Function} Called with the parts and a function returning a part's
 *                    edited record by ID. Returns the merged parts.
 */
export function createEditedTemplatePartsCache() {
	let lastParts = null;
	let lastEdited = [];
	let merged = [];

	return ( parts, getEditedPart ) => {
		const edited = parts.map( ( part ) => getEditedPart( part.id ) );

		if (
			parts !== lastParts ||
			edited.some(
				( editedPart, index ) => editedPart !== lastEdited[ index ]
			)
		) {
			lastParts = parts;
			lastEdited = edited;
			merged = parts.map( ( part, index ) =>
				mergeTemplatePartWithEditedRecord( part, edited[ index ] )
			);
		}

		return merged;
	};
}

function getTemplatePartContentForMutation( part, editedContent ) {
	if ( editedContent === undefined ) {
		return getTemplatePartRawContent( part );
	}

	if ( typeof editedContent === 'string' ) {
		return editedContent;
	}

	return editedContent?.raw || '';
}

function isNavigationBlock( block ) {
	return ( block?.name || block?.blockName ) === 'core/navigation';
}

function getBlockName( block ) {
	return block?.name || block?.blockName;
}

function getSerializedBlockName( block ) {
	const blockName = getBlockName( block );

	if ( ! blockName ) {
		return '';
	}

	return blockName.startsWith( 'core/' )
		? blockName.slice( 'core/'.length )
		: blockName;
}

function getBlockAttributes( block ) {
	return block?.attributes || block?.attrs || {};
}

function setBlockAttributes( block, attributes ) {
	if ( Object.prototype.hasOwnProperty.call( block, 'attributes' ) ) {
		block.attributes = attributes;
		return;
	}

	block.attrs = attributes;
}

function serializeBlockAttributes( attributes = {} ) {
	const serializedAttributes = JSON.stringify( attributes )
		.replace( /--/g, '\\u002d\\u002d' )
		.replace( /</g, '\\u003c' )
		.replace( />/g, '\\u003e' )
		.replace( /&/g, '\\u0026' );

	return serializedAttributes === '{}' ? '' : ` ${ serializedAttributes }`;
}

function serializeParsedBlocks( blocks ) {
	return ( blocks || EMPTY_ARRAY ).map( serializeParsedBlock ).join( '' );
}

function serializeParsedBlock( block ) {
	const blockName = getSerializedBlockName( block );

	if ( ! blockName ) {
		return block?.innerHTML || '';
	}

	const attributes = serializeBlockAttributes( getBlockAttributes( block ) );
	const innerBlocks = block?.innerBlocks || EMPTY_ARRAY;
	const innerContent = block?.innerContent || EMPTY_ARRAY;

	if ( ! innerBlocks.length && ! innerContent.join( '' ) ) {
		return `<!-- wp:${ blockName }${ attributes } /-->`;
	}

	let innerBlockIndex = 0;
	const content = innerContent
		.map( ( contentPart ) => {
			if ( contentPart !== null ) {
				return contentPart;
			}

			const innerBlock = innerBlocks[ innerBlockIndex ];
			innerBlockIndex += 1;

			return serializeParsedBlock( innerBlock );
		} )
		.join( '' );

	return `<!-- wp:${ blockName }${ attributes } -->${ content }<!-- /wp:${ blockName } -->`;
}

function getNavigationBlocks( blocks ) {
	const navigationBlocks = [];
	const stack = [ ...( blocks || EMPTY_ARRAY ) ];

	while ( stack.length ) {
		const block = stack.shift();

		if ( block?.innerBlocks?.length ) {
			stack.unshift( ...block.innerBlocks );
		}

		if ( isNavigationBlock( block ) ) {
			navigationBlocks.push( block );
		}
	}

	return navigationBlocks;
}

function hasNavigationBlockInTree( blocks ) {
	return getNavigationBlocks( blocks ).length > 0;
}

function assignFirstNavigationBlockRef( blocks, navigationId ) {
	for ( const block of blocks || EMPTY_ARRAY ) {
		if ( isNavigationBlock( block ) ) {
			const attributes = { ...getBlockAttributes( block ) };
			delete attributes.__unstableLocation;

			setBlockAttributes( block, {
				...attributes,
				ref: navigationId,
			} );

			return true;
		}

		if (
			block?.innerBlocks?.length &&
			assignFirstNavigationBlockRef( block.innerBlocks, navigationId )
		) {
			return true;
		}
	}

	return false;
}

function markFirstNavigationBlockAsUnassigned( blocks ) {
	for ( const block of blocks || EMPTY_ARRAY ) {
		if ( isNavigationBlock( block ) ) {
			const attributes = { ...getBlockAttributes( block ) };
			delete attributes.ref;

			setBlockAttributes( block, {
				...attributes,
				__unstableLocation: EXPLICITLY_UNASSIGNED_NAVIGATION_LOCATION,
			} );

			return true;
		}

		if (
			block?.innerBlocks?.length &&
			markFirstNavigationBlockAsUnassigned( block.innerBlocks )
		) {
			return true;
		}
	}

	return false;
}

function removeNavigationBlockRef( blocks, navigationId ) {
	for ( const block of blocks || EMPTY_ARRAY ) {
		const attributes = getBlockAttributes( block );

		if (
			isNavigationBlock( block ) &&
			Number( attributes?.ref ) === navigationId
		) {
			const nextAttributes = { ...attributes };
			delete nextAttributes.ref;

			setBlockAttributes( block, {
				...nextAttributes,
				__unstableLocation: EXPLICITLY_UNASSIGNED_NAVIGATION_LOCATION,
			} );

			return true;
		}

		if (
			block?.innerBlocks?.length &&
			removeNavigationBlockRef( block.innerBlocks, navigationId )
		) {
			return true;
		}
	}

	return false;
}

export function getReferencedMenuIdsFromContent( content, fallbackMenuId ) {
	if ( ! content ) {
		return EMPTY_ARRAY;
	}

	const blocks = parse( content );
	const menuIds = [];

	for ( const block of getNavigationBlocks( blocks ) ) {
		if (
			( block.attributes || block.attrs )?.__unstableLocation ===
			EXPLICITLY_UNASSIGNED_NAVIGATION_LOCATION
		) {
			continue;
		}

		if ( ( block.attributes || block.attrs )?.ref ) {
			const menuId = Number( ( block.attributes || block.attrs ).ref );

			if ( Number.isFinite( menuId ) ) {
				menuIds.push( menuId );
			}

			continue;
		}

		if ( ! block.innerBlocks?.length && fallbackMenuId ) {
			menuIds.push( Number( fallbackMenuId ) );
		}
	}

	return [ ...new Set( menuIds ) ];
}

export function getTemplatePartMenuRefs( templateParts, fallbackMenuId ) {
	return ( templateParts || EMPTY_ARRAY )
		.reduce( ( refs, part ) => {
			const menuIds = getReferencedMenuIdsFromContent(
				getTemplatePartRawContent( part ),
				fallbackMenuId
			);

			if ( menuIds.length ) {
				refs.push( { menuIds, part } );
			}

			return refs;
		}, [] )
		.sort( ( first, second ) =>
			compareTemplatePartsByArea( first.part, second.part )
		);
}

/**
 * The menu in the site header.
 *
 * Falls back to the most recent menu, which is what an unassigned Navigation
 * block shows.
 *
 * @param {Object[]} menus         Navigation menus, most recent first.
 * @param {Object[]} templateParts Template parts to look for menu refs in.
 * @return {Object|null} The header menu, or null if it is not in `menus`.
 */
export function getMainMenu( menus, templateParts ) {
	const fallbackMenuId = menus?.[ 0 ]?.id;
	const refs = getTemplatePartMenuRefs( templateParts, fallbackMenuId );
	const headerRef =
		refs.find( ( { part } ) => part.area === 'header' ) || refs[ 0 ];
	const menuId = headerRef?.menuIds?.[ 0 ] || fallbackMenuId;

	return (
		( menus || EMPTY_ARRAY ).find( ( menu ) => menu.id === menuId ) || null
	);
}

export function templatePartHasNavigationBlock( part, editedContent ) {
	const rawContent = getTemplatePartContentForMutation( part, editedContent );

	if ( ! rawContent ) {
		return false;
	}

	return hasNavigationBlockInTree( parse( rawContent ) );
}

export function assignNavigationMenuToFirstBlock(
	part,
	navigationId,
	editedContent
) {
	const rawContent = getTemplatePartContentForMutation( part, editedContent );

	if ( ! rawContent ) {
		return undefined;
	}

	const blocks = parse( rawContent );

	if ( ! assignFirstNavigationBlockRef( blocks, navigationId ) ) {
		return undefined;
	}

	return serializeParsedBlocks( blocks );
}

export function removeNavigationMenuFromFirstBlock(
	part,
	navigationId,
	editedContent
) {
	const rawContent = getTemplatePartContentForMutation( part, editedContent );

	if ( ! rawContent ) {
		return undefined;
	}

	const blocks = parse( rawContent );

	if (
		! removeNavigationBlockRef( blocks, navigationId ) &&
		! markFirstNavigationBlockAsUnassigned( blocks )
	) {
		return undefined;
	}

	return serializeParsedBlocks( blocks );
}

export function buildNavigationLocationsMap( templateParts, fallbackMenuId ) {
	return getTemplatePartMenuRefs( templateParts, fallbackMenuId ).reduce(
		( map, { menuIds, part } ) => {
			for ( const menuId of menuIds ) {
				if ( ! map[ menuId ] ) {
					map[ menuId ] = [];
				}

				map[ menuId ].push( {
					area: part.area || '',
					areaLabel: getLocationAreaLabel( part ),
					id: String( part.id ),
					label: getLocationLabel( part ),
					part,
				} );
			}

			return map;
		},
		{}
	);
}

/**
 * Template part areas listed under "Common locations" on the Menus screen, in
 * the order they're shown.
 */
export const COMMON_MENU_LOCATION_AREAS = [ 'header', 'footer', 'sidebar' ];

function getCommonMenuLocationLabel( area ) {
	switch ( area ) {
		case 'header':
			return __( 'Header menu' );
		case 'footer':
			return __( 'Footer menu' );
		default:
			return __( 'Side area menu' );
	}
}

/**
 * The menu each common area shows, for areas that have one.
 *
 * A theme can have several parts in one area, such as a header and a large
 * header. The part whose slug is the area's name is the one templates use by
 * convention, so its menu wins. Otherwise the area's first part with a menu
 * does.
 *
 * @param {Object[]} templateParts Template parts to look for menu refs in.
 * @param {Object[]} menus         Navigation menus, most recent first.
 * @return {Object[]} `{ area, label, menu, part }` for each area with a menu.
 */
export function getCommonMenuLocations( templateParts, menus ) {
	const refs = getTemplatePartMenuRefs( templateParts, menus?.[ 0 ]?.id );

	return COMMON_MENU_LOCATION_AREAS.reduce( ( locations, area ) => {
		const areaRefs = refs.filter( ( { part } ) => part.area === area );
		const ref =
			areaRefs.find( ( { part } ) => part.slug === area ) ||
			areaRefs[ 0 ];
		const menu = ref
			? ( menus || EMPTY_ARRAY ).find(
					( { id } ) => Number( id ) === ref.menuIds[ 0 ]
				)
			: null;

		if ( menu ) {
			locations.push( {
				area,
				label: getCommonMenuLocationLabel( area ),
				menu,
				part: ref.part,
			} );
		}

		return locations;
	}, [] );
}
