/**
 * The site's pages as a tree, the way visitors meet them: parents first, their
 * sub-pages tucked underneath.
 */

function compareSiblings( a, b, frontPageId ) {
	const order =
		( Number( a.menu_order ) || 0 ) - ( Number( b.menu_order ) || 0 );

	if ( order ) {
		return order;
	}

	// Among pages nobody has put in order, the homepage leads.
	if ( frontPageId && Number( a.id ) === frontPageId ) {
		return -1;
	}

	if ( frontPageId && Number( b.id ) === frontPageId ) {
		return 1;
	}

	return String(
		a.title?.raw ?? a.title?.rendered ?? a.title ?? ''
	).localeCompare(
		String( b.title?.raw ?? b.title?.rendered ?? b.title ?? '' )
	);
}

/**
 * Nest pages under their parents.
 *
 * A page whose parent is not in the list (trashed, or filtered out by the
 * query) is shown at the top level rather than dropped. Pages follow their
 * menu order, and among pages with the same order the homepage leads.
 *
 * @param {Object[]} pages                 Page records.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] ID of the page set as the homepage.
 * @return {Object[]} Tree nodes, `{ page, children }`.
 */
export function buildPageTree( pages, { frontPageId = 0 } = {} ) {
	const ids = new Set( ( pages || [] ).map( ( page ) => Number( page.id ) ) );
	const childrenByParent = new Map();

	( pages || [] ).forEach( ( page ) => {
		const parent = Number( page.parent ) || 0;
		const key =
			ids.has( parent ) && parent !== Number( page.id ) ? parent : 0;

		if ( ! childrenByParent.has( key ) ) {
			childrenByParent.set( key, [] );
		}

		childrenByParent.get( key ).push( page );
	} );

	const visit = ( parentId, seen ) =>
		( childrenByParent.get( parentId ) || [] )
			.slice()
			.sort( ( a, b ) => compareSiblings( a, b, frontPageId ) )
			.filter( ( page ) => ! seen.has( Number( page.id ) ) )
			.map( ( page ) => {
				const nextSeen = new Set( seen ).add( Number( page.id ) );

				return {
					children: visit( Number( page.id ), nextSeen ),
					page,
				};
			} );

	return visit( 0, new Set() );
}

/**
 * Keep the pages matching a search, along with the parents that lead to them.
 *
 * @param {Object[]} tree     Tree from `buildPageTree`.
 * @param {string}   search   Search text.
 * @param {Function} getTitle Returns a page's plain title.
 * @return {Object[]} The filtered tree.
 */
export function filterPageTree( tree, search, getTitle ) {
	const needle = String( search || '' )
		.trim()
		.toLowerCase();

	if ( ! needle ) {
		return tree;
	}

	return tree.reduce( ( result, node ) => {
		const children = filterPageTree( node.children, needle, getTitle );
		const isMatch = String( getTitle( node.page ) )
			.toLowerCase()
			.includes( needle );

		if ( isMatch || children.length ) {
			result.push( { ...node, children } );
		}

		return result;
	}, [] );
}

/**
 * Count every page in a tree, sub-pages included.
 *
 * @param {Object[]} tree Tree from `buildPageTree`.
 * @return {number} Number of pages.
 */
export function countPageTree( tree ) {
	return tree.reduce(
		( total, node ) => total + 1 + countPageTree( node.children ),
		0
	);
}

/**
 * The titles of a page's ancestors, nearest last.
 *
 * @param {Object[]} pages    Page records.
 * @param {number}   pageId   Page ID.
 * @param {Function} getTitle Returns a page's plain title.
 * @return {string[]} Ancestor titles.
 */
