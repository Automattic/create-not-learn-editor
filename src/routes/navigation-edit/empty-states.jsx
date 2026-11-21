/**
 * Internal dependencies
 */
import { Button, compassIcon, EmptyState, __ } from '../../wordpress-packages';

export function NavigationLocationsEmptyState( {
	disabled,
	onChooseLocation,
} ) {
	return (
		<EmptyState.Root className="routes-navigation-locations-canvas__empty-state">
			<EmptyState.Icon icon={ compassIcon } />
			<EmptyState.Title>
				{ __(
					'This menu is not shown on your site yet',
					'create-not-learn-editor'
				) }
			</EmptyState.Title>
			<EmptyState.Description>
				{ __(
					'Choose where this menu should appear, such as your header or footer.',
					'create-not-learn-editor'
				) }
			</EmptyState.Description>
			<EmptyState.Actions>
				<Button
					__next40pxDefaultSize
					disabled={ disabled }
					onClick={ onChooseLocation }
					variant="primary"
				>
					{ __( 'Choose location', 'create-not-learn-editor' ) }
				</Button>
			</EmptyState.Actions>
		</EmptyState.Root>
	);
}

export function NavigationNoMenuSelectedEmptyState() {
	return (
		<EmptyState.Root className="routes-navigation-locations-canvas__empty-state">
			<EmptyState.Icon icon={ compassIcon } />
			<EmptyState.Title>
				{ __( 'No menu selected', 'create-not-learn-editor' ) }
			</EmptyState.Title>
		</EmptyState.Root>
	);
}
