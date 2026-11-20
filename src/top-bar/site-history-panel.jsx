/**
 * Site history: a clock in the top bar that opens a panel down the right of
 * the screen, listing what each Publish site saved.
 *
 * Only what Publish site publishes is here, as `site-history.js` explains.
 * Entries are grouped by day. Each says how many changes it published, what
 * they were, when and who by, and has Restore, which loads that version back
 * in as unsaved edits for Publish site to publish. The newest is what the
 * site shows, so it has nothing to restore. Every Restore asks first, in a
 * dialog saying the editor changes and the site doesn't until Publish site.
 * There is no preview of an old version.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { useRegistry } from '@wordpress/data';
import {
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	backup as historyIcon,
	chevronDownSmall,
	chevronLeft,
	chevronRightSmall,
	close as closeIcon,
	Icon,
} from '@wordpress/icons';
import { store as noticesStore } from '@wordpress/notices';
import { Badge, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { getTimeAgo } from './agent-status';
import {
	getSiteHistory,
	countReplaced,
	planRestore,
	onSiteHistoryChanged,
	restoreEntry,
	RESTORE_FAILED_MESSAGE,
} from './site-history';
import { summarise } from './site-history-diff';
import { useChanges } from './use-changes';

const HOUR_MS = 60 * 60 * 1000;

function startOfDay( time ) {
	const date = new Date( time );
	date.setHours( 0, 0, 0, 0 );

	return date.getTime();
}

function describeDay( dayStart, now ) {
	const today = startOfDay( now );

	if ( dayStart === today ) {
		return __( 'Today' );
	}

	// Not 24 hours back, which a clock change would throw out.
	if ( dayStart === startOfDay( today - 1 ) ) {
		return __( 'Yesterday' );
	}

	return new Date( dayStart ).toLocaleDateString( undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year:
			new Date( dayStart ).getFullYear() === new Date( now ).getFullYear()
				? undefined
				: 'numeric',
	} );
}

/**
 * The entries by the day they were published, newest first, as the log
 * keeps them.
 *
 * @param {Object[]} entries The log's entries.
 * @param {number}   now     Now, in milliseconds.
 * @return {Object[]} `{ key, label, entries }` for each day.
 */
function groupByDay( entries, now ) {
	const days = [];

	entries.forEach( ( entry ) => {
		const dayStart = startOfDay( entry.time * 1000 );
		const last = days[ days.length - 1 ];

		if ( last?.key === dayStart ) {
			last.entries.push( entry );
		} else {
			days.push( {
				key: dayStart,
				label: describeDay( dayStart, now ),
				entries: [ entry ],
			} );
		}
	} );

	return days;
}

// The day heads the group, so an entry only needs its time.
function formatTime( seconds, now ) {
	const time = seconds * 1000;

	return now - time < HOUR_MS
		? getTimeAgo( time, now )
		: new Date( time ).toLocaleTimeString( undefined, {
				hour: 'numeric',
				minute: '2-digit',
			} );
}

function describeEntry( entry ) {
	return sprintf(
		/* translators: %d: Number of changes a publish saved together. */
		_n(
			'Published %d change',
			'Published %d changes',
			entry.changes.length
		),
		entry.changes.length
	);
}

/**
 * One side of a change, with its colour or image beside it.
 *
 * @param {Object} props
 * @param {Object} props.value `{ text, color?, image? }`.
 * @return {Element} The value.
 */
function Value( { value } ) {
	if ( ! value ) {
		return null;
	}

	return (
		<span className="cnl-site-history__value">
			{ value.color && (
				<span
					className="cnl-site-history__swatch"
					style={ { background: value.color } }
					aria-hidden="true"
				/>
			) }
			{ value.image && (
				<img
					className="cnl-site-history__thumb"
					src={ value.image }
					alt=""
				/>
			) }
			<span className="cnl-site-history__value-text">{ value.text }</span>
		</span>
	);
}

/**
 * A detail's from and to, or what was added or taken away.
 *
 * @param {Object} props
 * @param {Object} props.detail `{ kind, from, to }`.
 * @return {Element} The values.
 */
