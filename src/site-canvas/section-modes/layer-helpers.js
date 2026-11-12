/**
 * Helpers for the section layer that need nothing from it.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import { observeHost } from '../../editor-layer/portal-host';
import { getSectionTitle } from '../../routes/content/pages/page-sections';
import { CONTENT_REGION } from './layer-constants';
import {
	__,
	blockEditorStore,
	blocksStore,
	useEffect,
	useState,
} from '../../wordpress-packages';
import { getLayoutItemTitle } from './layout-items';
import { getPartTitle } from './section-chrome';

/*
 * Section titles, by block. Working one out walks the whole section, and the
 * layer asks for several on every render. The editor's blocks are replaced,
 * never changed, when they're edited, so a block's title stays right for as
 * long as the block is around.
 */
const sectionTitles = new WeakMap();

export function getCachedSectionTitle( block ) {
	if ( ! sectionTitles.has( block ) ) {
		sectionTitles.set( block, getSectionTitle( block ) );
	}

	return sectionTitles.get( block );
}

/**
 * The route the editor is on, as a link back to it would give it: the
 * router keeps it in the admin page's `p`, its search beside it.
 *
 * @return {string} The route, with its search.
 */
export function getCurrentRoute() {
	const params = new URLSearchParams( window.location.search );
	const [ path, pathSearch = '' ] = ( params.get( 'p' ) || '/' ).split( '?' );
	// The route's own search can be in `p` too; it wins.
	const search = new URLSearchParams( pathSearch );

	params.forEach( ( value, key ) => {
		if ( key !== 'p' && key !== 'page' && ! search.has( key ) ) {
			search.set( key, value );
		}
	} );

	const query = search.toString();

	return query ? `${ path }?${ query }` : path;
}

/**
 * A host for the layer in the editor's content region.
 *
 * @param {Object} editorRef Ref to the editor's container.
 * @return {?HTMLElement} The host, or null until the region exists.
 */
export function useContentHost( editorRef ) {
	const [ host, setHost ] = useState( null );

	useEffect( () => {
		if ( ! editorRef.current ) {
			return undefined;
		}

		return observeHost(
			CONTENT_REGION,
			'cnl-section-modes-host',
			setHost,
			editorRef.current
		);
	}, [ editorRef ] );

	return host;
}

/**
 * Rects for every block measured, with each run of text drawn round all of
 * its blocks, under its first's ID.
 *
 * @param {Object} blockRects      Rects by client ID.
 * @param {?Array} groupedSections The sections, runs of text grouped.
 * @return {Object} Rects by client ID.
 */
export function mergeRunRects( blockRects, groupedSections ) {
	if ( ! groupedSections ) {
		return blockRects;
	}

	const next = { ...blockRects };

	groupedSections.forEach( ( { clientIds } ) => {
		const boxes = clientIds
			.map( ( clientId ) => blockRects[ clientId ] )
			.filter( Boolean );

		if ( boxes.length < 2 ) {
			return;
		}

		const top = Math.min( ...boxes.map( ( box ) => box.top ) );
		const left = Math.min( ...boxes.map( ( box ) => box.left ) );

		next[ clientIds[ 0 ] ] = {
			height:
				Math.max( ...boxes.map( ( box ) => box.top + box.height ) ) -
				top,
			left,
			top,
			width:
				Math.max( ...boxes.map( ( box ) => box.left + box.width ) ) -
				left,
		};
	} );

	return next;
}

/**
 * The name a section, header, footer or layout item goes by in the layer.
 *
 * @param {Object}   registry                The data registry.
 * @param {string}   clientId                The block.
 * @param {Object}   options
 * @param {Function} options.isTextSection   Whether it's a run of text.
 * @param {Object}   options.layoutItemsById The layout items, by ID.
 * @param {Object}   options.partsById       The template parts, by ID.
 * @return {string} Its name.
 */
export function getLayerTitle(
	registry,
	clientId,
	{ isTextSection, layoutItemsById, partsById }
) {
	const part = partsById[ clientId ];

	if ( part ) {
		return getPartTitle( part );
	}

	if ( isTextSection( clientId ) ) {
		return __( 'Text' );
	}

	if ( layoutItemsById[ clientId ] ) {
		return getLayoutItemTitle(
			layoutItemsById[ clientId ].name,
			registry.select( blocksStore ).getBlockType
		);
	}

	const block = registry.select( blockEditorStore ).getBlock( clientId );

	return block ? getCachedSectionTitle( block ) : __( 'Section' );
}
