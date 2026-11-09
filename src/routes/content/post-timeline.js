/**
 * The order, rows and words of the posts timeline: posts down a line by
 * when they happened, newest at the top, with what's scheduled above a
 * "Today" marker and each month headed.
 *
 * Kept free of packages other than i18n so it can be tested on its own.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

// The DataViews layout the timeline takes the place of in the switcher.
export const TIMELINE_LAYOUT = 'activity';

/**
 * When a post sits on the timeline: its date. WordPress keeps a draft's
 * date at its last save until someone picks one, so drafts sit where they
 * were last worked on, and each year's posts can be asked for by date.
 *
 * @param {Object} post Post record.
 * @return {?Date} The date, in the site's time, or null for none.
 */
export function getTimelineDate( post ) {
	const value = post?.date || post?.modified;

	if ( ! value ) {
		return null;
	}

	const date = new Date( value );

	return Number.isNaN( date.getTime() ) ? null : date;
}

/**
 * The dates that bound a year's posts, as the REST API's `after` and
 * `before` take them, both exclusive.
 *
 * @param {number} year The year.
 * @return {Object} `{ after, before }`, in the site's time.
 */
export function getYearRange( year ) {
	return {
		after: `${ year - 1 }-12-31T23:59:59`,
		before: `${ year + 1 }-01-01T00:00:00`,
	};
}

/**
 * The years before this one, newest first, back to the oldest post's.
 * They fold up, below this year's posts.
 *
 * @param {?Date} oldest The oldest post's date.
 * @param {Date}  now    Now.
 * @return {number[]} The years.
 */
export function getEarlierYears( oldest, now = new Date() ) {
	const years = [];

	if ( ! oldest ) {
		return years;
	}

	for (
		let year = now.getFullYear() - 1;
		year >= oldest.getFullYear();
		year--
	) {
		years.push( year );
	}

	return years;
}

/**
 * Posts in timeline order: scheduled posts first, then everything else,
 * each newest first.
 *
 * @param {Object[]} posts Post records.
 * @return {Object[]} The same posts, reordered.
 */
export function sortForTimeline( posts ) {
	return [ ...posts ].sort( ( first, second ) => {
		const firstIsComing = first.status === 'future';
		const secondIsComing = second.status === 'future';

		if ( firstIsComing !== secondIsComing ) {
			return firstIsComing ? -1 : 1;
		}

		return (
			( getTimelineDate( second )?.getTime() || 0 ) -
			( getTimelineDate( first )?.getTime() || 0 )
		);
	} );
}

function getMonthKey( date ) {
	return date ? `${ date.getFullYear() }-${ date.getMonth() }` : '';
}

function getDayKey( date ) {
	return date ? `${ getMonthKey( date ) }-${ date.getDate() }` : '';
}

/**
 * A month's heading: just the month in the year being shown, with the
 * year otherwise.
 *
 * @param {?Date}  date A date in the month.
 * @param {number} year The year being shown.
 * @return {string} Like "November", or "January 2027".
 */
export function getMonthLabel( date, year = new Date().getFullYear() ) {
	if ( ! date ) {
		return __( 'No date' );
	}

	return date.toLocaleDateString( undefined, {
		month: 'long',
		...( date.getFullYear() !== year && {
			year: 'numeric',
		} ),
	} );
}

/**
 * The rows of the timeline, top to bottom: months, posts and the "Today"
 * marker between what's scheduled and everything else.
 *
 * @param {Object[]} posts               Post records, in any order.
 * @param {Object}   options             Options.
 * @param {Date}     options.now         Now.
 * @param {boolean}  options.showToday   Whether to mark today. A year
 *                                       folded below has nothing to mark
 *                                       it against.
 * @param {boolean}  options.alwaysToday Whether to mark today with no
 *                                       posts, as earlier years still
 *                                       follow it.
 * @param {number}   options.year        The year the rows are in, whose
 *                                       months go without it.
 * @return {Object[]} Rows: `{ type: 'month', key, label, isFuture }`,
 *                    `{ type: 'today', key, date }` or `{ type: 'post',
 *                    key, post, date, isFuture, isSameDay }`. The line
 *                    starts at the row marked `isStart`, so rows before
 *                    it are `isBeforeStart`, and ends at the one marked
 *                    `isEnd`.
 */
