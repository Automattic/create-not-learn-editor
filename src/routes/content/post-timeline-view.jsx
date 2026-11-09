/**
 * The posts timeline, drawn in place of DataViews' own Activity layout so
 * it can read as a timeline: a date beside every post, a dot whose colour
 * says where the post stands, months that stay in view while scrolling,
 * and a dashed line for what's scheduled above a "Today" marker.
 *
 * It asks for its own posts (see `use-post-timeline.js`): this year's in
 * full, with each earlier year folded into one row that opens to its
 * months. DataViews still provides the search and view options around it,
 * and the view options it shows are honoured here.
 * Type, spacing and status badges come from the design system's `Text`,
 * `Stack` and `Badge`, the same badges the other layouts show.
 */

/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import {
	getCategoryText,
	getExcerptText,
	getStatusIntent,
	usePostAuthors,
	usePostCategories,
	usePostFeaturedImages,
} from './content-fields';
import usePostTimeline, { useYearPosts } from './use-post-timeline';
import { getStatusLabel } from './helpers';
import {
	getTimelineComments,
	getTimelineRows,
	getTimelineTime,
	getTimelineTone,
} from './post-timeline';
import {
	Badge,
	Button,
	chevronDownSmallIcon,
	chevronLeftSmallIcon,
	chevronRightSmallIcon,
	Collapsible,
	Icon,
	isRTL,
	Menu,
	Modal,
	moreVerticalIcon,
	Skeleton,
	Stack,
	Text,
	VisuallyHidden,
	__,
	_n,
	sprintf,
	useMemo,
	useRegistry,
	useState,
} from '../../wordpress-packages';

/*
 * Actions that can't be undone. Their dialog only closes through its own
 * buttons, as the design system's destructive actions pattern asks.
 */
const IRREVERSIBLE_ACTIONS = [ 'permanently-delete' ];

function getActionLabel( action, items ) {
	return typeof action.label === 'function'
		? action.label( items )
		: action.label;
}

function getRowClassName( row, ...classNames ) {
	return [
		'cnl-post-timeline__row',
		...classNames,
		row.isFuture && 'is-future',
		row.isBeforeStart && 'is-before-start',
		row.isStart && 'is-start',
		row.isEnd && 'is-end',
	]
		.filter( Boolean )
		.join( ' ' );
}

/**
 * A post's actions, in a menu, as DataViews offers them in its own
 * layouts. Actions that ask first open their own dialog.
 *
 * @param {Object}   props         Component props.
 * @param {Object[]} props.actions DataViews actions.
 * @param {Object}   props.post    Post record.
 * @return {?Element} The menu, or nothing when no action applies.
 */
function TimelineActions( { actions, post } ) {
	const registry = useRegistry();
	const [ modalAction, setModalAction ] = useState( null );
	const items = useMemo( () => [ post ], [ post ] );
	const eligibleActions = useMemo(
		() =>
			actions.filter(
				( action ) => ! action.isEligible || action.isEligible( post )
			),
		[ actions, post ]
	);

	if ( ! eligibleActions.length ) {
		return null;
	}

	const closeModal = () => setModalAction( null );
	const isIrreversible = IRREVERSIBLE_ACTIONS.includes( modalAction?.id );

	return (
		<>
			<Menu.Root>
				<Menu.Trigger
					render={
						<Button
							className="cnl-post-timeline__actions"
							icon={ moreVerticalIcon }
							label={ __( 'Actions' ) }
							size="compact"
						/>
					}
				/>
				<Menu.Popup positioner={ <Menu.Positioner align="end" /> }>
					<Menu.Group>
						{ eligibleActions.map( ( action ) => (
							<Menu.Item
								disabled={ action.disabled }
								key={ action.id }
								onClick={ () => {
									if ( action.RenderModal ) {
										setModalAction( action );
										return;
									}

									action.callback( items, { registry } );
								} }
							>
								<Menu.ItemLabel>
									{ getActionLabel( action, items ) }
								</Menu.ItemLabel>
							</Menu.Item>
						) ) }
					</Menu.Group>
				</Menu.Popup>
			</Menu.Root>
			{ modalAction && (
				<Modal
					__experimentalHideHeader={ !! modalAction.hideModalHeader }
					focusOnMount={ modalAction.modalFocusOnMount ?? true }
					isDismissible={ ! isIrreversible }
					onRequestClose={ closeModal }
					shouldCloseOnClickOutside={ ! isIrreversible }
					shouldCloseOnEsc={ ! isIrreversible }
					size={ modalAction.modalSize || 'medium' }
					title={
						( typeof modalAction.modalHeader === 'function'
							? modalAction.modalHeader( items )
							: modalAction.modalHeader ) ||
						getActionLabel( modalAction, items )
					}
				>
					<modalAction.RenderModal
						closeModal={ closeModal }
						items={ items }
					/>
				</Modal>
			) }
		</>
	);
}

