/**
 * Reading a section's content.
 *
 * A section's signature is the list of its content blocks in order (headings,
 * paragraphs, pictures, buttons, lists and so on), leaving out the blocks
 * that only arrange them (groups, columns, button rows) and the ones that
 * only add space.
 *
 * Works on plain { name, attributes, innerBlocks } objects and never changes
 * the blocks it's given.
 */

/** Blocks that only arrange what's inside them. */
const WRAPPERS = new Set( [
	'core/group',
	'core/columns',
	'core/column',
	'core/buttons',
] );

/** Blocks that only add space. */
const SPACING = new Set( [ 'core/spacer', 'core/separator' ] );

/** Blocks that hold a picture as well as other blocks. */
const PICTURE_HOLDERS = new Set( [ 'core/cover', 'core/media-text' ] );

/**
 * The picture in a block, if it's one of the three that hold one.
 *
 * @param {Object} block
 */
export function pictureOf( block ) {
	const a = block.attributes || {};
	if ( block.name === 'core/image' || block.name === 'core/cover' ) {
		return a.url ? { url: a.url, alt: a.alt, id: a.id } : null;
	}
	if ( block.name === 'core/media-text' ) {
		return a.mediaUrl && ( a.mediaType || 'image' ) === 'image'
			? { url: a.mediaUrl, alt: a.mediaAlt, id: a.mediaId }
			: null;
	}
	return null;
}

/**
 * What a block is for reading a section: 'skip' (spacing), 'wrap' (arranges its
 * children), 'hold' (a picture, then its children), 'picture' (an image),
 * 'container' (content with content blocks inside, such as a quote) or
 * 'leaf' (one item of content, whatever's inside it).
 *
 * @param {Object} block
 */
export function roleOf( block ) {
	if ( SPACING.has( block.name ) ) {
		return 'skip';
	}
	if ( WRAPPERS.has( block.name ) ) {
		return 'wrap';
	}
	if ( PICTURE_HOLDERS.has( block.name ) ) {
		return pictureOf( block ) ? 'hold' : 'wrap';
	}
	if ( block.name === 'core/image' ) {
		return 'picture';
	}
	if ( block.name === 'core/quote' ) {
		return 'container';
	}
	return 'leaf';
}

/**
 * The slot a block fills in a signature.
 *
 * @param {Object} block
 */
const slotName = ( block ) =>
	[ 'hold', 'picture' ].includes( roleOf( block ) ) ? 'image' : block.name;

/**
 * Every content slot in a section, in order.
 *
 * @param {Object} block
 */
function slotsOf( block ) {
	const role = roleOf( block );
	if ( role === 'skip' ) {
		return [];
	}
	const inner = ( block.innerBlocks || [] ).flatMap( slotsOf );
	if ( role === 'wrap' ) {
		return inner;
	}
	if ( role === 'hold' || role === 'container' ) {
		return [ block, ...inner ];
	}
	return [ block ];
}

/**
 * A section's content blocks in order, with pictures as 'image' however
 * they're shown.
 *
 * @param {Object} block The section's top block.
 * @return {string[]} Block names, and 'image' for pictures.
 */
export function signature( block ) {
	return slotsOf( block ).map( slotName );
}
