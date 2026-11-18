/**
 * A page's settings, a click away from the canvas: the page's status, at the
 * end of the canvas toolbar's address bar, opens them in a popover, where
 * core's editor has them in its sidebar's Page tab. The summary is the Pages
 * screen's own, so a change is an unsaved edit to the page, as there.
 */

/**
 * WordPress dependencies
 */
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { PAGES_PATH } from '../page-finder/open-page';
import { PageSummary } from '../routes/content/pages/page-details';
import { DETAILS_VIEW } from '../routes/content/pages/page-views';
import { __, Button, Dropdown, sprintf, Tooltip } from '../wordpress-packages';

/**
 * @param {Object} props
 * @param {number} props.pageId      The page's ID.
 * @param {string} props.status      The page's status, like `draft`.
 * @param {string} props.statusLabel The status in words, like Draft.
 * @param {Object} props.statusIcon  Core's icon for the status.
 * @return {Element} The status, as a button that opens the page's settings.
 */
export function PageSettings( { pageId, status, statusLabel, statusIcon } ) {
	return (
		<Dropdown
			className={ `cnl-page-switcher__status is-${ status } is-settings` }
			contentClassName="cnl-page-settings"
			popoverProps={ { placement: 'bottom-end', offset: 12 } }
			renderToggle={ ( { isOpen, onToggle } ) => (
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
				<div className="cnl-page-settings__content">
					<h2 className="cnl-page-settings__heading">
						{ __( 'Page settings' ) }
					</h2>
					<PageSummary pageId={ pageId } />
					<Button
						__next40pxDefaultSize
						className="cnl-page-settings__all"
						onClick={ () => {
							onClose();
							openRoute( PAGES_PATH, {
								postId: pageId,
								previewId: pageId,
								view: DETAILS_VIEW,
							} );
						} }
						variant="tertiary"
					>
						{ __( 'See all details' ) }
					</Button>
				</div>
			) }
		/>
	);
}
