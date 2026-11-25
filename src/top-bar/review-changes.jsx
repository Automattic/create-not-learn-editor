/**
 * Review changes: every change waiting to be saved, each of which can be
 * discarded, with Save and Discard all for the lot.
 *
 * Each change has a checkbox, ticked to begin with, so the user can save some
 * changes and leave the rest unsaved for later, as core's review does. Save
 * counts only the ticked ones.
 *
 * Discarding everything is asked about first, in the same dialog, because it
 * cannot be undone.
 *
 * Changes come in two groups, each saying what its changes reach. Those that
 * show on every page, like the header, come first, under a purple heading
 * with a filled symbol and with purple Discard buttons, as the editor marks
 * anything shared. Those that change only the page or post they were made on
 * follow, unmarked. See `src/global-scope`.
 */

/**
 * WordPress dependencies
 */
import { Button, CheckboxControl, Modal } from '@wordpress/components';
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
import {
	page as pageIcon,
	symbolFilled as symbolFilledIcon,
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
		icon: symbolFilledIcon,
		title: __( 'Site-wide changes', 'create-not-learn-editor' ),
		description: __(
			'These change every page of your site.',
			'create-not-learn-editor'
		),
	},
	{
		id: 'page',
		isSiteWide: false,
		icon: pageIcon,
		title: __( 'Page changes', 'create-not-learn-editor' ),
		description: __(
			'These change only the page or post they were made on.',
			'create-not-learn-editor'
		),
	},
];

// Rows a group shows before folding the rest behind "Show more", so a long
// session's changes don't turn the dialog into a long scroll.
const VISIBLE_CHANGES = 5;

