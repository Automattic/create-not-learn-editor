/**
 * Icons and labels for the content list's tabs.
 */
import {
	draftsIcon,
	layoutIcon,
	LegacyIcon,
	lockIcon,
	pendingIcon,
	postFeaturedImageIcon,
	postListIcon,
	publishedIcon,
	scheduledIcon,
	trashIcon,
} from '../../wordpress-packages';

// The icon an empty status tab shows, by its slug.
export const EMPTY_TAB_ICONS = {
	drafts: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: lockIcon,
	published: publishedIcon,
	trash: trashIcon,
};

export function getTemplateIcon( template ) {
	if ( template?.slug === 'home' ) {
		return postListIcon;
	}

	if ( template?.slug === 'single' ) {
		return postFeaturedImageIcon;
	}

	return layoutIcon;
}

export function TabLabel( { icon, label } ) {
	return (
		<span className="routes-post-list__tab-label">
			{ icon && (
				<LegacyIcon
					className="routes-post-list__tab-icon"
					icon={ icon.replace( /^dashicons-/, '' ) }
					size={ 20 }
				/>
			) }
			{ label }
		</span>
	);
}
