/**
 * The links Home's "Run your blog" group offers, and what each says. They
 * open WordPress's own screens for them in a new tab.
 * Kept apart from the group (`blog-admin.jsx`) so it can be tested alone.
 */

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	comment as commentIcon,
	postCategories as postCategoriesIcon,
} from '@wordpress/icons';
import { addQueryArgs } from '@wordpress/url';

/**
 * What each link says, by id.
 *
 * @param {number} pendingComments Comments waiting to be approved.
 * @return {Object} `{ description, icon, title }` for each link, by id.
 */
function getCopy( pendingComments ) {
	return {
		comments: {
			description: pendingComments
				? sprintf(
						/* translators: %d: number of comments waiting to be approved. */
						_n(
							'%d waiting for you to approve.',
							'%d waiting for you to approve.',
							pendingComments
						),
						pendingComments
					)
				: __( 'Approve, reply to and remove comments.' ),
			icon: commentIcon,
			title: __( 'Comments' ),
		},
		categories: {
			description: __(
				'Group your posts so readers can find more like them.'
			),
			icon: postCategoriesIcon,
			title: __( 'Categories' ),
		},
	};
}

/**
 * The links to show, in the workspace's order.
 *
 * @param {string[]} ids                 Link ids, in order.
 * @param {Object}   blogAdmin           The editor's `blogAdmin` settings.
 * @param {Object}   blogAdmin.adminUrls WP Admin URLs this person can use, by id.
 * @param {number}   [pendingComments=0] Comments waiting to be approved.
 * @return {Object[]} `{ description, href, icon, title }` for each link.
 */
export function getBlogAdminLinks(
	ids,
	{ adminUrls = {} } = {},
	pendingComments = 0
) {
	const copy = getCopy( pendingComments );

	return ids
		.filter( ( id ) => copy[ id ] && adminUrls[ id ] )
		.map( ( id ) => ( {
			...copy[ id ],
			// Straight to the ones waiting, when there are any.
			href:
				id === 'comments' && pendingComments
					? addQueryArgs( adminUrls[ id ], {
							comment_status: 'moderated',
						} )
					: adminUrls[ id ],
		} ) );
}
