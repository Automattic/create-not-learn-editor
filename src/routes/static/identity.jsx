/**
 * Internal dependencies
 */
import { savesIdentity } from '../../save-scopes';
import SitePreviewCanvas from './site-preview';
import { DesignPage } from './design-page';
import { SiteIdentityFields } from '../../pickers/identity';
import { __ } from '../../wordpress-packages';

export function SiteIdentityStage() {
	return (
		<DesignPage
			description={ __(
				'How your site introduces itself. Shown in your header, browser tabs, and search results.'
			) }
			saves={ savesIdentity }
			title={ __( 'Name & logo' ) }
		>
			<SiteIdentityFields />
		</DesignPage>
	);
}

export function SiteIdentityCanvas() {
	return <SitePreviewCanvas />;
}
