/**
 * WordPress dependencies
 */
import { useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { getActiveWorkspace } from '../../workspaces/presets';
import { getPostView } from './post-views';
import { TIMELINE_LAYOUT } from './post-timeline';
import { getPostLayouts } from './content-fields';
import { getErrorMessage } from '../../records';
import { EMPTY_ARRAY } from './page-layouts';
import {
	DEFAULT_CONTENT_VIEW,
	getActiveTab,
	isTemplateTab,
	templateMatchesPostType,
} from './helpers';
import { getSystemPageTemplates } from './pages/system-pages';
import {
	coreDataStore,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

// No `content`: nothing shows it, and the server renders it for every record.
export const POST_QUERY_FIELDS =
	'id,author,link,title,status,type,date,modified,date_gmt,modified_gmt,template,slug,parent,comment_count,excerpt,categories,featured_media';

/*
 * Lists by status also ask for each post's links, which say
 * what the user may do with it, as core's trash actions need to know.
 */
export const POST_QUERY_FIELDS_WITH_LINKS = `${ POST_QUERY_FIELDS },_links`;

const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,is_custom',
};

export const LISTED_STATUSES = [
	'publish',
	'draft',
	'pending',
	'private',
	'future',
];

function getPostQuery( search, statuses = LISTED_STATUSES, withLinks ) {
	return {
		context: 'edit',
		per_page: 20,
		search: search || undefined,
		_fields: withLinks ? POST_QUERY_FIELDS_WITH_LINKS : POST_QUERY_FIELDS,
		status: statuses.join( ',' ),
	};
}

/**
 * The status a list is showing, when its workspace lists posts by status.
 *
 * @param {?Object} type Post type.
 * @param {string}  slug The address's view slug.
 * @return {?Object} The tab, from `getPostView`, or null.
 */
function getStatusView( type, slug ) {
	return type?.name === 'post' && getActiveWorkspace().posts.statusFilter
		? getPostView( slug )
		: null;
}

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

/**
 * How a content type is listed to begin with. Posts follow the workspace,
 * which starts them on the timeline unless it says otherwise.
 *
 * @param {?Object} type Post type.
 * @return {Object} `{ fields, type }`, plus `groupBy` and
 *                  `descriptionField` for a list grouped by status.
 */
function getDefaultContentLayout( type ) {
	if ( type?.name === 'page' ) {
		return { fields: [ 'on-site' ], type: 'grid' };
	}

	const posts = getActiveWorkspace().posts;

	if ( type?.name === 'post' && posts.layout === TIMELINE_LAYOUT ) {
		return {
			...getPostLayouts()[ TIMELINE_LAYOUT ],
			type: TIMELINE_LAYOUT,
		};
	}

	if ( type?.name === 'post' && posts.layout === 'list' ) {
		return {
			descriptionField: 'excerpt',
			fields: [ 'date' ],
			type: 'list',
		};
	}

	return { fields: DEFAULT_CONTENT_VIEW.fields, type: 'table' };
}

function getInitialContentView( searchParams, type ) {
	return {
		...DEFAULT_CONTENT_VIEW,
		...getDefaultContentLayout( type ),
		page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
		search: searchParams.search || '',
	};
}

/**
 * What the user may do with each post, as core's post actions read it
 * from the post itself. Core-data learns it from the posts' links, so
 * asking costs nothing more. Kept as a string while selecting, so the
 * posts are only rebuilt when it changes.
 *
 * @param {Object[]} posts Post records, asked for with their links.
 * @param {?Object}  type  Post type, or null when nothing needs to know.
 * @return {Object[]} The posts, each with `permissions`.
 */
export function usePostPermissions( posts, type ) {
	const permissionsKey = useSelect(
		( select ) => {
			if ( ! type ) {
				return '';
			}

			const { canUser } = select( coreDataStore );

			return posts
				.map( ( post ) => {
					const resource = {
						kind: 'postType',
						name: type.name,
						id: post.id,
					};

					return [
						post.id,
						canUser( 'delete', resource ) ? 1 : 0,
						canUser( 'update', resource ) ? 1 : 0,
					].join( ':' );
				} )
				.join( ',' );
		},
		[ posts, type ]
	);
	return useMemo( () => {
		if ( ! permissionsKey ) {
			return posts;
		}

		const permissions = new Map(
			permissionsKey.split( ',' ).map( ( entry ) => {
				const [ id, canDelete, canUpdate ] = entry.split( ':' );

				return [
					id,
					{ delete: canDelete === '1', update: canUpdate === '1' },
				];
			} )
		);

		return posts.map( ( post ) => ( {
			...post,
			permissions: permissions.get( String( post.id ) ),
		} ) );
	}, [ permissionsKey, posts ] );
}

export default function useContentRecords() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const type = getPostType( params.type );
	const statusView = getStatusView( type, params.view );
	const [ contentView, setContentView ] = useState( () =>
		getInitialContentView( searchParams, type )
	);
	const previousTypeNameRef = useRef( type?.name );
	const activeTab = getActiveTab( searchParams );
	// Listed by status, the status buttons pick which, so status is not one
	// of the list's filters too.
	const statuses = statusView ? statusView.statuses : LISTED_STATUSES;
	const statusesKey = statuses.join( ',' );
	const hasStatusFilter = !! statusView;
	const postQuery = useMemo(
		() =>
			getPostQuery(
				contentView.search,
				statusesKey.split( ',' ),
				hasStatusFilter
			),
		[ contentView.search, hasStatusFilter, statusesKey ]
	);

	// Moving to another status starts its list afresh.
	const statusViewSlug = statusView?.slug;
	const previousStatusViewRef = useRef( statusViewSlug );
	useEffect( () => {
		if ( previousStatusViewRef.current === statusViewSlug ) {
			return;
		}

		previousStatusViewRef.current = statusViewSlug;
		setContentView( ( currentView ) => ( { ...currentView, page: 1 } ) );
	}, [ statusViewSlug ] );

	useEffect( () => {
		setContentView( ( currentView ) => ( {
			...currentView,
			page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
			search: searchParams.search || '',
		} ) );
	}, [ searchParams.page, searchParams.search ] );

	useEffect( () => {
		if ( previousTypeNameRef.current === type?.name ) {
			return;
		}

		previousTypeNameRef.current = type?.name;
		setContentView( ( currentView ) => ( {
			...currentView,
			descriptionField: undefined,
			// Only posts' timeline groups and marks them.
			groupBy: undefined,
			mediaField: undefined,
			...getDefaultContentLayout( type ),
		} ) );
	}, [ type ] );

	// Pages lists its pages from `usePages`. Its own records are only wanted
	// for its Layouts, to show a layout on one of them.
	// System pages are shown at the site's address, so need none.
	const needsPosts = type?.name !== 'page' || activeTab === 'templates';
	const listsTemplates = isTemplateTab( activeTab );
	const { error, isLoading, posts, rawTemplates } = useSelect(
		( select ) => {
			if ( ! type ) {
				return {
					error: null,
					isLoading: false,
					posts: EMPTY_ARRAY,
					rawTemplates: EMPTY_ARRAY,
				};
			}

			const store = select( coreDataStore );
			const postArgs = [ 'postType', type.name, postQuery ];
			const templateArgs = [ 'postType', 'wp_template', TEMPLATE_QUERY ];
			const resolvedPosts =
				( needsPosts && store.getEntityRecords( ...postArgs ) ) ||
				EMPTY_ARRAY;
			const resolvedTemplates =
				store.getEntityRecords( ...templateArgs ) || EMPTY_ARRAY;
			const postError =
				needsPosts &&
				store.getResolutionError?.( 'getEntityRecords', postArgs );
			const templateError = store.getResolutionError?.(
				'getEntityRecords',
				templateArgs
			);
			const isResolvingPosts =
				needsPosts && store.isResolving( 'getEntityRecords', postArgs );
			const isResolvingTemplates = store.isResolving(
				'getEntityRecords',
				templateArgs
			);
			const hasResolvedPosts =
				! needsPosts ||
				store.hasFinishedResolution( 'getEntityRecords', postArgs );
			const hasResolvedTemplates = store.hasFinishedResolution(
				'getEntityRecords',
				templateArgs
			);
			const activeError = listsTemplates ? templateError : postError;

			return {
				error: activeError ? getErrorMessage( activeError ) : null,
				isLoading: listsTemplates
					? ! hasResolvedTemplates || isResolvingTemplates
					: ! hasResolvedPosts ||
						! hasResolvedTemplates ||
						isResolvingPosts ||
						isResolvingTemplates,
				posts: resolvedPosts,
				rawTemplates: resolvedTemplates,
			};
		},
		[ activeTab, listsTemplates, needsPosts, postQuery, type ]
	);
	const postsWithPermissions = usePostPermissions(
		posts,
		hasStatusFilter ? type : null
	);
	const requestedTemplateId = getSearchValue( searchParams.postIds );
	const templates = useMemo( () => {
		if ( ! type ) {
			return EMPTY_ARRAY;
		}

		if ( activeTab === 'system' ) {
			return getSystemPageTemplates( rawTemplates );
		}

		return rawTemplates.filter(
			( template ) =>
				templateMatchesPostType( template, type.name ) ||
				// A page's Edit layout opens the layout it uses,
				// even a custom one like Blank.
				( activeTab === 'templates' &&
					String( template.id ) === String( requestedTemplateId ) )
		);
	}, [ activeTab, rawTemplates, requestedTemplateId, type ] );
	const previewTemplates = templates;

	const selectedId =
		getSearchValue( searchParams.postIds ) ||
		searchParams.postId ||
		posts[ 0 ]?.id;
	const selectedTemplateId =
		getSearchValue( searchParams.postIds ) ||
		getSearchValue( searchParams.templateIds ) ||
		searchParams.templateId ||
		templates[ 0 ]?.id;
	const selectedPost = useMemo(
		() =>
			posts.find(
				( post ) => String( post.id ) === String( selectedId )
			),
		[ posts, selectedId ]
	);
	const selectedTemplate = useMemo(
		() =>
			templates.find(
				( template ) =>
					String( template.id ) === String( selectedTemplateId )
			),
		[ selectedTemplateId, templates ]
	);

	return {
		activeTab,
		statusView,
		contentView,
		error,
		isLoading,
		params,
		previewTemplates,
		posts: postsWithPermissions,
		selectedId,
		selectedPost,
		selectedTemplate,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	};
}