function TimelinePost( {
	actions,
	authors,
	categories,
	featuredImages,
	onClickItem,
	row,
	view,
} ) {
	const { date, isSameDay, post } = row;
	const fields = view.fields || [];
	const title = getTitleText( post.title ) || __( '(no title)' );
	const excerpt =
		view.showDescription !== false ? getExcerptText( post ) : '';
	const image =
		view.showMedia !== false
			? featuredImages.get( Number( post.featured_media ) )
			: null;
	const authorName = fields.includes( 'author' )
		? authors.get( Number( post.author ) )
		: '';
	const metaItems = [
		authorName &&
			sprintf(
				/* translators: %s: Name of the person who wrote a post. */
				__( 'By %s' ),
				authorName
			),
		fields.includes( 'categories' ) && getCategoryText( post, categories ),
		fields.includes( 'comments' ) && getTimelineComments( post ),
	].filter( Boolean );
	const hasBadge = fields.includes( 'status' ) && post.status !== 'publish';
	const isClickable = post.status !== 'trash';

	return (
		<li
			className={ getRowClassName(
				row,
				'cnl-post-timeline__post',
				`is-${ getTimelineTone( post.status ) }`,
				// The dot takes its colour from the post's badge.
				`has-${ getStatusIntent( post.status ) }-intent`
			) }
		>
			<Stack
				align="flex-end"
				aria-hidden="true"
				className="cnl-post-timeline__when"
				direction="column"
			>
				{ date && ! isSameDay && (
					<>
						<Text
							className="cnl-post-timeline__day"
							variant="heading-xl"
						>
							{ date.getDate() }
						</Text>
						<Text
							className="cnl-post-timeline__weekday"
							variant="heading-sm"
						>
							{ date.toLocaleDateString( undefined, {
								weekday: 'short',
							} ) }
						</Text>
					</>
				) }
			</Stack>
			<div className="cnl-post-timeline__rail" aria-hidden="true">
				<span className="cnl-post-timeline__dot" />
			</div>
			<Stack
				align="flex-start"
				className="cnl-post-timeline__card"
				direction="row"
				gap="md"
			>
				<Stack
					className="cnl-post-timeline__text"
					direction="column"
					gap="xs"
				>
					<Text
						className="cnl-post-timeline__title"
						render={ <h4 /> }
						variant="heading-lg"
					>
						{ isClickable ? (
							<button
								className="cnl-post-timeline__title-button"
								onClick={ () => onClickItem( post ) }
								type="button"
							>
								{ title }
							</button>
						) : (
							title
						) }
					</Text>
					{ excerpt && (
						<Text
							className="cnl-post-timeline__excerpt"
							render={ <p /> }
							variant="body-md"
						>
							{ excerpt }
						</Text>
					) }
					<Stack
						align="center"
						className="cnl-post-timeline__meta"
						direction="row"
						gap="sm"
						wrap="wrap"
					>
						{ hasBadge && (
							<Badge intent={ getStatusIntent( post.status ) }>
								{ getStatusLabel( post.status ) }
							</Badge>
						) }
						{ fields.includes( 'date' ) && (
							<Text
								className="cnl-post-timeline__meta-item"
								variant="body-sm"
							>
								{ date && (
									<VisuallyHidden render={ <span /> }>
										{ `${ date.toLocaleDateString(
											undefined,
											{
												day: 'numeric',
												month: 'long',
												weekday: 'long',
												year: 'numeric',
											}
										) }, ` }
									</VisuallyHidden>
								) }
								{ getTimelineTime( post, date ) }
							</Text>
						) }
						{ metaItems.map( ( item ) => (
							<Text
								className="cnl-post-timeline__meta-item"
								key={ item }
								variant="body-sm"
							>
								{ item }
							</Text>
						) ) }
					</Stack>
				</Stack>
				{ image && (
					<img
						alt=""
						className="cnl-post-timeline__image"
						src={ image.url }
					/>
				) }
				<TimelineActions actions={ actions } post={ post } />
			</Stack>
		</li>
	);
}

