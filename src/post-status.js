/**
 * A post's status as words and as the icon core's editor gives it, so the
 * Pages list, the Posts screen and the canvas toolbar say it the same way.
 */

/**
 * Internal dependencies
 */
import {
	__,
	draftsIcon,
	lockIcon,
	pendingIcon,
	publishedIcon,
	scheduledIcon,
} from './wordpress-packages';

export const POST_STATUS_ICONS = {
	'auto-draft': draftsIcon,
	draft: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: lockIcon,
	publish: publishedIcon,
};

/**
 * @param {string} status A post's status, like `publish`.
 * @return {string} Its name, like Published.
 */
export function getStatusLabel( status ) {
	switch ( status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		case 'trash':
			return __( 'Trash' );
		default:
			return status || __( 'Unknown' );
	}
}
