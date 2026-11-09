/**
 * Internal dependencies
 */
import {
	getNavigationRestBase,
	namespace as defaultNamespace,
	settings as appSettings,
} from './settings';
import {
	__,
	addQueryArgs,
	apiFetch,
	createReduxStore,
	register,
	select,
} from './wordpress-packages';

export const STORE_NAME = 'create-not-learn-editor/editor';

const DEFAULT_STATE = {
	navigationMenus: {
		error: null,
		isLoading: false,
		records: [],
	},
	previewContexts: {},
	setupDefaults: {
		error: null,
		isRunning: false,
		result: null,
	},
	siteOverview: {
		error: null,
		isLoading: false,
		record: null,
	},
};

let didConfigureApiFetch = false;

function configureApiFetch() {
	if ( didConfigureApiFetch || ! apiFetch ) {
		return;
	}

	if ( appSettings.nonce && apiFetch.createNonceMiddleware ) {
		apiFetch.use( apiFetch.createNonceMiddleware( appSettings.nonce ) );
	}

	didConfigureApiFetch = true;
}

function request( options ) {
	configureApiFetch();

	return apiFetch( options );
}

/**
 * The layout a page with nothing of its own to edit is made by, like an
 * archive's or the search results', as what Edit changes there.
 *
 * The site answers this itself: asked for a page with `_wp-find-template`,
 * WordPress replies with the template it would render it with, as core's
 * Site Editor once asked when it followed a link (`locate_block_template()`).
 * Only for block themes; anything else, or a failure, leaves the page with
 * nothing to edit, as before.
 *
 * @param {string} url Page URL, as the site has it.
 * @return {Promise<Object>} Preview context to merge in, empty without one.
 */
async function getLayoutContext( url ) {
	try {
		const { data, success } = await apiFetch( {
			url: addQueryArgs( url, { '_wp-find-template': true } ),
		} );

		if ( ! success || ! data?.id ) {
			return {};
		}

		return {
			editPostId: data.id,
			editPostType: 'wp_template',
			previewCanEdit: true,
			previewLabel: data.title || __( 'Layout' ),
			previewStatusLabel: __( 'Changes everywhere it is used' ),
			previewTone: 'global',
			previewType: 'template',
			previewTypeLabel: __( 'Layout' ),
		};
	} catch {
		return {};
	}
}

function requestKey( key ) {
	return String( key || '' );
}

const actions = {
	createAutoDraft( typeName, restNamespace = defaultNamespace ) {
		return () =>
			request( {
				data: {
					type: typeName,
				},
				method: 'POST',
				path: `/${ restNamespace }/auto-drafts`,
			} );
	},

	invalidateNavigationMenus() {
		return ( { dispatch } ) =>
			dispatch.invalidateResolution( 'getNavigationMenus', [] );
	},

	invalidateSiteOverview( restNamespace = defaultNamespace ) {
		return ( { dispatch } ) =>
			dispatch.invalidateResolution( 'getSiteOverview', [
				restNamespace,
			] );
	},

	receiveNavigationMenus( records ) {
		return {
			records,
			type: 'RECEIVE_NAVIGATION_MENUS',
		};
	},

	receiveNavigationMenusError( error ) {
		return {
			error,
			type: 'RECEIVE_NAVIGATION_MENUS_ERROR',
		};
	},

	receivePreviewContext( url, context ) {
		return {
			context,
			type: 'RECEIVE_PREVIEW_CONTEXT',
			url,
		};
	},

	receivePreviewContextError( url, error ) {
		return {
			error,
			type: 'RECEIVE_PREVIEW_CONTEXT_ERROR',
			url,
		};
	},

	receiveSiteOverview( siteOverview ) {
		return {
			siteOverview,
			type: 'RECEIVE_SITE_OVERVIEW',
		};
	},

	receiveSiteOverviewError( error ) {
		return {
			error,
			type: 'RECEIVE_SITE_OVERVIEW_ERROR',
		};
	},

	receiveSetupDefaultsError( error ) {
		return {
			error,
			type: 'RECEIVE_SETUP_DEFAULTS_ERROR',
		};
	},

	receiveSetupDefaultsResult( result ) {
		return {
			result,
			type: 'RECEIVE_SETUP_DEFAULTS_RESULT',
		};
	},

	setupDefaults( restNamespace = defaultNamespace ) {
		return async ( { dispatch } ) => {
			dispatch.startSetupDefaultsRequest();

			try {
				const result = await request( {
					method: 'POST',
					path: `/${ restNamespace }/setup-defaults`,
				} );

				dispatch.receiveSetupDefaultsResult( result );
				return result;
			} catch ( error ) {
				dispatch.receiveSetupDefaultsError( error );
				throw error;
			}
		};
	},

	startNavigationMenusRequest() {
		return {
			type: 'START_NAVIGATION_MENUS_REQUEST',
		};
	},

	startPreviewContextRequest( url ) {
		return {
			type: 'START_PREVIEW_CONTEXT_REQUEST',
			url,
		};
	},

	startSetupDefaultsRequest() {
		return {
			type: 'START_SETUP_DEFAULTS_REQUEST',
		};
	},

	startSiteOverviewRequest() {
		return {
			type: 'START_SITE_OVERVIEW_REQUEST',
		};
	},
};

