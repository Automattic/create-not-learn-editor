/**
 * Publish site: the site's changes waiting to go live, and Publish.
 *
 * The site's changes are everything unsaved except the page or post open in
 * the canvas, which publishes there (see `use-changes.js`). Those that show
 * on every page, like the header, come first, under a purple heading with a
 * globe, as the editor marks anything shared (see `src/global-scope`). Pages
 * changed from a screen beside the canvas, their title or place say, follow.
 *
 * The dialog is a list and Publish. Discarding them all sits behind the menu
 * beside Publish, and is asked about first, in the same dialog, because it
 * can't be undone.
 */

/**
 * WordPress dependencies
 */
import { Button, DropdownMenu, MenuItem, Modal } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import {
	Fragment,
	useEffect,
	useId,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	chevronDown as chevronDownIcon,
	globe as globeIcon,
	page as pageIcon,
} from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';
import { Icon, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { GlobalScope } from '../global-scope';
import { useChanges } from './use-changes';

const GROUPS = [
	{
		id: 'site-wide',
		isSiteWide: true,
		icon: globeIcon,
		title: __( 'Every page' ),
		description: __( 'These change every page of your site.' ),
	},
	{
		id: 'page',
		isSiteWide: false,
		icon: pageIcon,
		title: __( 'Pages and posts' ),
		description: __(
			'These change only the page or post they were made on.'
		),
	},
];

// Rows a group shows before folding the rest behind "Show more", so a long
// session's changes don't turn the dialog into a long scroll.
const VISIBLE_CHANGES = 5;

function ChangeGroup( { group, changes } ) {
	const headingId = useId();
	const listRef = useRef();
	const [ isExpanded, setIsExpanded ] = useState( false );
	const hiddenCount = isExpanded
		? 0
		: Math.max( 0, changes.length - VISIBLE_CHANGES );
	const visibleChanges = hiddenCount
		? changes.slice( 0, VISIBLE_CHANGES )
		: changes;
	// Purple, from the heading to the list's border, for what every page
	// shares.
	const Scope = group.isSiteWide ? GlobalScope : Fragment;

	return (
		<Scope>
			<section
				className={ `cnl-review-changes__group is-${ group.id }` }
				aria-labelledby={ headingId }
			>
				<div className="cnl-review-changes__group-header">
					<Icon
						className="cnl-review-changes__group-icon"
						icon={ group.icon }
						size={ 24 }
					/>
					<div>
						<Text
							id={ headingId }
							render={ <h3 /> }
							variant="heading-md"
							className="cnl-review-changes__group-title"
						>
							{ group.title }
						</Text>
						<Text
							className="cnl-review-changes__group-description"
							variant="body-sm"
						>
							{ group.description }
						</Text>
					</div>
				</div>
				<ul className="cnl-review-changes__list" ref={ listRef }>
					{ visibleChanges.map( ( change ) => (
						<li
							key={ change.id }
							className="cnl-review-changes__item"
						>
							<div className="cnl-review-changes__text">
								<Text className="cnl-review-changes__label">
									{ change.label }
								</Text>
								<Text
									className="cnl-review-changes__detail"
									variant="body-sm"
								>
									{ change.detail }
								</Text>
							</div>
						</li>
					) ) }
				</ul>
				{ hiddenCount > 0 && (
					<Button
						className="cnl-review-changes__show-more"
						variant="link"
						onClick={ () => setIsExpanded( true ) }
					>
						{ sprintf(
							/* translators: %d: Number of hidden changes. */
							_n(
								'Show %d more change',
								'Show %d more changes',
								hiddenCount
							),
							hiddenCount
						) }
					</Button>
				) }
			</section>
		</Scope>
	);
}

// The groups, site-wide first, leaving out one with nothing in it.
function ChangeGroups( { changes } ) {
	return (
		<div className="cnl-review-changes__groups">
			{ GROUPS.map( ( group ) => ( {
				group,
				changes: changes.filter(
					( change ) => !! change.isSiteWide === group.isSiteWide
				),
			} ) )
				.filter( ( { changes: groupChanges } ) => groupChanges.length )
				.map( ( { group, changes: groupChanges } ) => (
					<ChangeGroup
						key={ group.id }
						group={ group }
						changes={ groupChanges }
					/>
				) ) }
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {Function} props.onClose Close the dialog.
 * @return {Element} The dialog.
 */
export function PublishSiteDialog( { onClose } ) {
	const { siteChanges, isSaving, publishSite, discardSite } = useChanges();
	const [ isConfirmingDiscard, setIsConfirmingDiscard ] = useState( false );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const count = siteChanges.length;

	// Nothing left to publish, whether published, discarded or undone
	// elsewhere.
	useEffect( () => {
		if ( ! count ) {
			onClose();
		}
	}, [ count, onClose ] );

	if ( ! count ) {
		return null;
	}

	const onPublish = () => {
		publishSite();
		onClose();
	};

	const onDiscardAll = () => {
		discardSite();
		createSuccessNotice( __( 'Changes discarded.' ), {
			type: 'snackbar',
		} );
	};

	if ( isConfirmingDiscard ) {
		return (
			<Modal
				// A new dialog for each step, so focus moves into it: here
				// onto Keep changes, the safe choice.
				key="discard"
				title={ __( 'Discard changes?' ) }
				onRequestClose={ onClose }
				size="small"
				className="cnl-review-changes"
				focusOnMount="firstContentElement"
			>
				<Stack direction="column" gap="xl">
					<Text>
						{ __(
							'Your site goes back to how visitors see it now. This can’t be undone.'
						) }
					</Text>
					<div className="cnl-review-changes__footer">
						<div className="cnl-review-changes__footer-end">
							<Button
								__next40pxDefaultSize
								variant="tertiary"
								onClick={ () =>
									setIsConfirmingDiscard( false )
								}
							>
								{ __( 'Keep changes' ) }
							</Button>
							<Button
								__next40pxDefaultSize
								variant="primary"
								isDestructive
								onClick={ onDiscardAll }
							>
								{ __( 'Discard changes' ) }
							</Button>
						</div>
					</div>
				</Stack>
			</Modal>
		);
	}

	return (
		<Modal
			key="publish"
			title={ __( 'Publish site' ) }
			onRequestClose={ onClose }
			size="medium"
			className="cnl-review-changes"
		>
			<Stack direction="column" gap="xl">
				<ChangeGroups changes={ siteChanges } />
				<div className="cnl-review-changes__footer">
					<div className="cnl-review-changes__footer-end">
						<Button
							__next40pxDefaultSize
							variant="tertiary"
							onClick={ onClose }
						>
							{ __( 'Cancel' ) }
						</Button>
						<div className="cnl-review-changes__split">
							<Button
								__next40pxDefaultSize
								variant="primary"
								onClick={ onPublish }
								isBusy={ isSaving }
								disabled={ isSaving }
								accessibleWhenDisabled
							>
								{ __( 'Publish' ) }
							</Button>
							<DropdownMenu
								icon={ chevronDownIcon }
								label={ __( 'More publish options' ) }
								popoverProps={ { placement: 'bottom-end' } }
								toggleProps={ {
									__next40pxDefaultSize: true,
									variant: 'primary',
									disabled: isSaving,
									accessibleWhenDisabled: true,
								} }
							>
								{ ( { onClose: closeMenu } ) => (
									<MenuItem
										isDestructive
										onClick={ () => {
											closeMenu();
											setIsConfirmingDiscard( true );
										} }
									>
										{ __( 'Discard changes…' ) }
									</MenuItem>
								) }
							</DropdownMenu>
						</div>
					</div>
				</div>
			</Stack>
		</Modal>
	);
}