/**
 * Who wrote the given posts, what they're filed in and their images, as
 * the timeline shows them.
 *
 * @param {Object[]} posts Post records.
 * @return {Object} `{ authors, categories, featuredImages }`.
 */
function useTimelineDetails( posts ) {
	const authors = usePostAuthors( posts );
	const categories = usePostCategories( posts );
	const featuredImages = usePostFeaturedImages( posts );

	return useMemo(
		() => ( { authors, categories, featuredImages } ),
		[ authors, categories, featuredImages ]
	);
}

/**
 * Placeholder rows, in the timeline's own shape, while posts load.
 *
 * @param {Object}  props          Component props.
 * @param {boolean} props.isNested Whether they stand in for an opened
 *                                 year's posts, inside the timeline.
 * @return {Element} The placeholder.
 */
function TimelineSkeleton( { isNested = false } ) {
	return (
		<ol
			aria-busy="true"
			className={
				isNested ? 'cnl-post-timeline__nested' : 'cnl-post-timeline'
			}
		>
			{ [ 0, 1, 2 ].map( ( index ) => (
				<li
					className={ [
						'cnl-post-timeline__row',
						'cnl-post-timeline__post',
						'is-skeleton',
						index === 0 && 'is-start',
						index === 2 && 'is-end',
					]
						.filter( Boolean )
						.join( ' ' ) }
					key={ index }
				>
					<Stack
						align="flex-end"
						className="cnl-post-timeline__when"
						direction="column"
					>
						<Skeleton className="cnl-post-timeline__skeleton-day" />
					</Stack>
					<div className="cnl-post-timeline__rail">
						<span className="cnl-post-timeline__dot" />
					</div>
					<Stack
						className="cnl-post-timeline__card"
						direction="column"
						gap="sm"
					>
						<Skeleton className="cnl-post-timeline__skeleton-title" />
						<Skeleton className="cnl-post-timeline__skeleton-line" />
					</Stack>
				</li>
			) ) }
		</ol>
	);
}

/**
 * The rows of one stretch of the timeline: months, today and posts.
 *
 * @param {Object}   props         Component props.
 * @param {Object[]} props.rows    From `getTimelineRows`.
 * @param {Object}   props.details From `useTimelineDetails`.
 * @param {Object}   props.shared  What every post needs: `actions`,
 *                                 `onClickItem` and `view`.
 * @return {Element[]} The rows.
 */
function TimelineRows( { rows, details, shared } ) {
	return rows.map( ( row ) => {
		if ( row.type === 'month' ) {
			return (
				<li
					className={ getRowClassName(
						row,
						'cnl-post-timeline__month'
					) }
					key={ row.key }
				>
					<div
						className="cnl-post-timeline__rail"
						aria-hidden="true"
					/>
					<Text
						className="cnl-post-timeline__month-label"
						render={ <h3 /> }
						variant="heading-sm"
					>
						{ row.label }
					</Text>
				</li>
			);
		}

		if ( row.type === 'today' ) {
			return (
				<li
					className={ getRowClassName(
						row,
						'cnl-post-timeline__today'
					) }
					key={ row.key }
				>
					<Stack
						align="flex-end"
						className="cnl-post-timeline__when"
						direction="column"
					>
						<Text variant="heading-sm">{ __( 'Today' ) }</Text>
					</Stack>
					<div className="cnl-post-timeline__rail" aria-hidden="true">
						<span className="cnl-post-timeline__dot" />
					</div>
					<Stack
						align="center"
						className="cnl-post-timeline__today-date"
						direction="row"
						gap="md"
					>
						<Text variant="body-sm">
							{ row.date.toLocaleDateString( undefined, {
								day: 'numeric',
								month: 'long',
								weekday: 'long',
							} ) }
						</Text>
					</Stack>
				</li>
			);
		}

		return (
			<TimelinePost
				{ ...shared }
				{ ...details }
				key={ row.key }
				row={ row }
			/>
		);
	} );
}