function FromTo( { detail } ) {
	if ( detail.kind === 'added' ) {
		return (
			<span className="cnl-site-history__from-to">
				<span className="cnl-site-history__mark is-added">+</span>
				<Value value={ detail.to } />
			</span>
		);
	}

	if ( detail.kind === 'removed' ) {
		return (
			<span className="cnl-site-history__from-to is-removed">
				<span className="cnl-site-history__mark is-removed">−</span>
				<Value value={ detail.from } />
			</span>
		);
	}

	return (
		<span className="cnl-site-history__from-to">
			<span className="cnl-site-history__from">
				<Value value={ detail.from } />
			</span>
			<span className="cnl-site-history__arrow" aria-label={ __( 'to' ) }>
				→
			</span>
			<Value value={ detail.to } />
		</span>
	);
}

function getChangeKey( entry, index ) {
	return `${ entry.id }:${ index }`;
}

/**
 * The second level: an entry's changes, each with a line saying what it
 * changed. One with details opens the third level.
 *
 * @param {Object}   props
 * @param {Object}   props.entry   The entry.
 * @param {Function} props.onDrill Open a change's details, by its index.
 * @param {boolean}  props.isOpen  Whether the entry is open.
 * @return {Element} The changes.
 */
function EntryChanges( { entry, onDrill, isOpen } ) {
	return (
		<div
			className={ `cnl-site-history__changes-wrap${
				isOpen ? ' is-open' : ''
			}` }
			inert={ isOpen ? undefined : '' }
			aria-hidden={ ! isOpen }
		>
			<ul className="cnl-site-history__changes">
				{ entry.changes.map( ( change, index ) => {
					const details = change.details || [];
					const only = details.length === 1 ? details[ 0 ] : null;
					// One detail shows in full here, so only more open a
					// screen of their own.
					const canDrill = details.length > 1;
					// Worked out again from the details, so older entries
					// read in today's words.
					const summary = details.length
						? summarise( details, change.kind === 'postType' )
						: change.summary;
					const content = (
						<>
							<span className="cnl-site-history__change-text">
								<span className="cnl-site-history__change-label">
									{ change.label }
								</span>
								{ only ? (
									<FromTo detail={ only } />
								) : (
									summary && (
										<span className="cnl-site-history__change-summary">
											{ summary }
										</span>
									)
								) }
							</span>
							{ canDrill && (
								<Icon
									className="cnl-site-history__change-chevron"
									icon={ chevronRightSmall }
									size={ 20 }
								/>
							) }
						</>
					);

					return (
						<li key={ index }>
							{ canDrill ? (
								<button
									type="button"
									className="cnl-site-history__change"
									data-change-key={ getChangeKey(
										entry,
										index
									) }
									onClick={ () => onDrill( index ) }
								>
									{ content }
								</button>
							) : (
								<div className="cnl-site-history__change">
									{ content }
								</div>
							) }
						</li>
					);
				} ) }
			</ul>
		</div>
	);
}

/**
 * Asked before every Restore: it changes what the editor shows, and that
 * the site itself stays as it is until Publish site.
 *
 * @param {Object}   props
 * @param {Object}   props.entry         The entry to restore.
 * @param {number}   props.now           Now, in milliseconds.
 * @param {number}   props.replacedCount How many of its changes land on
 *                                       something with unpublished changes.
 * @param {boolean}  props.isBusy        Whether it is restoring.
 * @param {Function} props.onConfirm     Restore.
 * @param {Function} props.onCancel      Keep things as they are.
 * @return {Element} The dialog.
 */
