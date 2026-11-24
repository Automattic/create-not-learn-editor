/**
 * A page's settings, a click away from the canvas: the page's status, at the
 * end of the canvas toolbar's address bar, opens them in a popover, where
 * core's editor has them in its sidebar's Page tab. They are every detail the
 * Pages screen has for the page, so a change is an unsaved edit to the page,
 * as there. Only its layout leads on, to the layouts in the sidebar.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { expandCanvas } from './expansion';
import { PAGES_PATH } from '../page-finder/open-page';
import { PageDetails } from '../routes/content/pages/page-details';
import { useHomepageState } from '../routes/content/pages/homepage';
import { usePageLayoutName } from '../routes/content/pages/page-layout-picker';
import { LAYOUT_VIEW } from '../routes/content/pages/page-views';
import {
	__,
	Dropdown,
	sprintf,
	Tooltip,
	useState,
} from '../wordpress-packages';

/**
 * Every detail about the page, with its layout leading on to the layouts.
 *
 * @param {Object}   props
 * @param {number}   props.pageId  The page's ID.
 * @param {Function} props.onClose Closes the popover.
 * @return {Element} The details.
 */
function PageSettingsContent( { pageId, onClose } ) {
	const homepage = useHomepageState();
	const page = useSelect(
		( select ) =>
			select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'page',
				pageId
			),
		[ pageId ]
	);
	const layoutName = usePageLayoutName( {
		isFrontPage: pageId === homepage.pageId,
		slug: page?.slug,
		template: page?.template,
	} );

	return (
		<div className="cnl-page-settings__content">
			<h2 className="cnl-page-settings__heading">
				{ __( 'Page settings' ) }
			</h2>
			<PageDetails
				layoutName={ layoutName }
				onOpenLayouts={ () => {
					onClose();
					// The layouts open in the sidebar, which an expanded
					// canvas hides, so bring it back.
					expandCanvas( false );
					openRoute( PAGES_PATH, {
						postId: pageId,
						previewId: pageId,
						view: LAYOUT_VIEW,
					} );
				} }
				pageId={ pageId }
			/>
		</div>
	);
}

/**
 * @param {Object} props
 * @param {number} props.pageId      The page's ID.
 * @param {string} props.status      The page's status, like `draft`.
 * @param {string} props.statusLabel The status in words, like Draft.
 * @param {Object} props.statusIcon  Core's icon for the status.
 * @return {Element} The status, as a button that opens the page's settings.
 */
export function PageSettings( { pageId, status, statusLabel, statusIcon } ) {
	const [ isOpen, setIsOpen ] = useState( false );

	return (
		<Dropdown
			className={ `cnl-page-switcher__status is-${ status } is-settings` }
			contentClassName="cnl-page-settings"
			onToggle={ setIsOpen }
			open={ isOpen }
			popoverProps={ {
				placement: 'bottom-end',
				offset: 12,
				/*
				 * A row's own popover, like Menus' switches, isn't inside
				 * this one, nor marked as a dialog, so the dropdown's own
				 * check would close the settings, and the row with them,
				 * as soon as focus moved into it.
				 */
				onFocusOutside: ( event ) => {
					const focused = ( event?.target?.ownerDocument || document )
						.activeElement;

					if (
						! focused ||
						! focused.closest?.(
							'.components-popover, [role="dialog"], .cnl-page-switcher__status.is-settings'
						)
					) {
						setIsOpen( false );
					}
				},
			} }
			renderToggle={ ( { onToggle } ) => (
				<Tooltip.Root disabled={ isOpen }>
					<Tooltip.Trigger
						aria-expanded={ isOpen }
						aria-haspopup="dialog"
						aria-label={ sprintf(
							/* translators: %s: The page's status, like Published. */
							__( 'Page settings. %s' ),
							statusLabel
						) }
						className="cnl-page-switcher__settings-toggle"
						onClick={ onToggle }
						render={ <button type="button" /> }
					>
						<Icon icon={ statusIcon } size={ 20 } />
					</Tooltip.Trigger>
					<Tooltip.Popup
						positioner={ <Tooltip.Positioner side="bottom" /> }
					>
						{ sprintf(
							/* translators: %s: The page's status, like Published. */
							__( '%s · Page settings' ),
							statusLabel
						) }
					</Tooltip.Popup>
				</Tooltip.Root>
			) }
			renderContent={ ( { onClose } ) => (
				<PageSettingsContent onClose={ onClose } pageId={ pageId } />
			) }
		/>
	);
}
