/**
 * The fields, layouts and actions a DataViews list of content shows.
 */
import {
	DEFAULT_CONTENT_LAYOUTS,
	getContentActions,
	getContentFields,
	getPostLayouts,
	usePostAuthors,
	usePostCategories,
} from './content-fields';
import { EMPTY_ARRAY } from './page-layouts';
import useCoreTrashActions from './use-core-trash-actions';
import { coreDataStore, useMemo, useSelect } from '../../wordpress-packages';

/**
 * Builds a content list's DataViews config.
 *
 * @param {Object}   options            Options.
 * @param {Array}    options.menuPages  Pages in the main menu.
 * @param {Function} options.navigate   The router's navigate.
 * @param {Array}    options.posts      The listed posts.
 * @param {Object}   options.statusView The status the list is filtered by.
 * @param {Object}   options.type       The post type.
 * @return {Object} Fields, layouts and actions, and the site's front and posts pages.
 */
export default function useContentList( {
	menuPages,
	navigate,
	posts,
	statusView,
	type,
} ) {
	const { frontPageId, postsPageId } = useSelect( ( select ) => {
		const site = select( coreDataStore ).getEditedEntityRecord(
			'root',
			'site'
		);

		return {
			frontPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_on_front ) || 0
					: 0,
			postsPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_for_posts ) || 0
					: 0,
		};
	}, [] );
	const isPages = type?.name === 'page';
	const isPosts = type?.name === 'post';
	// Lists by status move posts to and from the trash with core's own
	// actions.
	const trashActions = useCoreTrashActions( statusView ? type?.name : null );
	const authors = usePostAuthors( isPages ? EMPTY_ARRAY : posts );
	const categories = usePostCategories( isPosts ? posts : EMPTY_ARRAY );
	const contentFields = useMemo(
		() =>
			getContentFields(
				{
					frontPageId,
					isListedByStatus: !! statusView,
					isPages,
					isPosts,
					menuPages,
					postsPageId,
				},
				authors,
				{ categories }
			),
		[
			authors,
			categories,
			frontPageId,
			isPages,
			isPosts,
			menuPages,
			postsPageId,
			statusView,
		]
	);
	// Posts can also be shown as a timeline, which says who wrote each
	// only when more than one person did.
	const hasManyAuthors = authors.size > 1;
	const contentLayouts = useMemo(
		() =>
			isPosts
				? getPostLayouts( { hasManyAuthors } )
				: DEFAULT_CONTENT_LAYOUTS,
		[ hasManyAuthors, isPosts ]
	);

	const contentActions = useMemo( () => {
		if ( ! type ) {
			return [];
		}

		const actions = getContentActions( navigate, type );

		if ( ! statusView ) {
			return actions;
		}

		// A post in the trash can only be restored or deleted for good.
		return [
			...actions.map( ( action ) => ( {
				...action,
				isEligible: ( item ) =>
					item.status !== 'trash' &&
					( action.isEligible?.( item ) ?? true ),
			} ) ),
			...trashActions,
		];
	}, [ navigate, statusView, trashActions, type ] );

	return {
		contentActions,
		contentFields,
		contentLayouts,
		frontPageId,
		postsPageId,
	};
}
