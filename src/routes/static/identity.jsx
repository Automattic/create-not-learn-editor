/**
 * Internal dependencies
 */
import SitePreviewCanvas from './site-preview';
import { DesignPage } from './design-page';
import { SiteIdentityFields } from '../../pickers/identity';
import { __ } from '../../wordpress-packages';

export function SiteIdentityStage() {
	return (
		<DesignPage
			description={ __(
				'How your site introduces itself. Shown in your header, browser tabs, and search results.',
				'create-not-learn-editor'
			) }
			title={ __( 'Name & logo', 'create-not-learn-editor' ) }
		>
			<SiteIdentityFields />
		</DesignPage>
	);
}

export function SiteIdentityCanvas() {
	return <SitePreviewCanvas />;
}