const selectors = {
	getNavigationMenus( state ) {
		return state.navigationMenus.records;
	},

	getNavigationMenusError( state ) {
		return state.navigationMenus.error;
	},

	getPreviewContext( state, url ) {
		return state.previewContexts[ requestKey( url ) ]?.record || null;
	},

	getPreviewContextError( state, url ) {
		return state.previewContexts[ requestKey( url ) ]?.error || null;
	},

	getSetupDefaultsResult( state ) {
		return state.setupDefaults.result;
	},

	getSiteOverview( state ) {
		return state.siteOverview.record;
	},

	getSiteOverviewError( state ) {
		return state.siteOverview.error;
	},

	isFetchingNavigationMenus( state ) {
		return state.navigationMenus.isLoading;
	},

	isFetchingPreviewContext( state, url ) {
		return Boolean( state.previewContexts[ requestKey( url ) ]?.isLoading );
	},

	isFetchingSiteOverview( state ) {
		return state.siteOverview.isLoading;
	},

	isRunningSetupDefaults( state ) {
		return state.setupDefaults.isRunning;
	},
};

const resolvers = {
	getNavigationMenus:
		() =>
		async ( { dispatch } ) => {
			dispatch.startNavigationMenusRequest();

			try {
				const records = await request( {
					path: addQueryArgs( `/wp/v2/${ getNavigationRestBase() }`, {
						context: 'edit',
						per_page: 20,
						status: 'publish,draft',
						_fields: 'id,slug,title,status,content,modified_gmt',
					} ),
				} );

				dispatch.receiveNavigationMenus( records );
			} catch ( error ) {
				dispatch.receiveNavigationMenusError( error );
				throw error;
			}
		},

	getPreviewContext:
		( url, restNamespace = defaultNamespace ) =>
		async ( { dispatch } ) => {
			dispatch.startPreviewContextRequest( url );

			try {
				let context = await request( {
					path: addQueryArgs( `/${ restNamespace }/preview-context`, {
						url,
					} ),
				} );

				// A page that isn't a post or page of its own is changed by
				// changing its layout.
				if ( context?.previewType === 'preview' && url ) {
					context = {
						...context,
						...( await getLayoutContext( url ) ),
					};
				}

				dispatch.receivePreviewContext( url, context );
			} catch ( error ) {
				dispatch.receivePreviewContextError( url, error );
				throw error;
			}
		},

	getSiteOverview:
		( restNamespace = defaultNamespace ) =>
		async ( { dispatch } ) => {
			dispatch.startSiteOverviewRequest();

			try {
				const siteOverview = await request( {
					path: `/${ restNamespace }/site-overview`,
				} );

				dispatch.receiveSiteOverview( siteOverview );
			} catch ( error ) {
				dispatch.receiveSiteOverviewError( error );
				throw error;
			}
		},
};