function RestoreDialog( {
	entry,
	now,
	replacedCount,
	isBusy,
	onConfirm,
	onCancel,
} ) {
	// "8 mins ago" alone, or the day and time: "Yesterday, 3:12 PM".
	const when =
		now - entry.time * 1000 < HOUR_MS
			? formatTime( entry.time, now )
			: sprintf(
					/* translators: 1: A day, like "Today", 2: a time. */
					__( '%1$s, %2$s' ),
					describeDay( startOfDay( entry.time * 1000 ), now ),
					formatTime( entry.time, now )
				);
	const labels = entry.changes
		.map( ( { label } ) => label )
		.filter( Boolean )
		.join( ', ' );

	return (
		<Modal
			title={ __( 'Restore this version?' ) }
			onRequestClose={ onCancel }
			size="small"
			className="cnl-site-history-restore"
			// The safe choice first.
			focusOnMount="firstContentElement"
		>
			<Stack direction="column" gap="lg">
				<div className="cnl-site-history-restore__version">
					<Text className="cnl-site-history-restore__version-title">
						{ labels || describeEntry( entry ) }
					</Text>
					<Text
						className="cnl-site-history-restore__version-meta"
						variant="body-sm"
					>
						{ [
							sprintf(
								/* translators: %s: When it was published. */
								__( 'Published %s' ),
								when
							),
							entry.user?.name,
						]
							.filter( Boolean )
							.join( ' · ' ) }
					</Text>
				</div>
				<Text>
					{ __(
						'The editor’s preview goes back to how this version looked.'
					) }
				</Text>
				<Text>
					{ __(
						'Your site doesn’t change yet. Visitors see this version only once you publish it with Publish site.'
					) }
				</Text>
				{ replacedCount > 0 && (
					<Text className="cnl-site-history-restore__warning">
						{ __(
							'This replaces changes you haven’t published yet.'
						) }
					</Text>
				) }
				<div className="cnl-site-history-restore__actions">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						onClick={ onCancel }
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						variant="primary"
						onClick={ onConfirm }
						isBusy={ isBusy }
						disabled={ isBusy }
						accessibleWhenDisabled
					>
						{ __( 'Restore' ) }
					</Button>
				</div>
			</Stack>
		</Modal>
	);
}

function HistoryEntry( {
	entry,
	index,
	now,
	isLatest,
	isBusy,
	isDisabled,
	replacedCount,
	onRestore,
	onDrill,
	isOpen,
	onToggle,
} ) {
	const [ isConfirming, setIsConfirming ] = useState( false );
	// Every Restore reads the same, so each says which publish it is for.
	const headId = useId();
	const changesId = useId();
	const labels = entry.changes
		.map( ( { label } ) => label )
		.filter( Boolean )
		.join( ', ' );

	let action = null;

	if ( isLatest ) {
		// What visitors see now, unless something has changed since, so
		// putting it back would change nothing.
		action = <Badge intent="stable">{ __( 'Latest' ) }</Badge>;
	} else {
		action = (
			<Button
				className="cnl-site-history__restore"
				variant="tertiary"
				size="compact"
				aria-describedby={ headId }
				onClick={ () => setIsConfirming( true ) }
				isBusy={ isBusy }
				disabled={ isDisabled }
				accessibleWhenDisabled
			>
				{ __( 'Restore' ) }
			</Button>
		);
	}

	return (
		<li
			className={ `cnl-site-history__entry${
				isLatest ? ' is-latest' : ''
			}${ isOpen ? ' is-open' : '' }` }
			// Each entry follows the one above it in, a little later.
			style={ { '--cnl-entry-index': Math.min( index, 8 ) } }
		>
			<span className="cnl-site-history__dot" aria-hidden="true" />
			<div className="cnl-site-history__entry-text">
				<button
					type="button"
					className="cnl-site-history__entry-toggle"
					aria-expanded={ isOpen }
					aria-controls={ changesId }
					onClick={ onToggle }
				>
					<span
						className="cnl-site-history__entry-head"
						id={ headId }
					>
						<span className="cnl-site-history__entry-title">
							{ describeEntry( entry ) }
							<Icon
								className="cnl-site-history__entry-chevron"
								icon={ chevronDownSmall }
								size={ 20 }
							/>
						</span>
						<time
							className="cnl-site-history__entry-time"
							dateTime={ new Date(
								entry.time * 1000
							).toISOString() }
							title={ new Date(
								entry.time * 1000
							).toLocaleString() }
						>
							{ formatTime( entry.time, now ) }
						</time>
					</span>
					{ labels && ! isOpen && (
						<span className="cnl-site-history__entry-labels">
							{ labels }
						</span>
					) }
				</button>
				<div id={ changesId }>
					<EntryChanges
						entry={ entry }
						isOpen={ isOpen }
						onDrill={ onDrill }
					/>
				</div>
				<div className="cnl-site-history__entry-foot">
					<Text
						className="cnl-site-history__entry-meta"
						variant="body-sm"
					>
						{ entry.user?.name
							? sprintf(
									/* translators: %s: Name of the person who published. */
									__( 'By %s' ),
									entry.user.name
								)
							: null }
					</Text>
					{ action }
				</div>
				{ isConfirming && (
					<RestoreDialog
						entry={ entry }
						now={ now }
						replacedCount={ replacedCount }
						isBusy={ isBusy }
						// It closes with the panel once restored, or here if
						// nothing could be, as the snackbar then says.
						onConfirm={ async () => {
							await onRestore( entry );
							setIsConfirming( false );
						} }
						onCancel={ () => setIsConfirming( false ) }
					/>
				) }
			</div>
		</li>
	);
}

