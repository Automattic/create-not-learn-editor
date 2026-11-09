/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getEarlierYears,
	getMonthLabel,
	getTimelineComments,
	getTimelineDate,
	getTimelineRows,
	getTimelineTone,
	getTimelineTime,
	getYearRange,
	sortForTimeline,
} from '../post-timeline';

const NOW = new Date( '2026-11-09T12:00:00' );

function describeRows( rows ) {
	return rows.map( ( row ) => {
		if ( row.type === 'post' ) {
			return `post ${ row.post.id }`;
		}

		return row.type === 'month' ? `month ${ row.label }` : 'today';
	} );
}

describe( 'getTimelineDate', () => {
	it( 'places a post by its date, which a draft keeps at its last save', () => {
		expect(
			getTimelineDate( {
				date: '2026-11-02T09:00:00',
				modified: '2026-11-02T09:00:00',
				status: 'draft',
			} ).getDate()
		).toBe( 2 );
	} );
} );

describe( 'getYearRange', () => {
	it( 'bounds a year by the moments either side of it', () => {
		expect( getYearRange( 2025 ) ).toEqual( {
			after: '2024-12-31T23:59:59',
			before: '2026-01-01T00:00:00',
		} );
	} );
} );

describe( 'getEarlierYears', () => {
	it( 'lists the years before this one back to the oldest post', () => {
		expect(
			getEarlierYears( new Date( '2023-05-01T09:00:00' ), NOW )
		).toEqual( [ 2025, 2024, 2023 ] );
		expect(
			getEarlierYears( new Date( '2026-01-02T09:00:00' ), NOW )
		).toEqual( [] );
		expect( getEarlierYears( null, NOW ) ).toEqual( [] );
	} );
} );

describe( 'sortForTimeline', () => {
	it( 'lists what is scheduled first, then the rest newest first', () => {
		const posts = [
			{ date: '2026-10-01T09:00:00', id: 1, status: 'publish' },
			{ date: '2026-12-01T09:00:00', id: 2, status: 'future' },
			{ date: '2026-11-01T09:00:00', id: 3, status: 'publish' },
			{ date: '2026-11-07T09:00:00', id: 4, status: 'draft' },
		];

		expect( sortForTimeline( posts ).map( ( post ) => post.id ) ).toEqual( [
			2, 4, 3, 1,
		] );
	} );
} );

describe( 'getTimelineRows', () => {
	const posts = [
		{ date: '2026-11-06T08:00:00', id: 1, status: 'publish' },
		{ date: '2026-11-20T18:30:00', id: 2, status: 'future' },
		{ date: '2026-12-02T09:00:00', id: 3, status: 'future' },
		{ date: '2026-11-06T17:00:00', id: 4, status: 'publish' },
		{ date: '2026-10-09T09:00:00', id: 5, status: 'publish' },
	];

	it( 'marks today between what is scheduled and what has happened', () => {
		expect(
			describeRows( getTimelineRows( posts, { now: NOW } ) )
		).toEqual( [
			'month December',
			'post 3',
			'month November',
			'post 2',
			'today',
			'post 4',
			'post 1',
			'month October',
			'post 5',
		] );
	} );

	it( 'shows a date once for posts on the same day', () => {
		const rows = getTimelineRows( posts, { now: NOW } );
		const sameDay = rows
			.filter( ( row ) => row.isSameDay )
			.map( ( row ) => row.post.id );

		expect( sameDay ).toEqual( [ 1 ] );
	} );

	it( 'starts the line at the first post, and ends it at the last', () => {
		const rows = getTimelineRows( posts, { now: NOW } );

		expect( rows[ 0 ].isBeforeStart ).toBe( true );
		expect( rows[ 1 ].isStart ).toBe( true );
		expect( rows[ rows.length - 1 ].isEnd ).toBe( true );
	} );

	it( 'starts at today when nothing is scheduled', () => {
		expect(
			describeRows(
				getTimelineRows(
					posts.filter( ( post ) => post.status !== 'future' ),
					{ now: NOW }
				)
			).slice( 0, 2 )
		).toEqual( [ 'month November', 'today' ] );
	} );

	it( 'still marks today with no posts when earlier years follow', () => {
		expect(
			describeRows(
				getTimelineRows( [], { alwaysToday: true, now: NOW } )
			)
		).toEqual( [ 'month November', 'today' ] );
	} );

	it( 'leaves today out of older pages', () => {
		expect(
			describeRows(
				getTimelineRows( [ posts[ 4 ] ], {
					now: NOW,
					showToday: false,
				} )
			)
		).toEqual( [ 'month October', 'post 5' ] );
	} );
} );

describe( 'getMonthLabel', () => {
	it( 'gives the year only when it is not the one being shown', () => {
		expect( getMonthLabel( new Date( '2026-03-04' ), 2026 ) ).toBe(
			'March'
		);
		expect( getMonthLabel( new Date( '2027-01-04' ), 2026 ) ).toBe(
			'January 2027'
		);
	} );
} );

describe( 'getTimelineTone', () => {
	it( 'gives drafts and posts waiting for review the same dot', () => {
		expect( getTimelineTone( 'publish' ) ).toBe( 'published' );
		expect( getTimelineTone( 'future' ) ).toBe( 'scheduled' );
		expect( getTimelineTone( 'pending' ) ).toBe(
			getTimelineTone( 'draft' )
		);
	} );
} );

describe( 'getTimelineTime', () => {
	it( 'says what happened at what time', () => {
		const date = new Date( '2026-11-20T18:30:00' );

		expect( getTimelineTime( { status: 'future' }, date ) ).toMatch(
			/^Goes live at /
		);
		expect( getTimelineTime( { status: 'publish' }, date ) ).toMatch(
			/^Published at /
		);
	} );
} );

describe( 'getTimelineComments', () => {
	it( 'counts comments, and says nothing for none', () => {
		expect( getTimelineComments( { comment_count: 0 } ) ).toBe( '' );
		expect( getTimelineComments( { comment_count: 1 } ) ).toBe(
			'1 comment'
		);
		expect( getTimelineComments( { comment_count: 4 } ) ).toBe(
			'4 comments'
		);
	} );
} );
