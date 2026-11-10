/**
 * A page's sections: its top-level blocks, described in plain words.
 */

/**
 * WordPress dependencies
 */
import { decodeEntities } from '@wordpress/html-entities';
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getWritingSections } from '../../../site-canvas/writing-mode';

const HEADING_BLOCKS = [ 'core/heading', 'core/post-title' ];
const IMAGE_BLOCKS = [ 'core/image', 'core/cover', 'core/media-text' ];
const TEXT_BLOCKS = [ 'core/paragraph', 'core/list', 'core/quote' ];

function getAttributes( block ) {
	return block?.attributes || {};
}

function getInnerBlocks( block ) {
	return block?.innerBlocks || [];
}

function toPlainText( value ) {
	if ( value === undefined || value === null ) {
		return '';
	}

	// Rich text attributes can be `RichTextData` objects rather than strings.
	return decodeEntities(
		String( value )
			.replace( /<br\s*\/?>/gi, ' ' )
			.replace( /<[^>]+>/g, '' )
			.replace( /\s+/g, ' ' )
			.trim()
	);
}

function truncateWords( text, length ) {
	if ( text.length <= length ) {
		return text;
	}

	const cut = text.slice( 0, length );
	const lastSpace = cut.lastIndexOf( ' ' );

	return `${ ( lastSpace > length / 2
		? cut.slice( 0, lastSpace )
		: cut
	).replace( /[\s,.;:!?-]+$/, '' ) }…`;
}

function walk( blocks, visit, depth = 0 ) {
	( blocks || [] ).forEach( ( block ) => {
		visit( block, depth );
		walk( getInnerBlocks( block ), visit, depth + 1 );
	} );
}

/**
 * A page's sections, as the canvas shows them: each container on its own,
 * and each run of plain blocks between them, like paragraphs and headings,
 * together as one section of text. See `writing-mode.js`.
 *
 * @param {Object[]} blocks Top-level blocks.
 * @return {Object[]} `{ blocks, clientId, isText, start }` for each section:
 *                    its blocks, its first block's client ID, which it is
 *                    known by, whether it is a run of text, and where its
 *                    first block is among the blocks.
 */
export function groupSections( blocks ) {
	const byId = new Map(
		blocks.map( ( block ) => [ block.clientId, block ] )
	);
	let start = 0;

	return getWritingSections(
		blocks.map( ( block ) => block.clientId ),
		( clientId ) => byId.get( clientId )?.name
	).map( ( { clientIds, isText } ) => {
		const section = {
			blocks: clientIds.map( ( clientId ) => byId.get( clientId ) ),
			clientId: clientIds[ 0 ],
			isText,
			start,
		};

		start += clientIds.length;

		return section;
	} );
}

/**
 * Tally what a section holds, for describing and sketching it.
 *
 * @param {Object} block Top-level block.
 * @return {Object} Counts of headings, images, buttons, columns and text.
 */
export function getSectionContents( block ) {
	const contents = {
		buttons: 0,
		columns: 0,
		headingText: '',
		headings: 0,
		images: 0,
		paragraphText: '',
		texts: 0,
	};

	walk( [ block ], ( item ) => {
		const name = item.name;
		const attributes = getAttributes( item );

		if ( HEADING_BLOCKS.includes( name ) ) {
			contents.headings++;
			contents.headingText =
				contents.headingText || toPlainText( attributes.content );
		}

		if ( IMAGE_BLOCKS.includes( name ) ) {
			contents.images++;
		}

		if ( name === 'core/gallery' ) {
			contents.images += Math.max( 0, getInnerBlocks( item ).length - 1 );
		}

		if ( name === 'core/button' ) {
			contents.buttons++;
		}

		if ( name === 'core/columns' ) {
			contents.columns = Math.max(
				contents.columns,
				getInnerBlocks( item ).length
			);
		}

		if ( TEXT_BLOCKS.includes( name ) ) {
			contents.texts++;
			contents.paragraphText =
				contents.paragraphText ||
				toPlainText( attributes.content ?? attributes.value );
		}
	} );

	return contents;
}

/**
 * What kind of section this is, in a word or two a visitor would use.
 *
 * @param {Object} block      Top-level block.
 * @param {Object} [contents] Result of `getSectionContents`.
 * @return {string} Kind label.
 */
export function getSectionKind(
	block,
	contents = getSectionContents( block )
) {
	switch ( block?.name ) {
		case 'core/cover':
			return __( 'Banner' );
		case 'core/media-text':
			return __( 'Image and text' );
		case 'core/gallery':
			return __( 'Gallery' );
		case 'core/query':
			return __( 'Latest posts' );
		case 'core/image':
			return __( 'Image' );
		case 'core/heading':
			return __( 'Heading' );
		case 'core/paragraph':
		case 'core/list':
			return __( 'Text' );
		case 'core/buttons':
			return __( 'Buttons' );
		case 'core/separator':
			return __( 'Divider' );
		case 'core/spacer':
			return __( 'Space' );
		case 'core/quote':
		case 'core/pullquote':
			return __( 'Quote' );
	}

	if ( contents.columns > 1 ) {
		return sprintf(
			/* translators: %d: number of columns. */
			__( '%d columns' ),
			contents.columns
		);
	}

	if ( contents.images >= 3 ) {
		return __( 'Gallery' );
	}

	if ( contents.buttons && contents.headings ) {
		return __( 'Call to action' );
	}

	return __( 'Section' );
}

/**
 * The name a section goes by in the list.
 *
 * A name someone gave it wins, then its first heading, then its kind.
 *
 * @param {Object} block Top-level block.
 * @return {string} Section title.
 */
export function getSectionTitle( block ) {
	const name = toPlainText( getAttributes( block ).metadata?.name );

	if ( name ) {
		return name;
	}

	const contents = getSectionContents( block );

	return (
		contents.headingText ||
		truncateWords( contents.paragraphText, 48 ) ||
		getSectionKind( block, contents )
	);
}

/**
 * A short line on what is in a section, like "Banner · 2 buttons".
 *
 * @param {Object} block Top-level block.
 * @return {string} Section summary.
 */
export function getSectionSummary( block ) {
	const contents = getSectionContents( block );
	const kind = getSectionKind( block, contents );
	const title = getSectionTitle( block );
	const facts = [];

	if ( kind !== title ) {
		facts.push( kind );
	}

	if ( contents.images && block?.name !== 'core/image' ) {
		facts.push(
			sprintf(
				/* translators: %d: number of images. */
				_n( '%d image', '%d images', contents.images ),
				contents.images
			)
		);
	}

	if ( contents.buttons ) {
		facts.push(
			sprintf(
				/* translators: %d: number of buttons. */
				_n( '%d button', '%d buttons', contents.buttons ),
				contents.buttons
			)
		);
	}

	if (
		! facts.length &&
		contents.paragraphText &&
		title !== truncateWords( contents.paragraphText, 48 )
	) {
		facts.push( contents.paragraphText );
	}

	return facts.slice( 0, 3 ).join( ' · ' );
}

/**
 * Where a dragged item lands when dropped on one side of another.
 *
 * @param {number} from     Index of the dragged item.
 * @param {number} over     Index of the item it is dropped on.
 * @param {string} position `before` or `after`.
 * @return {number} The dragged item's new index.
 */
export function getDropIndex( from, over, position ) {
	const slot = over + ( position === 'after' ? 1 : 0 );

	return from < slot ? slot - 1 : slot;
}