function ChangeGroup( { group, changes, leftOut, onToggle, onDiscard } ) {
	const headingId = useId();
	const listRef = useRef();
	const [ isExpanded, setIsExpanded ] = useState( false );
	const hiddenCount = isExpanded
		? 0
		: Math.max( 0, changes.length - VISIBLE_CHANGES );
	const visibleChanges = hiddenCount
		? changes.slice( 0, VISIBLE_CHANGES )
		: changes;

	// The button goes once pressed, so focus moves to the first row it showed.
	const showAll = () => {
		setIsExpanded( true );
		window.requestAnimationFrame( () => {
			listRef.current
				?.querySelectorAll( '.cnl-review-changes__discard' )
				[ VISIBLE_CHANGES ]?.focus();
		} );
	};
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
							<span className="cnl-review-changes__group-count">
								{ changes.length }
							</span>
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
							<CheckboxControl
								className="cnl-review-changes__text"
								__nextHasNoMarginBottom
								label={ change.label }
								help={ change.detail }
								checked={ ! leftOut.has( change.id ) }
								onChange={ ( isChecked ) =>
									onToggle( change, isChecked )
								}
							/>
							<Button
								className="cnl-review-changes__discard"
								variant="tertiary"
								size="compact"
								onClick={ () => onDiscard( change ) }
								aria-label={ sprintf(
									/* translators: %s: What was changed, like "Site name". */
									__(
										'Discard change to %s',
										'create-not-learn-editor'
									),
									change.label
								) }
							>
								{ __( 'Discard', 'create-not-learn-editor' ) }
							</Button>
						</li>
					) ) }
				</ul>
				{ hiddenCount > 0 && (
					<Button
						className="cnl-review-changes__show-more"
						variant="link"
						onClick={ showAll }
					>
						{ sprintf(
							/* translators: %d: Number of hidden changes. */
							_n(
								'Show %d more change',
								'Show %d more changes',
								hiddenCount,
								'create-not-learn-editor'
							),
							hiddenCount
						) }
					</Button>
				) }
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
function ChangeGroups( { changes, leftOut, onToggle, onDiscard } ) {
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
					leftOut={ leftOut }
					onToggle={ onToggle }
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
 * @param {Function} props.onClose       Close the dialog.
 * @param {boolean}  props.inEditSession Only what changed while editing
 *                                       the page, for its Save.
 * @param {boolean}  props.isPublishing  Worded for Publish, at the foot of
 *                                       a screen.
 * @return {Element} The dialog.
 */
export function ReviewChanges( {
	onClose,
	inEditSession = false,
	isPublishing = false,
} ) {
	const { changes, isSaving, save, discard, discardAll } = useChanges( {
		inEditSession,
	} );
	const [ isConfirmingDiscard, setIsConfirmingDiscard ] = useState( false );
	// Changes the user has unticked, by ID. Everything is ticked to begin
	// with, so a change made while the dialog is open is too.
	const [ leftOutIds, setLeftOutIds ] = useState( () => new Set() );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const count = changes.length;
	const leftOut = changes.filter( ( change ) => leftOutIds.has( change.id ) );
	const saveCount = count - leftOut.length;

	const onToggle = ( change, isChecked ) =>
		setLeftOutIds( ( ids ) => {
			const next = new Set( ids );

			if ( isChecked ) {
				next.delete( change.id );
			} else {
				next.add( change.id );
			}

			return next;
		} );

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
		save( leftOut );
		onClose();
	};

	const onDiscardAll = () => {
		discardAll();
		createSuccessNotice(
			__( 'Changes discarded.', 'create-not-learn-editor' ),
			{
				type: 'snackbar',
			}
		);
	};

	if ( isConfirmingDiscard ) {
		return (
			<Modal
				// A new dialog for each step, so focus moves into it: here
				// onto Keep changes, the safe choice.
				key="discard"
				title={ __( 'Discard changes?', 'create-not-learn-editor' ) }
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
								count,
								'create-not-learn-editor'
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
								{ __(
									'Keep changes',
									'create-not-learn-editor'
								) }
							</Button>
							<Button
								__next40pxDefaultSize
								variant="primary"
								isDestructive
								onClick={ onDiscardAll }
							>
								{ __(
									'Discard changes',
									'create-not-learn-editor'
								) }
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
			title={
				isPublishing
					? __( 'Publish changes', 'create-not-learn-editor' )
					: __( 'Review changes', 'create-not-learn-editor' )
			}
			onRequestClose={ onClose }
			size="medium"
			className="cnl-review-changes"
		>
			<Stack direction="column" gap="xl">
				<Text className="cnl-review-changes__intro">
					{ isPublishing
						? __(
								'Visitors see these once you publish them. Untick any you want to keep working on, or discard any you don’t want.',
								'create-not-learn-editor'
							)
						: __(
								'Visitors see these once you save them. Untick any you want to keep working on, or discard any you don’t want.',
								'create-not-learn-editor'
							) }
				</Text>
				<ChangeGroups
					changes={ changes }
					leftOut={ leftOutIds }
					onToggle={ onToggle }
					onDiscard={ discard }
				/>
				<div className="cnl-review-changes__footer">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						isDestructive
						onClick={ () => setIsConfirmingDiscard( true ) }
						disabled={ isSaving }
						accessibleWhenDisabled
					>
						{ __( 'Discard all', 'create-not-learn-editor' ) }
					</Button>
					<div className="cnl-review-changes__footer-end">
						<Button
							__next40pxDefaultSize
							variant="tertiary"
							onClick={ onClose }
						>
							{ __( 'Cancel', 'create-not-learn-editor' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							variant="primary"
							onClick={ onSave }
							isBusy={ isSaving }
							disabled={ isSaving || ! saveCount }
							accessibleWhenDisabled
						>
							{ isPublishing
								? sprintf(
										/* translators: %d: Number of changes to publish. */
										_n(
											'Publish %d change',
											'Publish %d changes',
											saveCount,
											'create-not-learn-editor'
										),
										saveCount
									)
								: sprintf(
										/* translators: %d: Number of changes to save. */
										_n(
											'Save %d change',
											'Save %d changes',
											saveCount,
											'create-not-learn-editor'
										),
										saveCount
									) }
						</Button>
					</div>
				</div>
			</Stack>
		</Modal>
	);
}
