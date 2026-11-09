/**
 * Review changes: every change waiting to be saved, each of which can be
 * discarded, with Save and Discard all for the lot.
 *
 * Discarding everything is asked about first, in the same dialog, because it
 * cannot be undone.
 *
 * Changes come in two groups, each saying what its changes reach. Those that
 * show on every page, like the header, come first, under a purple heading
 * with a globe and with purple Discard buttons, as the editor marks anything
 * shared. Those that change only the page or post they were made on follow,
 * unmarked. See `src/global-scope`.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import {
	Fragment,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { globe as globeIcon, page as pageIcon } from '@wordpress/icons';
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
		title: __( 'Site-wide changes' ),
		description: __( 'These change every page of your site.' ),
	},
	{
		id: 'page',
		isSiteWide: false,
		icon: pageIcon,
		title: __( 'Page changes' ),
		description: __(
			'These change only the page or post they were made on.'
		),
	},
];

function ChangeGroup( { group, changes, onDiscard } ) {
	const headingId = useId();
	// Purple, from the heading to the Discard buttons, for what every page
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
						size={ 20 }
					/>
					<div>
						<Text
							id={ headingId }
							render={ <h3 /> }
							variant="heading-sm"
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
				<ul className="cnl-review-changes__list">
					{ changes.map( ( change ) => (
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
							<Button
								className="cnl-review-changes__discard"
								variant="tertiary"
								size="compact"
								onClick={ () => onDiscard( change ) }
								aria-label={ sprintf(
									/* translators: %s: What was changed, like "Site name". */
									__( 'Discard change to %s' ),
									change.label
								) }
							>
								{ __( 'Discard' ) }
							</Button>
						</li>
					) ) }
				</ul>
			</section>
		</Scope>
	);
}

/*
 * The groups, site-wide first, leaving out one with nothing in it.
 *
 * A discarded change's row goes, and its button with it, so focus moves to
 * the Discard button now in the same place, or the last one if it was last,
 * even when that is in the other group.
 */
function ChangeGroups( { changes, onDiscard } ) {
	const ref = useRef();
	const discardedIndex = useRef( null );

	const grouped = GROUPS.map( ( group ) => ( {
		group,
		changes: changes.filter(
			( change ) => !! change.isSiteWide === group.isSiteWide
		),
	} ) ).filter( ( { changes: groupChanges } ) => groupChanges.length );
	const ordered = grouped.flatMap(
		( { changes: groupChanges } ) => groupChanges
	);

	useLayoutEffect( () => {
		if ( discardedIndex.current === null ) {
			return;
		}

		const buttons =
			ref.current?.querySelectorAll( '.cnl-review-changes__discard' ) ??
			[];
		buttons[
			Math.min( discardedIndex.current, buttons.length - 1 )
		]?.focus();
		discardedIndex.current = null;
	}, [ changes.length ] );

	return (
		<div className="cnl-review-changes__groups" ref={ ref }>
			{ grouped.map( ( { group, changes: groupChanges } ) => (
				<ChangeGroup
					key={ group.id }
					group={ group }
					changes={ groupChanges }
					onDiscard={ ( change ) => {
						discardedIndex.current = ordered.indexOf( change );
						onDiscard( change );
					} }
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
export function ReviewChanges( { onClose } ) {
	const { changes, isSaving, save, discard, discardAll } = useChanges();
	const [ isConfirmingDiscard, setIsConfirmingDiscard ] = useState( false );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const count = changes.length;

	// Nothing left to review, whether saved, discarded or undone elsewhere.
	useEffect( () => {
		if ( ! count ) {
			onClose();
		}
	}, [ count, onClose ] );

	if ( ! count ) {
		return null;
	}

	const onSave = () => {
		save();
		onClose();
	};

	const onDiscardAll = () => {
		discardAll();
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
						{ sprintf(
							/* translators: %d: Number of changes waiting to be saved. */
							_n(
								'Your %d unsaved change will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
								'All %d unsaved changes will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
								count
							),
							count
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
			key="review"
			title={ __( 'Review changes' ) }
			onRequestClose={ onClose }
			size="medium"
			className="cnl-review-changes"
		>
			<Stack direction="column" gap="xl">
				<Text className="cnl-review-changes__intro">
					{ __(
						'Visitors see these once you save them. Discard any you don’t want to keep.'
					) }
				</Text>
				<ChangeGroups changes={ changes } onDiscard={ discard } />
				<div className="cnl-review-changes__footer">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						isDestructive
						onClick={ () => setIsConfirmingDiscard( true ) }
						disabled={ isSaving }
						accessibleWhenDisabled
					>
						{ __( 'Discard all' ) }
					</Button>
					<div className="cnl-review-changes__footer-end">
						<Button
							__next40pxDefaultSize
							variant="tertiary"
							onClick={ onClose }
						>
							{ __( 'Cancel' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							variant="primary"
							onClick={ onSave }
							isBusy={ isSaving }
							disabled={ isSaving }
							accessibleWhenDisabled
						>
							{ sprintf(
								/* translators: %d: Number of changes to save. */
								_n(
									'Save %d change',
									'Save %d changes',
									count
								),
								count
							) }
						</Button>
					</div>
				</div>
			</Stack>
		</Modal>
	);
}
