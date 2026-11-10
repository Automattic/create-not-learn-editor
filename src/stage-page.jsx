/**
 * WordPress dependencies
 */
import { Page as AdminPage } from '@wordpress/admin-ui';
import { Button } from '@wordpress/components';
import { __, isRTL } from '@wordpress/i18n';
import { chevronLeft, chevronRight } from '@wordpress/icons';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { isOnHomeTrip } from './home-trip';
import { openSidebarHome } from './open-sidebar-home';

/**
 * The screen above this one: the last of its breadcrumbs that links
 * somewhere, before its own.
 *
 * @param {?Element} breadcrumbs The screen's breadcrumbs.
 * @return {?string} Route of the screen above, or none for a screen at the
 *                   top level.
 */
function getParentRoute( breadcrumbs ) {
	const items = breadcrumbs?.props?.items;

	if ( ! Array.isArray( items ) ) {
		return null;
	}

	return (
		items
			.slice( 0, -1 )
			.reverse()
			.find( ( item ) => item?.to )?.to ?? null
	);
}

/**
 * Back, up one level: to the screen above this one, as its breadcrumbs
 * have it. A top-level screen, like Pages or Design, has none above it, so
 * Back opens the sidebar on Home, where every top-level screen is listed.
 * Anything reached through Home is a shortcut from there, so Back goes
 * straight back to Home instead (`home-trip.js`).
 *
 * @param {Object}  props        Component props.
 * @param {?string} props.parent Route of the screen above, if any.
 * @return {Element} The Back button.
 */
function StageBack( { parent } ) {
	const navigate = useNavigate();

	// As core's Styles panel has it: a chevron, labelled Back, before the
	// screen's title.
	return (
		<Button
			className="cnl-stage-back"
			icon={ isRTL() ? chevronRight : chevronLeft }
			label={ __( 'Back' ) }
			onClick={ () => {
				if ( isOnHomeTrip() ) {
					navigate( { to: '/' } );
				} else if ( parent ) {
					navigate( { to: parent } );
				} else {
					openSidebarHome();
				}
			} }
			size="small"
		/>
	);
}

/**
 * Admin UI's page, with Back at the start of its header. Every screen in
 * the stage is one of these.
 *
 * @param {Object}  props        Admin UI `Page` props, and:
 * @param {boolean} props.isRoot Whether this is Home, which is above every
 *                               other screen and so has no Back.
 * @return {Element} The page.
 */
export function Page( { isRoot = false, ...props } ) {
	const { breadcrumbs } = props;

	return (
		<AdminPage
			{ ...props }
			breadcrumbs={
				<>
					{ ! isRoot && (
						<StageBack parent={ getParentRoute( breadcrumbs ) } />
					) }
					{ breadcrumbs }
				</>
			}
		/>
	);
}

Page.SidebarToggleFill = AdminPage.SidebarToggleFill;
