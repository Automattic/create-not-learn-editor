/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { isPageInMenu } from './menu-status';
import { DEFAULT_CONTENT_VIEW, getStatusLabel } from './helpers';
import { TIMELINE_LAYOUT } from './post-timeline';
import { useDataViews } from '../../use-dataviews';
import {
	Badge,
	coreDataStore,
	decodeEntities,
	Stack,
	__,
	sprintf,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const NO_AUTHORS = new Map();
const NO_CATEGORIES = { defaultId: 0, names: new Map() };
const NO_IMAGES = new Map();

export const DEFAULT_CONTENT_LAYOUTS = {
	list: true,
	table: {
		layout: {
			styles: {
				author: {
					align: 'start',
				},
			},
		},
	},
};

/**
 * The layouts a list of posts can switch between. Each says which fields
 * it shows, so the timeline's month groups and markers don't follow the
 * list into a table.
 *
 * @param {Object}  options                Options.
 * @param {boolean} options.hasManyAuthors Whether more than one person
 *                                         wrote the posts, so the
 *                                         timeline says who wrote each.
 * @return {Object} DataViews' `defaultLayouts`.
 */
export function getPostLayouts( { hasManyAuthors = false } = {} ) {
	const plain = {
		groupBy: undefined,
		mediaField: undefined,
	};

	return {
		list: {
			...plain,
			descriptionField: 'excerpt',
			fields: [ 'date' ],
		},
		table: {
			...DEFAULT_CONTENT_LAYOUTS.table,
			...plain,
			descriptionField: undefined,
			fields: DEFAULT_CONTENT_VIEW.fields,
		},
		[ TIMELINE_LAYOUT ]: {
			descriptionField: 'excerpt',
			fields: [
				'status',
				'date',
				hasManyAuthors && 'author',
				'categories',
				'comments',
			].filter( Boolean ),
			groupBy: undefined,
			layout: { density: 'balanced' },
			mediaField: 'featured-image',
		},
	};
}

const STATUS_OPTIONS = [
	{ label: __( 'Published' ), value: 'publish' },
	{ label: __( 'Draft' ), value: 'draft' },
	{ label: __( 'Scheduled' ), value: 'future' },
	{ label: __( 'Pending review' ), value: 'pending' },
	{ label: __( 'Private' ), value: 'private' },
	{ label: __( 'Trash' ), value: 'trash' },
];

function getDateLabel( post ) {
	const date = post?.date || post?.modified;

	if ( ! date ) {
		return __( 'No date' );
	}

	const prefix =
		post.status === 'publish' ? __( 'Published' ) : __( 'Modified' );
	const formatted = new Date( date ).toLocaleString( undefined, {
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		month: 'short',
		year: 'numeric',
	} );

	return sprintf(
		/* translators: 1: date prefix, 2: formatted date. */
		__( '%1$s: %2$s' ),
		prefix,
		formatted
	);
}

/**
 * The intent of the badge a post's status shows in a list.
 *
 * @param {string} status Post status.
 * @return {string} A `Badge` intent.
 */
export function getStatusIntent( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
		case 'pending':
			return 'draft';
		case 'future':
		case 'private':
			return 'informational';
		default:
			return 'none';
	}
}

function renderSiteRoleBadges( item, siteRoles ) {
	const badges = [];

	if ( item.status !== 'publish' ) {
		badges.push( {
			intent: getStatusIntent( item.status ),
			label: getStatusLabel( item.status ),
		} );
	}

	if ( Number( item.id ) === siteRoles.frontPageId ) {
		badges.push( { intent: 'informational', label: __( 'Homepage' ) } );
	}

	if ( Number( item.id ) === siteRoles.postsPageId ) {
		badges.push( { intent: 'informational', label: __( 'Blog' ) } );
	}

	if ( siteRoles.menuPages ) {
		badges.push(
			isPageInMenu( item, siteRoles.menuPages )
				? { intent: 'stable', label: __( 'In menu' ) }
				: { intent: 'none', label: __( 'Not in menu' ) }
		);
	}

	return (
		<Stack className="routes-post-list__badges" gap="xs" wrap="wrap">
			{ badges.map( ( badge ) => (
				<Badge intent={ badge.intent } key={ badge.label }>
					{ badge.label }
				</Badge>
			) ) }
		</Stack>
	);
}

/**
 * The names of the people who wrote the given posts.
 *
 * @param {Object[]} posts Post records.
 * @return {Map<number, string>} Author names keyed by user ID.
 */
