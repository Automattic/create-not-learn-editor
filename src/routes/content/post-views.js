/**
 * The statuses a list of posts can be narrowed to, as core's own post lists
 * offer them. Each is an address of its own, `/types/post/list/<slug>`,
 * picked with the buttons above the list. The rest of DataViews' filters
 * still work inside it.
 *
 * Kept free of packages other than i18n so it can be tested on its own.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

// Every status a post is listed under on the "All" tab.
const LISTED_STATUSES = [ 'publish', 'future', 'draft', 'pending', 'private' ];

/**
 * @return {Object[]} `{ slug, statuses, title }` for each tab, in order.
 */
export function getPostViews() {
	return [
		{ slug: 'all', statuses: LISTED_STATUSES, title: __( 'All' ) },
		{
			slug: 'published',
			statuses: [ 'publish' ],
			title: __( 'Published' ),
		},
		{ slug: 'future', statuses: [ 'future' ], title: __( 'Scheduled' ) },
		{ slug: 'drafts', statuses: [ 'draft' ], title: __( 'Drafts' ) },
		{ slug: 'pending', statuses: [ 'pending' ], title: __( 'Pending' ) },
		{ slug: 'private', statuses: [ 'private' ], title: __( 'Private' ) },
		{ slug: 'trash', statuses: [ 'trash' ], title: __( 'Trash' ) },
	];
}

/**
 * The tab an address asks for, or "All" for one it doesn't know.
 *
 * @param {string} slug The address's view slug.
 * @return {Object} `{ slug, statuses, title }`.
 */
export function getPostView( slug ) {
	const views = getPostViews();

	return views.find( ( view ) => view.slug === slug ) || views[ 0 ];
}

/**
 * What an empty tab says: what would be there, and how it gets there, so a
 * tab with nothing scheduled doesn't ask for a first post. A search that
 * finds nothing says that instead.
 *
 * @param {Object} view   A tab, from `getPostView`.
 * @param {string} search What the list is searched for, if anything.
 * @return {Object} `{ title, description, canWrite }`. `canWrite` says
 *                  whether writing a post would put one in the tab.
 */
export function getPostViewEmpty( view, search = '' ) {
	if ( search ) {
		return {
			canWrite: false,
			description: __( 'Try other words, or look in another tab.' ),
			title: sprintf(
				/* translators: %s: What the posts were searched for. */
				__( 'Nothing matches “%s”' ),
				search
			),
		};
	}

	switch ( view.slug ) {
		case 'published':
			return {
				canWrite: true,
				description: __(
					'Posts show here once they’re published for everyone to read.'
				),
				title: __( 'Nothing published yet' ),
			};
		case 'future':
			return {
				canWrite: false,
				description: __(
					'To publish a post later, pick a date and time when you publish it. It waits here until then.'
				),
				title: __( 'Nothing scheduled' ),
			};
		case 'drafts':
			return {
				canWrite: true,
				description: __(
					'Posts you’ve started but not published wait here, so you can pick them up again.'
				),
				title: __( 'No drafts' ),
			};
		case 'pending':
			return {
				canWrite: false,
				description: __(
					'Posts someone has sent in for review wait here until they’re published.'
				),
				title: __( 'Nothing waiting for review' ),
			};
		case 'private':
			return {
				canWrite: false,
				description: __(
					'Posts only you and other people who run the site can read show here.'
				),
				title: __( 'No private posts' ),
			};
		case 'trash':
			return {
				canWrite: false,
				description: __(
					'Posts you move to the trash wait here, in case you want them back.'
				),
				title: __( 'The trash is empty' ),
			};
		default:
			return {
				canWrite: true,
				description: __(
					'Write your first post and it will show here.'
				),
				title: __( 'No posts yet' ),
			};
	}
}
