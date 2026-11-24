/**
 * Rearranging the Site overview: pages dragged onto each other, and into the
 * main menu. Kept free of React so it can be tested on its own.
 */

/**
 * Internal dependencies
 */
import { getPageMoveChanges } from '../content/pages/page-tree';

// How far into a card, from either side, a drop puts the page beside it
// rather than under it.
export const SIDE_DROP_FRACTION = 0.25;

const pageNodeId = ( pageId ) => `page-${ pageId }`;

/**
 * The overview with the pages where their unsaved changes put them: each
 * hand-made page under its new parent and in its new place among the pages
 * beside it.
 *
 * Pages the overview leaves out, like the homepage's own page, still count
 * as parents: a page under one hangs from the nearest page that is drawn, or
 * from the homepage.
 *
 * @param {Object}   siteOverview Site overview from the REST API.
 * @param {Object[]} tree         Pages as a tree, from `buildPageTree`.
 * @return {Object} Site overview.
 */
export function applyPageTree( siteOverview, tree ) {
	if ( ! siteOverview || ! tree?.length ) {
		return siteOverview;
	}

	const pageNodes = new Map(
		siteOverview.nodes
			.filter( ( node ) => node.kind === 'page' )
			.map( ( node ) => [ node.id, node ] )
	);
	const orderedNodes = [];
	const pageEdges = [];

	const visit = ( items, drawnParent ) =>
		items.forEach( ( item ) => {
			const id = pageNodeId( item.page.id );

			if ( ! pageNodes.has( id ) ) {
				visit( item.children, drawnParent );
				return;
			}

			orderedNodes.push( pageNodes.get( id ) );
			pageNodes.delete( id );
			pageEdges.push( { from: drawnParent, kind: 'child', to: id } );
			visit( item.children, id );
		} );

	visit( tree, 'home' );

	const placed = new Set( orderedNodes.map( ( node ) => node.id ) );

	return {
		...siteOverview,
		edges: [
			...pageEdges,
			...siteOverview.edges.filter( ( edge ) => ! placed.has( edge.to ) ),
		],
		nodes: [
			...siteOverview.nodes.filter( ( node ) => node.kind !== 'page' ),
			...orderedNodes,
			// Pages the tree doesn't know, left where the server put them.
			...pageNodes.values(),
		],
	};
}

function findInTree( items, pageId, parent = 0 ) {
	for ( let index = 0; index < items.length; index++ ) {
		const item = items[ index ];

		if ( Number( item.page.id ) === pageId ) {
			return { index, item, parent, siblings: items };
		}

		const found = findInTree(
			item.children,
			pageId,
			Number( item.page.id )
		);

		if ( found ) {
			return found;
		}
	}

	return null;
}

function containsPage( item, pageId ) {
	return item.children.some(
		( child ) =>
			Number( child.page.id ) === pageId || containsPage( child, pageId )
	);
}

/**
 * Where a drop on a card puts a page, from how far across the card it lands.
 *
 * @param {number} fraction How far across the card, 0 to 1.
 * @return {string} `before`, `under` or `after`.
 */
export function getDropPosition( fraction ) {
	if ( fraction < SIDE_DROP_FRACTION ) {
		return 'before';
	}

	if ( fraction > 1 - SIDE_DROP_FRACTION ) {
		return 'after';
	}

	return 'under';
}

/**
 * Whether one page can be dropped on another: not on itself, nor on a page
 * under it.
 *
 * @param {Object[]} tree     Pages as a tree.
 * @param {number}   pageId   Page being dragged.
 * @param {number}   targetId Page it would be dropped on.
 * @return {boolean} Whether it can.
 */
export function canDropOnPage( tree, pageId, targetId ) {
	if ( pageId === targetId ) {
		return false;
	}

	const dragged = findInTree( tree, pageId );

	return Boolean( dragged ) && ! containsPage( dragged.item, targetId );
}

/**
 * The page changes a drop makes.
 *
 * @param {Object[]} tree                  Pages as a tree.
 * @param {number}   pageId                Page being dropped.
 * @param {Object}   drop                  `{ position, targetId }`, where
 *                                         `position` is `before`, `after`,
 *                                         `under`, or `top` for the top
 *                                         level, at the end.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] The homepage's page.
 * @return {Object[]} `{ id, parent, menu_order }` for each page that changes.
 */
export function getDropChanges( tree, pageId, drop, { frontPageId = 0 } = {} ) {
	if ( drop.position === 'top' ) {
		return getPageMoveChanges(
			tree,
			pageId,
			{ index: tree.length, parent: 0 },
			{ frontPageId }
		);
	}

	if ( ! canDropOnPage( tree, pageId, drop.targetId ) ) {
		return [];
	}

	const target = findInTree( tree, drop.targetId );

	if ( drop.position === 'under' ) {
		return getPageMoveChanges(
			tree,
			pageId,
			{
				index: target.item.children.filter(
					( child ) => Number( child.page.id ) !== pageId
				).length,
				parent: drop.targetId,
			},
			{ frontPageId }
		);
	}

	// Its place among the target's siblings once it has left them.
	const index = target.siblings
		.filter( ( item ) => Number( item.page.id ) !== pageId )
		.findIndex( ( item ) => Number( item.page.id ) === drop.targetId );

	return getPageMoveChanges(
		tree,
		pageId,
		{
			index: index + ( drop.position === 'after' ? 1 : 0 ),
			parent: target.parent,
		},
		{ frontPageId }
	);
}
