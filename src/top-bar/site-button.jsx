/**
 * The site's logo and name, at the start of the top bar. It opens Name &
 * logo, where both are changed, asking first about unsaved edits to a page
 * or post open in the canvas, as Exit does.
 *
 * It shows the site as it will be once published, so a new name shows here
 * as it is typed.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { settings } from '../settings';
import { requestExit } from '../site-canvas/mode';

const IDENTITY_PATH = '/design/identity';

function getMediaUrl( media ) {
	return (
		media?.media_details?.sizes?.thumbnail?.source_url ||
		media?.source_url ||
		''
	);
}

export function SiteButton() {
	const { name, imageUrl } = useSelect( ( select ) => {
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

	return (
		<button
			className="cnl-top-bar__site"
			onClick={ () => requestExit( () => openRoute( IDENTITY_PATH ) ) }
			title={ __( 'Name & logo' ) }
			type="button"
		>
			{ imageUrl ? (
				<img
					className="cnl-top-bar__site-logo"
					src={ imageUrl }
					alt=""
				/>
			) : (
				<span className="cnl-top-bar__site-logo" aria-hidden="true">
					{ Array.from( name.trim() )[ 0 ]?.toUpperCase() || 'W' }
				</span>
			) }
			<span className="cnl-top-bar__site-name">
				{ name || __( 'Your site' ) }
			</span>
		</button>
	);
}