export function getPageAncestorTitles( pages, pageId, getTitle ) {
	const byId = new Map(
		( pages || [] ).map( ( page ) => [ Number( page.id ), page ] )
	);
	const titles = [];
	const seen = new Set( [ Number( pageId ) ] );
	let parent = Number( byId.get( Number( pageId ) )?.parent ) || 0;

	while ( parent && byId.has( parent ) && ! seen.has( parent ) ) {
		seen.add( parent );
		titles.unshift( getTitle( byId.get( parent ) ) );
		parent = Number( byId.get( parent ).parent ) || 0;
	}

	return titles;
}

function findNode( tree, pageId, parentId = 0 ) {
	for ( let index = 0; index < tree.length; index++ ) {
		const node = tree[ index ];

		if ( Number( node.page.id ) === pageId ) {
			return { index, node, parentId, siblings: tree };
		}

		const found = findNode( node.children, pageId, Number( node.page.id ) );

		if ( found ) {
			return found;
		}
	}

	return null;
}

function getSiblings( tree, parentId ) {
	if ( ! parentId ) {
		return tree;
	}

	return findNode( tree, parentId )?.node.children || [];
}

/**
 * Where a page goes when moved with the keyboard.
 *
 * Up and down move it among the pages beside it, right tucks it under the page
 * above it, and left brings it out to sit after its parent.
 *
 * @param {Object[]} tree   Tree from `buildPageTree`.
 * @param {number}   pageId Page being moved.
 * @param {string}   key    `ArrowUp`, `ArrowDown`, `ArrowLeft` or `ArrowRight`.
 * @return {Object|null} `{ parent, index }`, or `null` where it can't go.
 */
export function getPageKeyboardTarget( tree, pageId, key ) {
	const found = findNode( tree, pageId );

	if ( ! found ) {
		return null;
	}

	const { index, parentId, siblings } = found;

	switch ( key ) {
		case 'ArrowUp':
			return index > 0 ? { index: index - 1, parent: parentId } : null;
		case 'ArrowDown':
			return index < siblings.length - 1
				? { index: index + 1, parent: parentId }
				: null;
		case 'ArrowRight': {
			const above = siblings[ index - 1 ];

			return above
				? {
						index: above.children.length,
						parent: Number( above.page.id ),
					}
				: null;
		}
		case 'ArrowLeft': {
			if ( ! parentId ) {
				return null;
			}

			const parent = findNode( tree, parentId );

			return { index: parent.index + 1, parent: parent.parentId };
		}
	}

	return null;
}

/**
 * The pages that moved within a level: those outside the longest run of pages
 * still in the order they were.
 *
 * @param {number[]} before IDs in the level before.
 * @param {number[]} after  IDs in the level after.
 * @return {number[]} IDs of the pages that moved.
 */
function getMovedIds( before, after ) {
	// Lengths of the longest common runs, from each pair of places onwards.
	const lengths = before.map( () => new Array( after.length + 1 ).fill( 0 ) );

	lengths.push( new Array( after.length + 1 ).fill( 0 ) );

	for ( let i = before.length - 1; i >= 0; i-- ) {
		for ( let j = after.length - 1; j >= 0; j-- ) {
			lengths[ i ][ j ] =
				before[ i ] === after[ j ]
					? lengths[ i + 1 ][ j + 1 ] + 1
					: Math.max( lengths[ i + 1 ][ j ], lengths[ i ][ j + 1 ] );
		}
	}

	const kept = new Set();

	for ( let i = 0, j = 0; i < before.length && j < after.length; ) {
		if ( before[ i ] === after[ j ] ) {
			kept.add( after[ j ] );
			i++;
			j++;
		} else if ( lengths[ i + 1 ][ j ] >= lengths[ i ][ j + 1 ] ) {
			i++;
		} else {
			j++;
		}
	}

	return after.filter( ( id ) => ! kept.has( id ) );
}

