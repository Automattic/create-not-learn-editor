/**
 * Writing mode, for content that is written rather than designed, like a
 * blog post: paragraphs, headings and pictures one after another, not a page
 * of sections.
 *
 * In Edit, writing has no section layer, so its blocks are clicked and typed
 * into as they are. Zooming out is only offered once it has a container, like
 * a group or a cover, as there is nothing to arrange without one. Zoomed out,
 * each container is a section, and each run of blocks between them is one
 * section of text, grouped by the layer only, never in the saved content.
 *
 * For now the content types in writing mode are listed here. Later, a type
 * should say so itself when it is registered.
 *
 * Pages keep their sections, but their runs of text are grouped the same
 * way, in Edit too, so a page that is mostly words, like a privacy policy,
 * is one section of text rather than a section for every paragraph. A
 * layout isn't: its blocks are mostly a post's title, image and content.
 */

const WRITING_POST_TYPES = [ 'post' ];

// Content whose blocks are a layout's rather than its own words.
const LAYOUT_POST_TYPES = [ 'wp_template', 'wp_template_part' ];

/*
 * Blocks that hold a section of their own in writing. Anything else is part
 * of the writing around it, lists and quotes included, though they hold
 * blocks too.
 */
const CONTAINER_BLOCKS = [
	'core/block',
	'core/columns',
	'core/cover',
	'core/group',
	'core/media-text',
	'core/query',
	'core/template-part',
];

/**
 * @param {?string} postType A content type.
 * @return {boolean} Whether it is in writing mode.
 */
export function isWritingType( postType ) {
	return WRITING_POST_TYPES.includes( postType );
}

/**
 * @param {?string} postType A content type.
 * @return {boolean} Whether its runs of text are grouped into sections.
 */
export function groupsTextIn( postType ) {
	return Boolean( postType ) && ! LAYOUT_POST_TYPES.includes( postType );
}

/**
 * @param {?string} name A block's name.
 * @return {boolean} Whether it is a section of its own in writing.
 */
export function isContainerBlock( name ) {
	return CONTAINER_BLOCKS.includes( name );
}

/**
 * Sections with their runs of text grouped: each container on its own, and
 * each run of other blocks between them together, in order.
 *
 * @param {string[]} clientIds The blocks, in order.
 * @param {Function} getName   Returns a block's name from its client ID.
 * @return {Object[]} `{ clientIds, isText }` for each section. A section is
 *                    known by its first block's client ID.
 */
export function getWritingSections( clientIds, getName ) {
	const sections = [];

	clientIds.forEach( ( clientId ) => {
		const isText = ! isContainerBlock( getName( clientId ) );
		const last = sections[ sections.length - 1 ];

		if ( isText && last?.isText ) {
			last.clientIds.push( clientId );
		} else {
			sections.push( { clientIds: [ clientId ], isText } );
		}
	} );

	return sections;
}

/**
 * Where a section goes among the blocks, once moved to a new place among
 * the sections, as `moveBlocksToPosition` takes it: counted among the
 * blocks left once its own are taken out. A section being added, not moved,
 * has no place yet, -1.
 *
 * @param {Object[]} sections Each section's `{ clientIds }`, in order.
 * @param {number}   from     The section's place among them, or -1.
 * @param {number}   to       Its new place among them.
 * @return {number} Its first block's index.
 */
export function getBlockIndex( sections, from, to ) {
	return sections
		.filter( ( section, index ) => index !== from )
		.slice( 0, to )
		.reduce( ( count, section ) => count + section.clientIds.length, 0 );
}