/**
 * The third level: every detail of one change, from what to what.
 *
 * @param {Object}   props
 * @param {Object}   props.entry  The entry.
 * @param {Object}   props.change The change.
 * @param {number}   props.now    Now, in milliseconds.
 * @param {Function} props.onBack Back to the list.
 * @return {Element} The details.
 */
function ChangeDetails( { entry, change, now, onBack } ) {
	const screenRef = useRef();

	// On the screen, not Back, so no focus ring flashes up; Tab reaches Back.
	useEffect( () => {
		screenRef.current?.focus( { preventScroll: true } );
	}, [] );

	return (
		<div
			className="cnl-site-history__screen is-details"
			ref={ screenRef }
			tabIndex={ -1 }
		>
			<div className="cnl-site-history__header">
				<div className="cnl-site-history__details-heading">
					<Button
						className="cnl-site-history__back"
						icon={ chevronLeft }
						size="compact"
						onClick={ onBack }
					>
						{ __( 'Site history' ) }
					</Button>
					<Text
						id="cnl-site-history-title"
						variant="heading-md"
						render={ <h2 /> }
					>
						{ change.label }
					</Text>
					<Text className="cnl-site-history__intro" variant="body-sm">
						{ [
							describeEntry( entry ),
							formatTime( entry.time, now ),
							entry.user?.name,
						]
							.filter( Boolean )
							.join( ' · ' ) }
					</Text>
				</div>
			</div>
			<div className="cnl-site-history__body">
				<ul className="cnl-site-history__details">
					{ change.details.map( ( detail, index ) => (
						<li
							key={ index }
							className={ `cnl-site-history__detail is-${ detail.kind }` }
						>
							<span className="cnl-site-history__detail-label">
								{ detail.label }
							</span>
							<FromTo detail={ detail } />
						</li>
					) ) }
				</ul>
				{ change.more > 0 && (
					<Text className="cnl-site-history__more" variant="body-sm">
						{ sprintf(
							/* translators: %d: Number of details not kept. */
							_n(
								'And %d more change',
								'And %d more changes',
								change.more
							),
							change.more
						) }
					</Text>
				) }
			</div>
		</div>
	);
}