/**
 * An earlier year, folded into one row that says how many posts it has,
 * and opens to them.
 *
 * @param {Object} props        Component props.
 * @param {number} props.year   The year.
 * @param {number} props.count  How many posts it has.
 * @param {Object} props.source `{ type, statuses, withLinks }`.
 * @param {Object} props.shared What every post needs.
 * @return {Element} The year.
 */
function TimelineYear( { year, count, source, shared } ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const { posts, isLoading } = useYearPosts( { ...source, isOpen, year } );
	const details = useTimelineDetails( posts );
	// Its months say their year, so one in view still says which it is.
	const rows = useMemo(
		() => getTimelineRows( posts, { showToday: false } ),
		[ posts ]
	);
	let closedIcon = chevronRightSmallIcon;

	if ( isRTL() ) {
		closedIcon = chevronLeftSmallIcon;
	}

	return (
		<li className="cnl-post-timeline__year">
			<Collapsible.Root onOpenChange={ setIsOpen } open={ isOpen }>
				<Collapsible.Trigger className="cnl-post-timeline__row cnl-post-timeline__year-trigger">
					<Stack
						align="flex-end"
						className="cnl-post-timeline__when"
						direction="column"
					>
						<Text variant="heading-lg">{ year }</Text>
					</Stack>
					<span className="cnl-post-timeline__rail">
						<Icon
							className="cnl-post-timeline__year-icon"
							icon={ isOpen ? chevronDownSmallIcon : closedIcon }
						/>
					</span>
					<Text
						className="cnl-post-timeline__year-count"
						variant="body-sm"
					>
						{ sprintf(
							/* translators: %d: Number of posts in a year. */
							_n( '%d post', '%d posts', count ),
							count
						) }
					</Text>
				</Collapsible.Trigger>
				<Collapsible.Panel>
					{ isLoading && ! posts.length ? (
						<TimelineSkeleton isNested />
					) : (
						<ol className="cnl-post-timeline__nested">
							<TimelineRows
								details={ details }
								rows={ rows }
								shared={ shared }
							/>
						</ol>
					) }
				</Collapsible.Panel>
			</Collapsible.Root>
		</li>
	);
}

/**
 * @param {Object}                 props             Component props.
 * @param {Object[]}               props.actions     DataViews actions.
 * @param {Element}                props.empty       What an empty list says.
 * @param {(post: Object) => void} props.onClickItem Opens a post.
 * @param {string}                 props.search      What the list is searched for.
 * @param {string[]}               props.statuses    Statuses listed.
 * @param {?Object}                props.type        Post type.
 * @param {Object}                 props.view        The DataViews view.
 * @param {boolean}                props.withLinks   Whether posts need their
 *                                                   links, for the trash actions.
 * @return {Element} The timeline.
 */
export default function PostTimeline( {
	actions,
	empty,
	onClickItem,
	search,
	statuses,
	type,
	view,
	withLinks,
} ) {
	const { posts, years, isLoading } = usePostTimeline( {
		search,
		statuses,
		type,
		withLinks,
	} );
	const details = useTimelineDetails( posts );
	const rows = useMemo(
		() =>
			getTimelineRows( posts, {
				alwaysToday: years.length > 0,
			} ),
		[ posts, years.length ]
	);
	const source = useMemo(
		() => ( { statuses, type, withLinks } ),
		[ statuses, type, withLinks ]
	);
	const shared = useMemo(
		() => ( { actions, onClickItem, view } ),
		[ actions, onClickItem, view ]
	);

	if ( ! posts.length && ! years.length ) {
		return isLoading ? (
			<TimelineSkeleton />
		) : (
			<div className="dataviews-no-results">{ empty }</div>
		);
	}

	return (
		<ol
			className={ [
				'cnl-post-timeline',
				`is-${ view.layout?.density || 'balanced' }`,
			].join( ' ' ) }
		>
			<TimelineRows details={ details } rows={ rows } shared={ shared } />
			{ years.map( ( { year, count } ) => (
				<TimelineYear
					count={ count }
					key={ year }
					shared={ shared }
					source={ source }
					year={ year }
				/>
			) ) }
		</ol>
	);
}
