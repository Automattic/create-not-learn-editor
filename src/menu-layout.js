/**
 * The sidebar's layout as someone has arranged it: which order its sections
 * come in, which items each holds and in what order, and which of them are
 * listed rather than kept behind the section's "…".
 *
 * A layout is saved per workspace, as `{ sections: [ { id, items: [ { id,
 * shown } ] } ] }`. Nothing is saved until someone changes their sidebar,
 * and until then the sidebar is the workspace's own: registered order, with
 * the items used most listed (`src/menu-use.js`). Resetting deletes the
 * saved layout.
 *
 * Items come and go as plugins do, so a saved layout is only ever a set of
 * wishes: `resolveLayout()` lays it over the items registered now.
 *
 * Kept free of the DOM and the data stores, so it can be tested on its own.
 * `packages/app-init/src/menu-sections.jsx` lists what this resolves, and
 * `packages/app-init/src/menu-customizer.jsx` edits it.
 */

/**
 * Items in the order they're registered, grouped by section, sections in the
 * order their first item is registered.
 *
 * @param {Object[]} items    Top-level menu items, each with `id` and `section`.
 * @param {string[]} sections Known section ids; items naming another are left out.
 * @return {Map<string, string[]>} Item ids by section id.
 */
function groupBySection( items, sections ) {
	const groups = new Map();

	items.forEach( ( item ) => {
		if ( ! sections.includes( item.section ) ) {
			return;
		}
		if ( ! groups.has( item.section ) ) {
			groups.set( item.section, [] );
		}
		groups.get( item.section ).push( item.id );
	} );

	return groups;
}

/**
 * The layout the sidebar shows now, before anyone has arranged it: what
 * someone starts from when they first customize it.
 *
 * @param {Object[]}                    items    Top-level menu items.
 * @param {string[]}                    sections Known section ids.
 * @param {(sectionId: string) => ?Set} getShown The items a section lists,
 *                                               or nothing for all of them.
 * @return {Object} Layout.
 */
export function getCurrentLayout( items, sections, getShown ) {
	return {
		sections: [ ...groupBySection( items, sections ) ].map(
			( [ id, ids ] ) => {
				const shown = getShown( id );

				return {
					id,
					items: ids.map( ( itemId ) => ( {
						id: itemId,
						shown: ! shown || shown.has( itemId ),
					} ) ),
				};
			}
		),
	};
}

/**
 * A saved layout laid over the items registered now. Sections and items no
 * longer registered are dropped. Ones registered since join at the end: a
 * section after the others, an item at the end of the section it's
 * registered in, listed only if that section lists fewer than `limit`.
 *
 * @param {Object}   saved    Saved layout.
 * @param {Object[]} items    Top-level menu items.
 * @param {string[]} sections Known section ids.
 * @param {number}   limit    How many items a section lists before new ones
 *                            wait behind its "…".
 * @return {Object} Layout.
 */
export function resolveLayout( saved, items, sections, limit ) {
	const registered = groupBySection( items, sections );
	const isRegistered = new Set( [ ...registered.values() ].flat() );
	const placed = new Set();

	const resolved = ( saved?.sections ?? [] )
		.filter( ( section ) => registered.has( section.id ) )
		.map( ( section ) => ( {
			id: section.id,
			items: section.items.filter( ( item ) => {
				if ( ! isRegistered.has( item.id ) || placed.has( item.id ) ) {
					return false;
				}
				placed.add( item.id );
				return true;
			} ),
		} ) );

	registered.forEach( ( ids, sectionId ) => {
		let section = resolved.find( ( { id } ) => id === sectionId );

		if ( ! section ) {
			section = { id: sectionId, items: [] };
			resolved.push( section );
		}

		ids.filter( ( id ) => ! placed.has( id ) ).forEach( ( id ) => {
			section.items.push( {
				id,
				shown:
					section.items.filter( ( item ) => item.shown ).length <
					limit,
			} );
			placed.add( id );
		} );
	} );

	return { sections: resolved };
}

/**
 * Move a section to another place among the sections.
 *
 * @param {Object} layout Layout.
 * @param {string} id     Section id.
 * @param {number} index  Where it goes, counted without it.
 * @return {Object} New layout.
 */
export function moveSection( layout, id, index ) {
	const section = layout.sections.find( ( entry ) => entry.id === id );

	if ( ! section ) {
		return layout;
	}

	const rest = layout.sections.filter( ( entry ) => entry.id !== id );

	rest.splice( clamp( index, 0, rest.length ), 0, section );

	return { ...layout, sections: rest };
}

/**
 * Move an item to a place in a section, its own or another.
 *
 * @param {Object} layout    Layout.
 * @param {string} id        Item id.
 * @param {string} sectionId Section it goes to.
 * @param {number} index     Where it goes in that section, counted without it.
 * @return {Object} New layout.
 */
export function moveItem( layout, id, sectionId, index ) {
	const item = layout.sections
		.flatMap( ( section ) => section.items )
		.find( ( entry ) => entry.id === id );

	if ( ! item ) {
		return layout;
	}

	return {
		...layout,
		sections: layout.sections.map( ( section ) => {
			const items = section.items.filter( ( entry ) => entry.id !== id );

			if ( section.id === sectionId ) {
				items.splice( clamp( index, 0, items.length ), 0, item );
			}

			return { ...section, items };
		} ),
	};
}

/**
 * List an item in its section, or keep it behind the section's "…".
 *
 * @param {Object}  layout Layout.
 * @param {string}  id     Item id.
 * @param {boolean} shown  Whether it is listed.
 * @return {Object} New layout.
 */
export function setItemShown( layout, id, shown ) {
	return {
		...layout,
		sections: layout.sections.map( ( section ) => ( {
			...section,
			items: section.items.map( ( item ) =>
				item.id === id ? { ...item, shown } : item
			),
		} ) ),
	};
}

/**
 * Where an item sits: its section and its place in it.
 *
 * @param {Object} layout Layout.
 * @param {string} id     Item id.
 * @return {?{sectionIndex: number, index: number}} Its place.
 */
export function findItem( layout, id ) {
	for (
		let sectionIndex = 0;
		sectionIndex < layout.sections.length;
		sectionIndex++
	) {
		const index = layout.sections[ sectionIndex ].items.findIndex(
			( item ) => item.id === id
		);

		if ( index !== -1 ) {
			return { sectionIndex, index };
		}
	}

	return null;
}

/**
 * Move an item one place up or down, into the next section at its edge, so
 * a keyboard can take an item anywhere one step at a time.
 *
 * @param {Object} layout Layout.
 * @param {string} id     Item id.
 * @param {number} step   -1 for up, 1 for down.
 * @return {Object} New layout.
 */
export function nudgeItem( layout, id, step ) {
	const place = findItem( layout, id );

	if ( ! place ) {
		return layout;
	}

	const { sectionIndex, index } = place;
	const section = layout.sections[ sectionIndex ];
	const next = index + step;

	if ( next >= 0 && next < section.items.length ) {
		return moveItem( layout, id, section.id, next );
	}

	const neighbour = layout.sections[ sectionIndex + step ];

	if ( ! neighbour ) {
		return layout;
	}

	// Into the neighbouring section, at the edge nearest the one it left.
	return moveItem(
		layout,
		id,
		neighbour.id,
		step < 0 ? neighbour.items.length : 0
	);
}

function clamp( value, min, max ) {
	return Math.min( max, Math.max( min, value ) );
}
