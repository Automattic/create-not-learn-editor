/**
 * How much each sidebar item is used, so a section can list the ones a
 * person uses in place of its defaults.
 *
 * Each visit to an item's screen adds one to its score, and scores halve
 * every `HALF_LIFE_MS`, so an item used often lately outranks one used a lot
 * long ago. That is the whole model: frequency, weighted by how recent.
 *
 * Kept free of the DOM and the data stores, so it can be tested on its own.
 * `packages/app-init/src/menu-sections.jsx` records visits and lists what
 * this picks.
 */

export const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

/*
 * What a default is worth, in recent visits, so an item has to be used a
 * few times before it takes a default's place, rather than on one look.
 */
export const DEFAULT_WEIGHT = 2;

/*
 * Below this an item no longer earns a free place, which one visit falls to
 * after two half-lives. It is also when a score is forgotten.
 */
export const MIN_SCORE = 0.25;

/**
 * An item's score now.
 *
 * @param {?{score: number, at: number}} use What was saved for the item.
 * @param {number}                       now Time in milliseconds.
 * @return {number} Its score, decayed to now.
 */
export function getScore( use, now ) {
	if ( ! use?.score ) {
		return 0;
	}

	const elapsed = Math.max( 0, now - ( use.at || 0 ) );

	return use.score * 0.5 ** ( elapsed / HALF_LIFE_MS );
}

/**
 * Count a visit to an item.
 *
 * @param {Object} uses Saved scores, keyed by item id.
 * @param {string} id   The item visited.
 * @param {number} now  Time in milliseconds.
 * @return {Object} The scores with the visit counted, and any that have
 *                  decayed away forgotten.
 */
export function recordUse( uses, id, now ) {
	const next = {};

	Object.entries( uses || {} ).forEach( ( [ itemId, use ] ) => {
		if ( itemId !== id && getScore( use, now ) >= MIN_SCORE ) {
			next[ itemId ] = use;
		}
	} );

	next[ id ] = {
		score:
			Math.round( ( getScore( uses?.[ id ], now ) + 1 ) * 1000 ) / 1000,
		at: now,
	};

	return next;
}

/**
 * Which of a section's items to list.
 *
 * Items marked `alwaysShown` are always listed, and take their places first.
 * The rest are ranked by score, with each default's raised by
 * `DEFAULT_WEIGHT`, and the best fill the places left. Only defaults and
 * items in use earn a place, so a section lists no more than its defaults
 * until something else is used. Ties go to the defaults, in their order,
 * then to the items in the order listed.
 *
 * @param {Object[]}  items               The section's items, in the order listed.
 * @param {string}    items[].id          Item id.
 * @param {boolean}   items[].alwaysShown Whether it is always listed.
 * @param {Object}    options             Options.
 * @param {number}    options.limit       How many items to list.
 * @param {?string[]} options.defaults    The items to list when none are used,
 *                                        in order. The first `limit` items if
 *                                        not given.
 * @param {Object}    options.uses        Saved scores, keyed by item id.
 * @param {number}    options.now         Time in milliseconds.
 * @return {Set<string>} The ids of the items to list.
 */
export function pickShownItems( items, { limit, defaults, uses, now } ) {
	const always = items.filter( ( item ) => item.alwaysShown );
	const rest = items.filter( ( item ) => ! item.alwaysShown );
	const defaultIds =
		defaults || rest.slice( 0, limit ).map( ( { id } ) => id );

	const ranked = rest
		.map( ( item, index ) => {
			const defaultRank = defaultIds.indexOf( item.id );
			const isDefault = defaultRank !== -1;
			const score = getScore( uses?.[ item.id ], now );

			return {
				id: item.id,
				index,
				isEligible: isDefault || score >= MIN_SCORE,
				defaultRank: isDefault ? defaultRank : Infinity,
				weight: score + ( isDefault ? DEFAULT_WEIGHT : 0 ),
			};
		} )
		.filter( ( entry ) => entry.isEligible )
		.sort(
			( a, b ) =>
				b.weight - a.weight ||
				a.defaultRank - b.defaultRank ||
				a.index - b.index
		);

	return new Set( [
		...always.map( ( { id } ) => id ),
		...ranked
			.slice( 0, Math.max( 0, limit - always.length ) )
			.map( ( { id } ) => id ),
	] );
}

/**
 * The item whose screen a route is, or is under: the one whose `to` is the
 * longest match. Home's `/` matches only itself.
 *
 * @param {Object[]} items Menu items, with `id` and `to`.
 * @param {string}   path  The route's path, like `/types/page/123`.
 * @return {?string} The item's id.
 */
export function getItemIdForRoute( items, path ) {
	let best = null;

	items.forEach( ( item ) => {
		const to = item.to;

		if ( ! to ) {
			return;
		}

		const isMatch =
			path === to ||
			( to !== '/' && path.startsWith( to.replace( /\/$/, '' ) + '/' ) );

		if ( isMatch && ( ! best || to.length > best.to.length ) ) {
			best = item;
		}
	} );

	return best?.id ?? null;
}