function HistoryPanel( { entries, isShown, onClose, toggleRef } ) {
	const registry = useRegistry();
	const { siteChanges } = useChanges();
	const [ restoringId, setRestoringId ] = useState( null );
	const [ openIds, setOpenIds ] = useState( () => new Set() );
	// The change whose details are showing: `{ entryId, index }`.
	const [ drilled, setDrilled ] = useState( null );
	// Which way the last move went, for the screens' slide.
	const [ direction, setDirection ] = useState( null );
	const [ now ] = useState( Date.now );
	const panelRef = useRef();
	const listScrollRef = useRef( 0 );
	const returnKeyRef = useRef( null );

	// Once it has arrived, so focus doesn't pull the page while it slides.
	useEffect( () => {
		if ( isShown ) {
			panelRef.current?.focus( { preventScroll: true } );
		}
	}, [ isShown ] );

	// A click anywhere else puts it away, as a popover would: it sits over
	// the canvas's own toolbar.
	useEffect( () => {
		const onPointerDown = ( event ) => {
			if (
				! panelRef.current?.contains( event.target ) &&
				! toggleRef.current?.contains( event.target ) &&
				// Snackbars, and dialogs opened from it, aren't elsewhere.
				! event.target.closest?.(
					'.components-snackbar-list, .components-modal__screen-overlay'
				)
			) {
				onClose( { returnFocus: false } );
			}
		};

		document.addEventListener( 'pointerdown', onPointerDown );

		return () =>
			document.removeEventListener( 'pointerdown', onPointerDown );
	}, [ onClose, toggleRef ] );

	// Back on the list: where it was, and on the change that was opened.
	useEffect( () => {
		if ( drilled || ! returnKeyRef.current ) {
			return;
		}

		const body = panelRef.current?.querySelector(
			'.cnl-site-history__body'
		);

		if ( body ) {
			body.scrollTop = listScrollRef.current;
		}

		panelRef.current
			?.querySelector( `[data-change-key="${ returnKeyRef.current }"]` )
			?.focus( { preventScroll: true } );
		returnKeyRef.current = null;
	}, [ drilled ] );

	const toggleEntry = ( id ) =>
		setOpenIds( ( ids ) => {
			const next = new Set( ids );

			if ( next.has( id ) ) {
				next.delete( id );
			} else {
				next.add( id );
			}

			return next;
		} );

	const drill = ( entry, index ) => {
		listScrollRef.current =
			panelRef.current?.querySelector( '.cnl-site-history__body' )
				?.scrollTop || 0;
		returnKeyRef.current = getChangeKey( entry, index );
		setDirection( 'forward' );
		setDrilled( { entryId: entry.id, index } );
	};

	const back = () => {
		setDirection( 'back' );
		setDrilled( null );
	};

	const onRestore = async ( entry ) => {
		setRestoringId( entry.id );

		const { restored, failed } = await restoreEntry(
			entries,
			entries.indexOf( entry ),
			registry
		);
		const { createSuccessNotice, createErrorNotice } =
			registry.dispatch( noticesStore );

		setRestoringId( null );

		if ( ! restored ) {
			createErrorNotice(
				failed
					? RESTORE_FAILED_MESSAGE
					: __(
							'Nothing to put back. The editor already shows this version.'
						),
				{ type: 'snackbar' }
			);
			return;
		}

		createSuccessNotice(
			failed
				? sprintf(
						/* translators: 1: changes put back, 2: changes that couldn't be. */
						__(
							'Put back %1$d changes, but %2$d couldn’t be. Publish site to keep them.'
						),
						restored,
						failed
					)
				: __( 'Version put back. Publish site to keep it.' ),
			{ type: 'snackbar' }
		);
		onClose();
	};

	const drilledEntry =
		drilled && entries.find( ( { id } ) => id === drilled.entryId );
	const drilledChange = drilledEntry?.changes[ drilled.index ];
	let index = 0;

	return (
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes it, as it does a dialog.
		<aside
			ref={ panelRef }
			className={ `cnl-site-history${ isShown ? ' is-shown' : '' }${
				direction ? ` is-moving-${ direction }` : ''
			}` }
			aria-labelledby="cnl-site-history-title"
			// Focused on opening, so a keyboard starts inside it.
			tabIndex={ -1 }
			// Leaving, it can't be used.
			inert={ isShown ? undefined : '' }
			onKeyDown={ ( event ) => {
				// A dialog opened from it is a portal, so its keys bubble
				// here too: they are the dialog's.
				if (
					event.key !== 'Escape' ||
					! panelRef.current?.contains( event.target )
				) {
					return;
				}

				event.stopPropagation();

				// Escape steps back a level before it closes.
				if ( drilledChange ) {
					back();
				} else {
					onClose();
				}
			} }
		>
			{ drilledChange ? (
				<ChangeDetails
					key="details"
					entry={ drilledEntry }
					change={ drilledChange }
					now={ now }
					onBack={ back }
				/>
			) : (
				<div key="list" className="cnl-site-history__screen is-list">
					<div className="cnl-site-history__header">
						<div>
							<Text
								id="cnl-site-history-title"
								variant="heading-md"
								render={ <h2 /> }
							>
								{ __( 'Site history' ) }
							</Text>
							<Text
								className="cnl-site-history__intro"
								variant="body-sm"
							>
								{ __(
									'Restore brings a version back as a change, ready for Publish site.'
								) }
							</Text>
						</div>
						<Button
							icon={ closeIcon }
							label={ __( 'Close' ) }
							size="compact"
							onClick={ () => onClose() }
						/>
					</div>
					<div className="cnl-site-history__body">
						{ groupByDay( entries, now ).map( ( day ) => (
							<section
								key={ day.key }
								className="cnl-site-history__day"
								aria-label={ day.label }
							>
								<Text
									className="cnl-site-history__day-label"
									variant="body-sm"
									render={ <h3 /> }
								>
									{ day.label }
								</Text>
								<ol className="cnl-site-history__list">
									{ day.entries.map( ( entry ) => {
										const entryIndex = index++;

										return (
											<HistoryEntry
												key={ entry.id }
												entry={ entry }
												index={ entryIndex }
												now={ now }
												isLatest={ entryIndex === 0 }
												isBusy={
													restoringId === entry.id
												}
												isDisabled={ !! restoringId }
												replacedCount={ countReplaced(
													planRestore(
														entries,
														entryIndex
													),
													siteChanges
												) }
												onRestore={ onRestore }
												isOpen={ openIds.has(
													entry.id
												) }
												onToggle={ () =>
													toggleEntry( entry.id )
												}
												onDrill={ ( changeIndex ) =>
													drill( entry, changeIndex )
												}
											/>
										);
									} ) }
								</ol>
							</section>
						) ) }
					</div>
				</div>
			) }
		</aside>
	);
}