function reducer( state = DEFAULT_STATE, action ) {
	switch ( action.type ) {
		case 'RECEIVE_NAVIGATION_MENUS':
			return {
				...state,
				navigationMenus: {
					error: null,
					isLoading: false,
					records: action.records || [],
				},
			};

		case 'RECEIVE_NAVIGATION_MENUS_ERROR':
			return {
				...state,
				navigationMenus: {
					...state.navigationMenus,
					error: action.error,
					isLoading: false,
				},
			};

		case 'RECEIVE_PREVIEW_CONTEXT': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						error: null,
						isLoading: false,
						record: action.context || {},
					},
				},
			};
		}

		case 'RECEIVE_PREVIEW_CONTEXT_ERROR': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						...state.previewContexts[ key ],
						error: action.error,
						isLoading: false,
					},
				},
			};
		}

		case 'RECEIVE_SETUP_DEFAULTS_ERROR':
			return {
				...state,
				setupDefaults: {
					error: action.error,
					isRunning: false,
					result: null,
				},
			};

		case 'RECEIVE_SETUP_DEFAULTS_RESULT':
			return {
				...state,
				setupDefaults: {
					error: null,
					isRunning: false,
					result: action.result || null,
				},
			};

		case 'START_NAVIGATION_MENUS_REQUEST':
			return {
				...state,
				navigationMenus: {
					...state.navigationMenus,
					error: null,
					isLoading: true,
				},
			};

		case 'START_PREVIEW_CONTEXT_REQUEST': {
			const key = requestKey( action.url );
			return {
				...state,
				previewContexts: {
					...state.previewContexts,
					[ key ]: {
						...state.previewContexts[ key ],
						error: null,
						isLoading: true,
					},
				},
			};
		}

		case 'START_SETUP_DEFAULTS_REQUEST':
			return {
				...state,
				setupDefaults: {
					error: null,
					isRunning: true,
					result: null,
				},
			};

		case 'RECEIVE_SITE_OVERVIEW':
			return {
				...state,
				siteOverview: {
					error: null,
					isLoading: false,
					record: action.siteOverview,
				},
			};

		case 'RECEIVE_SITE_OVERVIEW_ERROR':
			return {
				...state,
				siteOverview: {
					...state.siteOverview,
					error: action.error,
					isLoading: false,
				},
			};

		case 'START_SITE_OVERVIEW_REQUEST':
			return {
				...state,
				siteOverview: {
					...state.siteOverview,
					error: null,
					isLoading: true,
				},
			};
	}

	return state;
}

export const cnlEditorStore = createReduxStore( STORE_NAME, {
	actions,
	reducer,
	resolvers,
	selectors,
} );

if ( ! select( STORE_NAME ) ) {
	register( cnlEditorStore );
}

export function getTitleText( title ) {
	const rendered =
		typeof title === 'string' ? title : title?.rendered || title?.raw || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = rendered.replace( /<[^>]+>/g, '' ).trim();
	return element.value || 'Untitled';
}

/**
 * A plain-language name for a template, for people who have not met the
 * template hierarchy.
 *
 * @param {Object} template Template record.
 * @return {string} Display title.
 */
export function getTemplateDisplayTitle( template ) {
	switch ( template?.slug ) {
		case 'home':
			return __( 'Posts Listing' );
		case 'single':
			return __( 'Single Post' );
		case 'index':
			return __( 'Fallback' );
		case 'front-page':
			return __( 'Homepage' );
		case '404':
			return __( 'Page not found' );
	}

	return getTitleText( template?.title );
}

const TEMPLATE_DESCRIPTIONS = {
	404: __( 'What people see when a link is broken or a page is gone.' ),
	archive: __(
		'Lists of posts, such as every post in one category or by one author.'
	),
	attachment: __( 'An image or file shown on a page of its own.' ),
	author: __( 'Lists of posts by one author.' ),
	category: __( 'Lists of posts in one category.' ),
	date: __( 'Lists of posts from one month or year.' ),
	'front-page': __( 'Your homepage.' ),
	home: __( 'Your blog posts, newest first.' ),
	index: __( 'Used for anything that has no layout of its own.' ),
	page: __( 'Your pages, like About or Contact.' ),
	'privacy-policy': __( 'Your privacy policy page.' ),
	search: __( 'What people see after they search your site.' ),
	single: __( 'Each blog post, shown on its own.' ),
	singular: __( 'Each post and page, shown on its own.' ),
	tag: __( 'Lists of posts with one tag.' ),
	taxonomy: __( 'Lists of posts that share a topic.' ),
};

/**
 * A plain-language description of a template. WordPress describes its own
 * templates in template-hierarchy terms, so those get ours. Templates made by
 * the theme or the site keep the description they were given.
 *
 * @param {Object} template Template record.
 * @return {string} Description, or an empty string if there is none.
 */
export function getTemplateDisplayDescription( template ) {
	return (
		TEMPLATE_DESCRIPTIONS[ template?.slug ] || template?.description || ''
	);
}

function getTitleCasedSlug( slug ) {
	return slug
		.replace( /-/g, ' ' )
		.replace( /\b\w/g, ( letter ) => letter.toUpperCase() );
}

export function getTemplateAuthorText( template ) {
	if ( template?.source === 'theme' && appSettings.themeName ) {
		return appSettings.themeName;
	}

	if ( template?.source === 'plugin' && template?.plugin ) {
		return getTitleCasedSlug( template.plugin );
	}

	if ( template?.theme ) {
		return getTitleCasedSlug( template.theme );
	}

	return __( 'Site editor' );
}

export function getNavigationMenuItemCount( menu ) {
	const content = menu?.content?.raw || menu?.content?.rendered || '';
	const blockMatches = content.match( /<!--\s+wp:/g );

	return blockMatches ? blockMatches.length : 0;
}

export function getErrorMessage( error ) {
	return error?.message || __( 'Request failed.' );
}
