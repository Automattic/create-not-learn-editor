/**
 * Home's header, which is the site itself: its logo, its name, where people
 * find it and how many changes to it aren't saved yet.
 *
 * It shows the site as it will be once saved, so a new name or logo shows
 * here as soon as it is changed, like it does on the canvas.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import { FROM_SITE_SEARCH } from '../../site-trail';
import { getSiteAddress } from './site-address';
import { ReviewChanges } from '../../top-bar/review-changes';
import { useChanges } from '../../top-bar/use-changes';
import {
	Badge,
	Icon,
	Link,
	Tooltip,
	_n,
	__,
	coreDataStore,
	decodeEntities,
	pencilIcon,
	sprintf,
	useSelect,
	useState,
} from '../../wordpress-packages';

function getMediaUrl( media ) {
	return (
		media?.media_details?.sizes?.thumbnail?.source_url ||
		media?.source_url ||
		''
	);
}

/**
 * The site as the editor has it, with any changes not saved yet.
 *
 * @return {Object} `name`, and `imageUrl`, its logo, or its browser icon
 *                  when it has no logo.
 */
export function useSite() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const site = store.getEditedEntityRecord( 'root', 'site' );
		const imageId = Number( site?.site_logo ) || Number( site?.site_icon );
		const media = imageId
			? store.getEntityRecord( 'root', 'media', imageId )
			: null;

		return {
			name: decodeEntities( site?.title || settings.siteName || '' ),
			imageUrl: getMediaUrl( media ),
		};
	}, [] );
}

/**
 * The logo, or the browser icon, or else the name's first letter, so the
 * header has the same shape on a site that has neither yet. Clicking it opens
 * Name & logo, where it is changed, and a pencil over it on hover says so.
 *
 * The header hides its icon from screen readers, so this is a shortcut for
 * the pointer only, out of the tab order. The Name & logo row below it is the
 * way there for everyone.
 *
 * @param {Object} props
 * @param {string} props.name     The site's name.
 * @param {string} props.imageUrl Its logo or browser icon.
 * @return {Element} The mark.
 */
export function SiteMark( { name, imageUrl } ) {
	const navigate = useNavigate();

	return (
		<button
			className="cnl-site-card__mark"
			onClick={ () =>
				navigate( { search: FROM_SITE_SEARCH, to: '/design/identity' } )
			}
			tabIndex={ -1 }
			type="button"
		>
			{ imageUrl ? (
				<img className="cnl-site-card__logo" src={ imageUrl } alt="" />
			) : (
				<span className="cnl-site-card__initial">
					{ Array.from( name.trim() )[ 0 ]?.toUpperCase() || 'W' }
				</span>
			) }
			<span className="cnl-site-card__edit">
				<Icon icon={ pencilIcon } size={ 20 } />
			</span>
		</button>
	);
}

/**
 * Where the site is, as a link to it, under its name. The address is the
 * link's text, so it says where the site is and opens it at once.
 *
 * @param {Object} props
 * @param {string} props.fallbackLabel What the link says when the address
 *                                     can't be read.
 * @return {?Element} The link.
 */
export function SiteAddress( { fallbackLabel } ) {
	if ( ! settings.homeUrl ) {
		return null;
	}

	return (
		<Link href={ settings.homeUrl } openInNewTab>
			{ getSiteAddress( settings.homeUrl ) || fallbackLabel }
		</Link>
	);
}

/**
 * How many changes aren't saved yet, as a badge beside the site's name that
 * opens the same review Save does. Nothing shows once everything is saved.
 *
 * @return {?Element} The status.
 */
export function SiteStatus() {
	const { changes, isSaving } = useChanges();
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const count = changes.length;

	let badge = null;

	if ( isSaving ) {
		badge = (
			<Badge className="cnl-site-card__status" intent="draft">
				{ __( 'Saving…' ) }
			</Badge>
		);
	} else if ( count ) {
		badge = (
			<Tooltip.Root>
				<Tooltip.Trigger
					render={
						<Badge
							className="cnl-site-card__status"
							intent="medium"
							render={ <button type="button" /> }
							onClick={ () => setIsReviewOpen( true ) }
						>
							{ sprintf(
								/* translators: %d: Number of changes waiting to be saved. */
								_n(
									'%d unsaved change',
									'%d unsaved changes',
									count
								),
								count
							) }
						</Badge>
					}
				/>
				<Tooltip.Popup>{ __( 'Review changes' ) }</Tooltip.Popup>
			</Tooltip.Root>
		);
	}

	// The review stays open while it saves, so it isn't kept in the badge.
	return (
		<>
			{ badge }
			{ isReviewOpen && (
				<ReviewChanges onClose={ () => setIsReviewOpen( false ) } />
			) }
		</>
	);
}