/**
 * The changes that put one level of pages in the order wanted: a menu order
 * that sorts each page there, and the level's parent for pages new to it.
 *
 * As few pages change as can, as each one waits in the list of changes to
 * save. A page that falls in place keeps its menu order. Otherwise one page
 * takes a menu order beside its neighbours, trying the pages that moved
 * first, and only when no one page can do it is the level numbered afresh.
 * A page that was already there keeps its parent, even one the tree couldn't
 * find, which it shows at the top level.
 *
 * @param {Object[]} pages                 The level's pages, in the order
 *                                         wanted.
 * @param {number}   parent                The level's parent page, or 0.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] ID of the page set as the homepage.
 * @param {number[]} [options.previousIds] IDs of the level's pages before, in
 *                                         order.
 * @param {number[]} [options.movedIds]    Pages that moved, to change first.
 *                                         Worked out from `previousIds` when
 *                                         not given.
 * @return {Object[]} `{ id, parent, menu_order }` for each page that changes.
 */
export function getLevelChanges(
	pages,
	parent,
	{ frontPageId = 0, previousIds = [], movedIds } = {}
) {
	const ids = pages.map( ( page ) => Number( page.id ) );
	const moved = movedIds || getMovedIds( previousIds, ids );
	const isNew = ( id ) => ! previousIds.includes( id );
	const placed = pages.map( ( page ) => ( {
		...page,
		menu_order: Number( page.menu_order ) || 0,
	} ) );
	const isInOrder = ( candidate ) =>
		candidate
			.slice()
			.sort( ( a, b ) => compareSiblings( a, b, frontPageId ) )
			.every( ( page, index ) => Number( page.id ) === ids[ index ] );
	const getChanges = ( candidate ) =>
		candidate
			.filter(
				( page, index ) =>
					isNew( ids[ index ] ) ||
					page.menu_order !==
						( Number( pages[ index ].menu_order ) || 0 )
			)
			.map( ( page ) => ( {
				id: Number( page.id ),
				menu_order: page.menu_order,
				parent: isNew( Number( page.id ) )
					? parent
					: Number( page.parent ) || 0,
			} ) );

	if ( isInOrder( placed ) ) {
		return getChanges( placed );
	}

	const movedFirst = placed
		.map( ( page, index ) => index )
		.sort(
			( a, b ) =>
				Number( moved.includes( ids[ b ] ) ) -
				Number( moved.includes( ids[ a ] ) )
		);

	for ( const index of movedFirst ) {
		const before = placed[ index - 1 ]?.menu_order;
		const after = placed[ index + 1 ]?.menu_order;
		const values = [];

		if ( before !== undefined ) {
			values.push( before, before + 1 );
		}

		if ( after !== undefined ) {
			values.push( after, after - 1 );
		}

		for ( const value of values ) {
			const candidate = placed.map( ( page, i ) =>
				i === index ? { ...page, menu_order: value } : page
			);

			if ( isInOrder( candidate ) ) {
				return getChanges( candidate );
			}
		}
	}

	return getChanges(
		placed.map( ( page, index ) => ( { ...page, menu_order: index } ) )
	);
}

/**
 * The changes to make for a page to move: its new parent, and the menu orders
 * that put it in its place there.
 *
 * @param {Object[]} tree                  Tree from `buildPageTree`.
 * @param {number}   pageId                Page being moved.
 * @param {Object}   target                `{ parent, index }`.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] ID of the page set as the homepage.
 * @return {Object[]} `{ id, parent, menu_order }` for each page that changes.
 */
export function getPageMoveChanges(
	tree,
	pageId,
	target,
	{ frontPageId = 0 } = {}
) {
	const moved = findNode( tree, pageId );

	if ( ! moved ) {
		return [];
	}

	const level = getSiblings( tree, target.parent ).map(
		( node ) => node.page
	);
	const siblings = level.filter( ( page ) => Number( page.id ) !== pageId );

	siblings.splice(
		Math.max( 0, Math.min( target.index, siblings.length ) ),
		0,
		moved.node.page
	);

	return getLevelChanges( siblings, target.parent, {
		frontPageId,
		movedIds: [ pageId ],
		previousIds: level.map( ( page ) => Number( page.id ) ),
	} );
}