export function getTimelineRows(
	posts,
	{
		now = new Date(),
		showToday = true,
		alwaysToday = false,
		year = now.getFullYear(),
	} = {}
) {
	const rows = [];
	let monthKey = null;
	let dayKey = null;
	let hasMarkedToday = false;

	const addMonth = ( date, isFuture ) => {
		const key = getMonthKey( date );

		if ( key === monthKey ) {
			return;
		}

		monthKey = key;
		dayKey = null;
		rows.push( {
			isFuture,
			key: `month-${ key }-${ isFuture ? 'future' : 'past' }`,
			label: getMonthLabel( date, year ),
			type: 'month',
		} );
	};

	const markToday = () => {
		hasMarkedToday = true;

		if ( ! showToday ) {
			return;
		}

		// The days of this month still to come are on the line of
		// what's to come.
		addMonth( now, true );
		dayKey = null;
		rows.push( { date: now, key: 'today', type: 'today' } );
	};

	for ( const post of sortForTimeline( posts ) ) {
		const isFuture = post.status === 'future';

		if ( ! isFuture && ! hasMarkedToday ) {
			markToday();
		}

		const date = getTimelineDate( post );
		addMonth( date, isFuture );

		const postDayKey = getDayKey( date );
		rows.push( {
			date,
			isFuture,
			isSameDay: postDayKey === dayKey,
			key: `post-${ post.id }`,
			post,
			type: 'post',
		} );
		dayKey = postDayKey;
	}

	if ( ! hasMarkedToday && ( posts.length || alwaysToday ) ) {
		markToday();
	}

	const start = rows.findIndex( ( row ) => row.type !== 'month' );

	return rows.map( ( row, index ) => ( {
		...row,
		isBeforeStart: index < start,
		isEnd: index === rows.length - 1,
		isStart: index === start,
	} ) );
}

/**
 * The tone of a post's dot on the timeline. Its badge is the one the
 * other layouts show, from `getStatusLabel` and `getStatusIntent`.
 *
 * @param {string} status Post status.
 * @return {string} `published`, `scheduled`, `draft`, `private` or
 *                  `trash`.
 */
export function getTimelineTone( status ) {
	switch ( status ) {
		case 'future':
			return 'scheduled';
		case 'draft':
		case 'auto-draft':
		case 'pending':
			return 'draft';
		case 'private':
		case 'trash':
			return status;
		default:
			return 'published';
	}
}

/**
 * What a post's time says on the timeline.
 *
 * @param {Object} post Post record.
 * @param {?Date}  date From `getTimelineDate`.
 * @return {string} Like "Published at 08:15".
 */
export function getTimelineTime( post, date ) {
	if ( ! date ) {
		return __( 'No date' );
	}

	const time = date.toLocaleTimeString( undefined, {
		hour: 'numeric',
		minute: '2-digit',
	} );

	switch ( getTimelineTone( post.status ) ) {
		case 'scheduled':
			/* translators: %s: Time of day a scheduled post goes live. */
			return sprintf( __( 'Goes live at %s' ), time );
		case 'draft':
		case 'trash':
			/* translators: %s: Time of day a post was last edited. */
			return sprintf( __( 'Last edited at %s' ), time );
		default:
			/* translators: %s: Time of day a post was published. */
			return sprintf( __( 'Published at %s' ), time );
	}
}

/**
 * A post's comments, as the timeline counts them. Nothing for none, so a
 * quiet post doesn't say so on every line.
 *
 * @param {Object} post Post record.
 * @return {string} Like "4 comments", or "".
 */
export function getTimelineComments( post ) {
	const count = Number( post?.comment_count ) || 0;

	if ( ! count ) {
		return '';
	}

	return sprintf(
		/* translators: %d: Number of comments. */
		_n( '%d comment', '%d comments', count ),
		count
	);
}
