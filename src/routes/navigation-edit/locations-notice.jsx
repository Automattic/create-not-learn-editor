/**
 * Internal dependencies
 */
import {
	Button,
	createInterpolateElement,
	sprintf,
	UiNotice,
	__,
} from '../../wordpress-packages';

function LinkButton( { children, onClick } ) {
	return (
		<Button
			className="routes-navigation-locations-notice__link"
			onClick={ onClick }
			variant="link"
		>
			{ children }
		</Button>
	);
}

/**
 * Says what Locations shows: the places on the site the menu appears, which
 * the cards below preview. With a link to change them, and, while the menu is
 * in just one place and there are others it could go, a nudge to add it to
 * one.
 *
 * @param {Object}   props
 * @param {boolean}  props.canAddLocation   Whether there are places the menu
 *                                          could go that it isn't in yet.
 * @param {Object[]} props.locations        The places the menu appears.
 * @param {Function} props.onChangeLocation Opens the locations dialog.
 * @return {Element} The notice.
 */
export function LocationsNotice( {
	canAddLocation,
	locations,
	onChangeLocation,
} ) {
	const isOnePlace = locations.length === 1;
	const summary = isOnePlace
		? sprintf(
				/* translators: %s: Where the menu appears, like "Header". */
				__( 'This menu appears in one place on your site, your %s.' ),
				locations[ 0 ].label
			)
		: sprintf(
				/* translators: %d: How many places the menu appears. */
				__(
					'This menu appears in %d places on your site, shown below. Changes to the menu show in all of them.'
				),
				locations.length
			);
	let action = __( '<a>Change where it appears</a>.' );

	if ( isOnePlace ) {
		action = canAddLocation
			? __( '<a>Show it in another place too</a>.' )
			: '';
	}

	return (
		<UiNotice.Root
			className="routes-navigation-locations-notice"
			intent="info"
		>
			<UiNotice.Description>
				{ summary }
				{ action && ' ' }
				{ action &&
					createInterpolateElement( action, {
						a: <LinkButton onClick={ onChangeLocation } />,
					} ) }
			</UiNotice.Description>
		</UiNotice.Root>
	);
}
