/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import {
	Button,
	EmptyState,
	Page,
	__,
	lockIcon,
} from '../../wordpress-packages';

function NotAvailable() {
	const navigate = useNavigate();

	return (
		<Page
			className="cnl-editor-stage cnl-editor-not-available"
			headingLevel={ 1 }
			title={ __( 'Not available' ) }
		>
			<EmptyState.Root>
				<EmptyState.Icon icon={ lockIcon } />
				<EmptyState.Title>
					{ __( 'You can’t open this' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Your account can’t change this part of the site. Ask a site administrator if you need to.'
					) }
				</EmptyState.Description>
				<EmptyState.Actions>
					<Button
						__next40pxDefaultSize
						onClick={ () => navigate( { to: '/' } ) }
						variant="primary"
					>
						{ __( 'Go to Home' ) }
					</Button>
				</EmptyState.Actions>
			</EmptyState.Root>
		</Page>
	);
}

export const stage = withUiTheme( NotAvailable );