export function usePostAuthors( posts ) {
	const authorIds = useMemo(
		() =>
			[
				...new Set(
					posts
						.map( ( post ) => Number( post.author ) )
						.filter( ( id ) => id > 0 )
				),
			].sort( ( first, second ) => first - second ),
		[ posts ]
	);
	const authorIdsKey = authorIds.join( ',' );
	const users = useSelect(
		( select ) =>
			authorIdsKey
				? select( coreDataStore ).getEntityRecords( 'root', 'user', {
						_fields: 'id,name',
						context: 'view',
						include: authorIdsKey,
						per_page: 100,
					} )
				: null,
		[ authorIdsKey ]
	);

	return useMemo(
		() =>
			users
				? new Map( users.map( ( user ) => [ user.id, user.name ] ) )
				: NO_AUTHORS,
		[ users ]
	);
}

/**
 * The names of the categories the given posts are in, and the site's
 * default category, which the timeline leaves unsaid.
 *
 * @param {Object[]} posts Post records.
 * @return {Object} `{ defaultId, names }`, names keyed by term ID.
 */
export function usePostCategories( posts ) {
	const categoryIds = useMemo(
		() =>
			[
				...new Set(
					posts.flatMap( ( post ) =>
						Array.isArray( post.categories )
							? post.categories.map( Number )
							: []
					)
				),
			]
				.filter( ( id ) => id > 0 )
				.sort( ( first, second ) => first - second ),
		[ posts ]
	);
	const categoryIdsKey = categoryIds.join( ',' );
	const { defaultId, terms } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				defaultId:
					Number(
						store.getEntityRecord( 'root', 'site' )
							?.default_category
					) || 0,
				terms: categoryIdsKey
					? store.getEntityRecords( 'taxonomy', 'category', {
							_fields: 'id,name',
							context: 'view',
							include: categoryIdsKey,
							per_page: 100,
						} )
					: null,
			};
		},
		[ categoryIdsKey ]
	);

	return useMemo(
		() =>
			terms
				? {
						defaultId,
						names: new Map(
							terms.map( ( term ) => [
								term.id,
								decodeEntities( term.name ),
							] )
						),
					}
				: { ...NO_CATEGORIES, defaultId },
		[ defaultId, terms ]
	);
}

/**
 * The featured images of the given posts, small enough for a list.
 *
 * @param {Object[]} posts Post records.
 * @return {Map<number, Object>} `{ alt, url }` keyed by attachment ID.
 */
export function usePostFeaturedImages( posts ) {
	const mediaIdsKey = useMemo(
		() =>
			[
				...new Set(
					posts
						.map( ( post ) => Number( post.featured_media ) )
						.filter( ( id ) => id > 0 )
				),
			]
				.sort( ( first, second ) => first - second )
				.join( ',' ),
		[ posts ]
	);
	const media = useSelect(
		( select ) =>
			mediaIdsKey
				? select( coreDataStore ).getEntityRecords(
						'postType',
						'attachment',
						{
							_fields: 'id,alt_text,source_url,media_details',
							context: 'view',
							include: mediaIdsKey,
							per_page: 100,
						}
					)
				: null,
		[ mediaIdsKey ]
	);

	return useMemo(
		() =>
			media
				? new Map(
						media.map( ( attachment ) => {
							const sizes = attachment.media_details?.sizes || {};

							return [
								attachment.id,
								{
									alt: attachment.alt_text || '',
									url:
										sizes.thumbnail?.source_url ||
										sizes.medium?.source_url ||
										attachment.source_url,
								},
							];
						} )
					)
				: NO_IMAGES,
		[ media ]
	);
}

/**
 * The categories a post is filed in, by name, leaving out the site's
 * default category when it's the only one.
 *
 * @param {Object} item       Post record.
 * @param {Object} categories From `usePostCategories`.
 * @return {string} Like "News, Plant care", or "".
 */
export function getCategoryText( item, categories ) {
	const ids = Array.isArray( item.categories )
		? item.categories.map( Number )
		: [];

	// Only in the default category is as good as not filed anywhere.
	if ( ids.length === 1 && ids[ 0 ] === categories.defaultId ) {
		return '';
	}

	return ids
		.map( ( id ) => categories.names.get( id ) )
		.filter( Boolean )
		.join( ', ' );
}

export function getExcerptText( item ) {
	const rendered = item?.excerpt?.rendered || '';

	return decodeEntities( rendered.replace( /<[^>]+>/g, '' ) ).trim();
}