// Long enough for the panel to leave, as the stylesheet times it.
const LEAVE_MS = 260;

/**
 * Keep something mounted while it animates out. `isShown` follows `isOpen`
 * a frame after mounting, so the first styles are painted and the panel
 * has something to move from.
 *
 * @param {boolean} isOpen Whether it should be open.
 * @return {{isMounted: boolean, isShown: boolean}} Whether to render it, and
 *                                                  whether it is in place.
 */
function usePresence( isOpen ) {
	const [ isMounted, setIsMounted ] = useState( false );
	const [ isShown, setIsShown ] = useState( false );

	useEffect( () => {
		if ( isOpen ) {
			setIsMounted( true );

			const frame = window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () => setIsShown( true ) )
			);

			return () => window.cancelAnimationFrame( frame );
		}

		setIsShown( false );

		const timer = window.setTimeout(
			() => setIsMounted( false ),
			LEAVE_MS
		);

		return () => window.clearTimeout( timer );
	}, [ isOpen ] );

	return { isMounted, isShown };
}

/**
 * The history, loaded once and again whenever a publish is added.
 *
 * @return {?Object[]} The entries, or null until they have loaded.
 */
function useSiteHistory() {
	const [ entries, setEntries ] = useState( null );

	useEffect( () => {
		let isCurrent = true;
		const load = () =>
			getSiteHistory().then(
				( history ) => isCurrent && setEntries( history ),
				// Without it the button stays off, as with no history.
				() => isCurrent && setEntries( [] )
			);

		load();

		const stopListening = onSiteHistoryChanged( load );

		return () => {
			isCurrent = false;
			stopListening();
		};
	}, [] );

	return entries;
}

export function SiteHistory() {
	const [ isOpen, setIsOpen ] = useState( false );
	const toggleRef = useRef();
	const entries = useSiteHistory();
	const { isMounted, isShown } = usePresence( isOpen );
	const hasHistory = !! entries?.length;

	const close = useCallback( ( { returnFocus = true } = {} ) => {
		setIsOpen( false );

		// Not when a click elsewhere closed it: focus follows that click.
		if ( returnFocus ) {
			toggleRef.current?.focus();
		}
	}, [] );

	return (
		<>
			<Button
				ref={ toggleRef }
				className="cnl-site-history__toggle"
				icon={ historyIcon }
				label={
					hasHistory
						? __( 'Site history' )
						: __( 'Site history, once you have published' )
				}
				aria-expanded={ isOpen }
				isPressed={ isOpen }
				disabled={ ! hasHistory }
				accessibleWhenDisabled
				onClick={ () => ( isOpen ? close() : setIsOpen( true ) ) }
			/>
			{ isMounted && hasHistory && (
				<HistoryPanel
					entries={ entries }
					isShown={ isShown }
					onClose={ close }
					toggleRef={ toggleRef }
				/>
			) }
		</>
	);
}
