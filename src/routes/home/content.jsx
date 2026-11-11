/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { startHomeTrip } from '../../home-trip';
import { withUiTheme } from '../../theme';
import { settings } from '../../settings';
import { PageSwitcher, SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { getHomepageDocumentIconStatus } from './preview';
import Stage from './stage';
import { getActiveWorkspace } from '../../workspaces/presets';
import {
	Button,
	Dropdown,
	MenuGroup,
	MenuItem,
	__,
	moreHorizontalIcon,
	homeIcon,
	postListIcon,
	coreDataStore,
	settingsIcon,
	useSelect,
} from '../../wordpress-packages';

const DOCUMENT_ICON_BY_STATUS = {
	'home-latest-posts': homeIcon,
	'home-static': homeIcon,
	'posts-page': postListIcon,
};

function PageOptionsDropdown( {
	hasHomepageOptions,
	isBusy,
	onConfigureHomepage,
} ) {
	if ( ! hasHomepageOptions ) {
		return null;
	}

	return (
		<Dropdown
			className="cnl-editor-homepage-options"
			contentClassName="cnl-editor-homepage-options__content"
			popoverProps={ {
				placement: 'bottom',
			} }
			renderContent={ ( { onClose } ) => (
				<MenuGroup className="cnl-editor-homepage-options__menu">
					<MenuItem
						disabled={ isBusy }
						icon={ settingsIcon }
						onClick={ () => {
							onClose();
							onConfigureHomepage();
						} }
					>
						{ __( 'Manage homepage' ) }
					</MenuItem>
				</MenuGroup>
			) }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					aria-expanded={ isOpen }
					className="cnl-editor-homepage-options__toggle"
					icon={ moreHorizontalIcon }
					label={ __( 'Page options' ) }
					onClick={ onToggle }
					showTooltip
					size="compact"
				/>
			) }
		/>
	);
}

function EmptyPreview() {
	return (
		<div className="cnl-editor-canvas-placeholder">
			<span
				aria-hidden
				className="cnl-editor-canvas-placeholder__icon dashicons dashicons-admin-home"
			/>
			<div className="cnl-editor-canvas-placeholder__title">
				{ __( 'Homepage preview unavailable' ) }
			</div>
			<p className="cnl-editor-canvas-placeholder__description">
				{ __(
					'Configure the site URL before previewing the homepage.'
				) }
			</p>
		</div>
	);
}

function PreviewDocument( { canvas } ) {
	const navigate = useNavigate();
	const { isLoadingContext, previewContext } = canvas;
	const previewLabel = previewContext?.previewLabel || __( 'Home' );
	const previewStatusLabel = isLoadingContext
		? __( 'Loading preview details' )
		: previewContext?.previewStatusLabel || __( 'Preview' );
	const previewTypeLabel = previewContext?.previewTypeLabel || '';
	const previewMetaLabel = isLoadingContext
		? previewStatusLabel
		: [ previewTypeLabel, previewStatusLabel ]
				.filter( Boolean )
				.join( ' · ' );
	const documentIcon =
		DOCUMENT_ICON_BY_STATUS[
			getHomepageDocumentIconStatus(
				previewContext?.previewDocumentStatus
			)
		];

	return (
		<div className="cnl-editor-homepage-document">
			<PageSwitcher
				icon={ documentIcon }
				meta={ previewMetaLabel }
				title={ previewLabel }
			/>
			<PageOptionsDropdown
				hasHomepageOptions={
					previewContext?.previewStatus === 'homepage'
				}
				isBusy={ false }
				// The homepage opened up on the Pages screen.
				onConfigureHomepage={ () => {
					// Back on the homepage leads straight back to Home.
					startHomeTrip();
					navigate( {
						search: { postId: 'home', previewId: 'home' },
						to: '/types/page/list/all',
					} );
				} }
			/>
		</div>
	);
}

/**
 * Where a workspace's Home opens the site.
 *
 * Most start at the homepage. A workspace for writers starts wherever the
 * posts are listed: the blog page, when the homepage shows a page and there
 * is one, and the homepage otherwise.
 *
 * @return {string} The address to open.
 */
function useStartUrl() {
	return useSelect( ( select ) => {
		if ( getActiveWorkspace( select ).home.preview !== 'posts' ) {
			return settings.homeUrl;
		}

		const site = select( coreDataStore ).getEntityRecord( 'root', 'site' );
		const postsPageId =
			site?.show_on_front === 'page'
				? Number( site?.page_for_posts ) || 0
				: 0;

		if ( ! postsPageId ) {
			return settings.homeUrl;
		}

		return (
			select( coreDataStore ).getEntityRecord(
				'postType',
				'page',
				postsPageId
			)?.link || settings.homeUrl
		);
	}, [] );
}

/*
 * The site, starting at the homepage. Following links in Preview moves it
 * around the site, and the editor follows it, so turning Preview off changes
 * whatever page is on show.
 */
function Canvas() {
	const canvas = useSiteCanvas( { url: useStartUrl() } );

	return (
		<SiteCanvas
			canvas={ canvas }
			className="cnl-editor-homepage-preview"
			document={ <PreviewDocument canvas={ canvas } /> }
			emptyPreview={ <EmptyPreview /> }
		/>
	);
}

export const stage = withUiTheme( Stage );
export const canvas = withCanvasRecovery( withUiTheme( Canvas ) );