function getAuthorName( item, authors ) {
	const authorId = Number( item.author );

	if ( ! authorId ) {
		return __( 'No author' );
	}

	return authors.get( authorId ) || '';
}

/**
 * @param {Object} siteRoles              What the listed records are to the
 *                                        site, and how they're listed.
 * @param {Map}    authors                From `usePostAuthors`.
 * @param {Object} options                Options.
 * @param {Object} options.categories     From `usePostCategories`.
 * @param {Map}    options.featuredImages From `usePostFeaturedImages`.
 * @return {Object[]} DataViews fields.
 */
export function getContentFields(
	siteRoles = {},
	authors = NO_AUTHORS,
	{ categories = NO_CATEGORIES, featuredImages = NO_IMAGES } = {}
) {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getTitleText( item.title ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-title">
					{ getTitleText( item.title ) }
				</span>
			),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getAuthorName( item, authors ),
			id: 'author',
			label: __( 'Author' ),
			type: 'text',
		},
		{
			elements: STATUS_OPTIONS,
			enableSorting: false,
			// Listed by status, buttons above the list pick the status.
			filterBy: siteRoles.isListedByStatus
				? false
				: {
						operators: [ 'isAny' ],
					},
			getValue: ( { item } ) => getStatusLabel( item.status ),
			id: 'status',
			label: __( 'Status' ),
			render: ( { item } ) =>
				item.status === 'publish' ? (
					getStatusLabel( item.status )
				) : (
					<Badge intent={ getStatusIntent( item.status ) }>
						{ getStatusLabel( item.status ) }
					</Badge>
				),
			type: 'text',
		},
		siteRoles.isPages && {
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				isPageInMenu( item, siteRoles.menuPages )
					? __( 'In menu' )
					: __( 'Not in menu' ),
			id: 'on-site',
			label: __( 'Details' ),
			render: ( { item } ) => renderSiteRoleBadges( item, siteRoles ),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => Number( item.comment_count ) || 0,
			id: 'comments',
			label: __( 'Comments' ),
			render: ( { item } ) => Number( item.comment_count ) || 0,
			type: 'integer',
		},
		siteRoles.isPosts && {
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getCategoryText( item, categories ),
			id: 'categories',
			label: __( 'Categories' ),
			type: 'text',
		},
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getExcerptText( item ),
			id: 'excerpt',
			label: __( 'Excerpt' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-excerpt">
					{ getExcerptText( item ) }
				</span>
			),
			type: 'text',
		},
		{
			getValue: ( { item } ) => item.date || item.modified || '',
			id: 'date',
			label: __( 'Date' ),
			render: ( { item } ) => getDateLabel( item ),
			type: 'datetime',
		},
		siteRoles.isPosts && {
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => Number( item.featured_media ) || 0,
			id: 'featured-image',
			label: __( 'Featured image' ),
			render: ( { item } ) => {
				const image = featuredImages.get(
					Number( item.featured_media )
				);

				return image ? (
					<img alt={ image.alt } src={ image.url } />
				) : null;
			},
			type: 'media',
		},
	].filter( Boolean );
}

export function getContentActions( navigate, type ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.id ) {
					navigate( {
						to: `/types/${ type.name }/edit/${ item.id }`,
					} );
				}
			},
			id: 'edit',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.link ) {
					window.open( item.link, '_blank', 'noopener,noreferrer' );
				}
			},
			id: 'open-preview',
			isEligible: ( item ) => !! item.link,
			label: __( 'Open preview' ),
			supportsBulk: false,
		},
	];
}

/**
 * @param {Object}   props        Component props.
 * @param {?Element} props.layout A layout of the screen's own, drawn in
 *                                place of DataViews' own for the view.
 * @return {Element} The list, with its search, options and pages.
 */
export function PostListDataViewsLayout( { layout = null } ) {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-post-list__dataviews">
			<div className="routes-post-list__dataviews-toolbar">
				<div className="routes-post-list__dataviews-toolbar-start">
					<DataViews.Search label={ __( 'Search content' ) } />
					<DataViews.FiltersToggle />
				</div>
				<div className="routes-post-list__dataviews-toolbar-end">
					<DataViews.ViewConfig />
					<DataViews.LayoutSwitcher />
				</div>
			</div>
			<DataViews.FiltersToggled className="routes-post-list__dataviews-filters" />
			<div className="routes-post-list__dataviews-scroll">
				{ layout || <DataViews.Layout /> }
				<DataViews.Pagination />
			</div>
		</div>
	);
}
