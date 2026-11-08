/**
 * The jobs of running a blog that visitors don't see, under Home's places to
 * start: replying to comments, sorting posts into categories, and a link to
 * every other setting. They open WordPress's own screens in a new tab rather
 * than copying them, as the shop's orders and payments do. A workspace picks which to show (`home.adminLinks`), and
 * PHP leaves out any this person can't use (`includes/blog-admin.php`).
 */

/**
 * Internal dependencies
 */
import ScreenLinks from '../../screen-links';
import { settings } from '../../settings';
import { getBlogAdminLinks } from './blog-admin-links';
import {
	Link,
	Stack,
	Text,
	__,
	addQueryArgs,
	apiFetch,
	useEffect,
	useState,
} from '../../wordpress-packages';

/**
 * How many comments are waiting to be approved, kept up to date.
 *
 * Comments are approved in WP Admin, in another tab, so the count is fetched
 * again whenever this window is come back to.
 *
 * @param {boolean} canModerate Whether this person moderates comments.
 * @return {number} The count.
 */
function usePendingComments( canModerate ) {
	const [ count, setCount ] = useState(
		settings.blogAdmin?.pendingComments || 0
	);

	useEffect( () => {
		if ( ! canModerate ) {
			return;
		}

		let isCurrent = true;
		const refresh = () =>
			apiFetch( {
				path: addQueryArgs( '/wp/v2/comments', {
					status: 'hold',
					per_page: 1,
					_fields: 'id',
				} ),
				parse: false,
			} )
				.then( ( response ) => {
					if ( isCurrent ) {
						setCount(
							Number( response.headers.get( 'X-WP-Total' ) ) || 0
						);
					}
				} )
				// The count from when the page loaded is near enough.
				.catch( () => {} );

		window.addEventListener( 'focus', refresh );

		return () => {
			isCurrent = false;
			window.removeEventListener( 'focus', refresh );
		};
	}, [ canModerate ] );

	return count;
}

/**
 * The "Run your blog" group.
 *
 * @param {Object}   props     Component props.
 * @param {string[]} props.ids Link ids, in order.
 * @return {?Element} The group, or nothing when there are no links to show.
 */
export default function BlogAdmin( { ids } ) {
	const blogAdmin = settings.blogAdmin;
	const pendingComments = usePendingComments(
		ids.includes( 'comments' ) && !! blogAdmin?.adminUrls?.comments
	);
	const links = getBlogAdminLinks( ids, blogAdmin, pendingComments );
	// Everything else, like who can comment or what search engines see, is
	// one link away rather than a row each, so Home stays short.
	const settingsUrl = blogAdmin?.adminUrls?.settings;

	if ( ! links.length ) {
		return null;
	}

	return (
		<Stack direction="column" gap="sm">
			{ /*
			 * No line saying where these open: people new to WordPress
			 * don't know its admin by name, and the arrow on each row
			 * already says it opens a new tab.
			 */ }
			<Text render={ <h2 /> } variant="heading-sm">
				{ __( 'Run your blog' ) }
			</Text>
			<ScreenLinks label={ __( 'Run your blog' ) } links={ links } />
			{ settingsUrl && (
				<Text variant="body-sm">
					<Link href={ settingsUrl } openInNewTab>
						{ __( 'All settings' ) }
					</Link>
				</Text>
			) }
		</Stack>
	);
}
