/**
 * The posts the timeline shows. It asks for them itself rather than
 * taking the list's first page: this year's posts all at once, how many
 * posts each earlier year has, and an earlier year's posts once it's
 * opened. A search finds its posts from any year, unfolded.
 */

/**
 * Internal dependencies
 */
import {
	POST_QUERY_FIELDS,
	POST_QUERY_FIELDS_WITH_LINKS,
	usePostPermissions,
} from './use-content-records';
import { getEarlierYears, getYearRange } from './post-timeline';
import { coreDataStore, useMemo, useSelect } from '../../wordpress-packages';

const NO_POSTS = [];
const NO_YEARS = [];

// As many matches as one request brings; a search narrows, not scrolls.
const SEARCH_LIMIT = 100;

function getBaseQuery( statuses, withLinks ) {
	return {
		_fields: withLinks ? POST_QUERY_FIELDS_WITH_LINKS : POST_QUERY_FIELDS,
		context: 'edit',
		order: 'desc',
		orderby: 'date',
		status: statuses.join( ',' ),
	};
}

/**
 * How many of the posts a query would find, without their records.
 *
 * @param {string[]} statuses Statuses listed.
 * @param {number}   year     The year.
 * @return {Object} The query.
 */
function getYearCountQuery( statuses, year ) {
	return {
		_fields: 'id',
		context: 'edit',
		per_page: 1,
		status: statuses.join( ',' ),
		...getYearRange( year ),
	};
}

/**
 * Posts for a query, each with what the user may do with it.
 *
 * @param {?Object} type      Post type.
 * @param {?Object} query     The query, or null to ask for nothing.
 * @param {boolean} withLinks Whether the posts carry their links, which
 *                            say what the user may do with them.
 * @return {Object} `{ posts, isLoading }`.
 */
function useTimelineRecords( type, query, withLinks ) {
	const { records, isLoading } = useSelect(
		( select ) => {
			if ( ! type || ! query ) {
				return { isLoading: false, records: NO_POSTS };
			}

			const store = select( coreDataStore );
			const args = [ 'postType', type.name, query ];

			return {
				isLoading: ! store.hasFinishedResolution(
					'getEntityRecords',
					args
				),
				records: store.getEntityRecords( ...args ) || NO_POSTS,
			};
		},
		[ query, type ]
	);

	return {
		isLoading,
		posts: usePostPermissions( records, withLinks ? type : null ),
	};
}

/**
 * The years before this one that have posts, and how many each has.
 *
 * @param {?Object}  type     Post type.
 * @param {string[]} statuses Statuses listed.
 * @param {boolean}  isActive Whether to ask, which a search doesn't.
 * @return {Object} `{ years, isLoading }`; `years` is `{ year, count }`
 *                  for each year, newest first.
 */
function useEarlierYears( type, statuses, isActive ) {
	const statusesKey = statuses.join( ',' );
	const yearsKey = useSelect(
		( select ) => {
			if ( ! type || ! isActive ) {
				return '';
			}

			const store = select( coreDataStore );
			const oldest = store.getEntityRecords( 'postType', type.name, {
				_fields: 'id,date',
				context: 'edit',
				order: 'asc',
				orderby: 'date',
				per_page: 1,
				status: statusesKey,
			} );

			if ( ! oldest ) {
				return 'loading';
			}

			const years = getEarlierYears(
				oldest[ 0 ] ? new Date( oldest[ 0 ].date ) : null
			);

			return years
				.map( ( year ) => {
					const query = getYearCountQuery(
						statusesKey.split( ',' ),
						year
					);
					// Asking for the records is what asks how many there are.
					store.getEntityRecords( 'postType', type.name, query );
					const count = store.getEntityRecordsTotalItems(
						'postType',
						type.name,
						query
					);

					return `${ year }:${ count ?? '' }`;
				} )
				.join( ',' );
		},
		[ isActive, statusesKey, type ]
	);

	return useMemo( () => {
		if ( ! yearsKey || yearsKey === 'loading' ) {
			return { isLoading: yearsKey === 'loading', years: NO_YEARS };
		}

		const entries = yearsKey.split( ',' ).map( ( entry ) => {
			const [ year, count ] = entry.split( ':' );

			return {
				count: count === '' ? null : Number( count ),
				year: Number( year ),
			};
		} );

		return {
			isLoading: entries.some( ( entry ) => entry.count === null ),
			// Years with nothing in them stay out of the way.
			years: entries.filter( ( entry ) => entry.count ),
		};
	}, [ yearsKey ] );
}

/**
 * @param {Object}   options           Options.
 * @param {?Object}  options.type      Post type.
 * @param {string[]} options.statuses  Statuses listed.
 * @param {boolean}  options.withLinks Whether posts need their links.
 * @param {string}   options.search    What the list is searched for.
 * @return {Object} `{ posts, years, isLoading }`. `posts` are this year's,
 *                  or a search's from any year; `years` are the earlier
 *                  years, `{ year, count }`, which fold up below them.
 */
export default function usePostTimeline( {
	type,
	statuses,
	withLinks,
	search,
} ) {
	const statusesKey = statuses.join( ',' );
	const query = useMemo( () => {
		const base = getBaseQuery( statusesKey.split( ',' ), withLinks );

		if ( search ) {
			return { ...base, per_page: SEARCH_LIMIT, search };
		}

		return {
			...base,
			after: getYearRange( new Date().getFullYear() ).after,
			per_page: -1,
		};
	}, [ search, statusesKey, withLinks ] );
	const recent = useTimelineRecords( type, query, withLinks );
	const earlier = useEarlierYears( type, statuses, ! search );

	return {
		isLoading: recent.isLoading || earlier.isLoading,
		posts: recent.posts,
		years: earlier.years,
	};
}

/**
 * An earlier year's posts, asked for once the year is opened.
 *
 * @param {Object}   options           Options.
 * @param {?Object}  options.type      Post type.
 * @param {string[]} options.statuses  Statuses listed.
 * @param {boolean}  options.withLinks Whether posts need their links.
 * @param {number}   options.year      The year.
 * @param {boolean}  options.isOpen    Whether the year is open.
 * @return {Object} `{ posts, isLoading }`.
 */
export function useYearPosts( { type, statuses, withLinks, year, isOpen } ) {
	const statusesKey = statuses.join( ',' );
	const query = useMemo(
		() =>
			isOpen
				? {
						...getBaseQuery( statusesKey.split( ',' ), withLinks ),
						...getYearRange( year ),
						per_page: -1,
					}
				: null,
		[ isOpen, statusesKey, withLinks, year ]
	);

	return useTimelineRecords( type, query, withLinks );
}
