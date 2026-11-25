/**
 * Home for someone who writes but doesn't set the site up, an Author say:
 * nothing to set up is theirs to do, so Home leads with their own writing,
 * a new post and the posts they were last working on.
 */

/**
 * Internal dependencies
 */
import { startHomeTrip } from '../../home-trip';
import { getStatusLabel, POST_STATUS_ICONS } from '../../post-status';
import ScreenLinks from '../../screen-links';
import { getPostType } from '../../settings';
import {
	Text,
	__,
	coreDataStore,
	decodeEntities,
	pencilIcon,
	postIcon,
	postListIcon,
	useSelect,
} from '../../wordpress-packages';

const RECENT_COUNT = 5;

function useRecentPosts( type ) {
	return useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const userId = store.getCurrentUser()?.id;

			if ( ! type?.canEdit || ! userId ) {
				return null;
			}

			return store.getEntityRecords( 'postType', type.name, {
				author: userId,
				context: 'edit',
				orderby: 'modified',
				per_page: RECENT_COUNT,
				status: 'publish,future,draft,pending,private',
				_fields: 'id,status,title',
			} );
		},
		[ type ]
	);
}

export default function RecentContent() {
	const type = getPostType( 'post' );
	const posts = useRecentPosts( type );

	if ( ! type?.canEdit ) {
		return (
			<Text className="cnl-site-hub__hint" variant="body-sm">
				{ __( 'Pick what to work on from the menu.' ) }
			</Text>
		);
	}

	const links = [
		type.canCreate && {
			description: __( 'Start something new.' ),
			icon: pencilIcon,
			id: 'write',
			isAction: true,
			onSelect: startHomeTrip,
			title: __( 'Write a post' ),
			to: `/types/${ type.name }/new`,
		},
		...( posts || [] ).map( ( post ) => ( {
			description: getStatusLabel( post.status ),
			icon: POST_STATUS_ICONS[ post.status ] || postIcon,
			id: `post-${ post.id }`,
			onSelect: startHomeTrip,
			title:
				decodeEntities( post.title?.raw || post.title?.rendered ) ||
				__( '(no title)' ),
			to: `/types/${ type.name }/edit/${ post.id }`,
		} ) ),
		{
			description: __(
				'Pick up a draft, or change something you’ve published.'
			),
			icon: postListIcon,
			id: 'posts',
			onSelect: startHomeTrip,
			title: __( 'All posts' ),
			to: `/types/${ type.name }/list/all`,
		},
	].filter( Boolean );

	return <ScreenLinks label={ __( 'Your writing' ) } links={ links } />;
}
