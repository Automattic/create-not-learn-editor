/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	coreDataStore,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	buildNavigationLocationsMap,
	createEditedTemplatePartsCache,
	getMainMenu,
	TEMPLATE_PARTS_QUERY,
} from './navigation-locations';
import {
	EMPTY_ARRAY,
	NAVIGATION_MENUS_CHANGED_EVENT,
	getNavigationMenuId,
} from './menu-helpers';

function useNavigationLocations( menus ) {
	// A Navigation block with no menu of its own shows the newest published
	// menu, as core picks it. A draft is never shown.
	const fallbackMenuId = menus.find(
		( menu ) => menu.status === 'publish'
	)?.id;
	const mergeEdits = useMemo( () => createEditedTemplatePartsCache(), [] );
	const { error, isResolving, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const args = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...args ) || EMPTY_ARRAY;

			return {
				error: store.getResolutionError?.( 'getEntityRecords', args ),
				isResolving:
					store.isResolving( 'getEntityRecords', args ) ||
					! store.hasFinishedResolution( 'getEntityRecords', args ),
				templateParts: mergeEdits( rawTemplateParts, ( id ) =>
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
			};
		},
		[ mergeEdits ]
	);
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingLocations: isResolving,
		locationsError: error ? getErrorMessage( error ) : null,
		locationsMap,
		templateParts,
	};
}

export function useNavigationMenus() {
	const searchParams = useSearch( { strict: false } );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { error, isLoading, savedMenus } = useSelect( ( select ) => {
		const store = select( cnlEditorStore );

		return {
			error: store.getNavigationMenusError(),
			isLoading:
				store.isFetchingNavigationMenus() ||
				! store.hasFinishedResolution( 'getNavigationMenus', [] ),
			savedMenus: store.getNavigationMenus() || EMPTY_ARRAY,
		};
	}, [] );
	/*
	 * A live menu's new name waits for Publish site, so the list shows it as
	 * renamed already. Read as one string, so the list only changes when a
	 * name does.
	 */
	const titleEdits = useSelect(
		( select ) =>
			savedMenus
				.map(
					( menu ) =>
						select( coreDataStore ).getEntityRecordEdits(
							'postType',
							'wp_navigation',
							menu.id
						)?.title ?? ''
				)
				.join( '\u0000' ),
		[ savedMenus ]
	);
	const menus = useMemo( () => {
		const titles = titleEdits.split( '\u0000' );

		return savedMenus.map( ( menu, index ) =>
			titles[ index ]
				? {
						...menu,
						title: {
							raw: titles[ index ],
							rendered: titles[ index ],
						},
					}
				: menu
		);
	}, [ savedMenus, titleEdits ] );
	const {
		isResolvingLocations,
		locationsError,
		locationsMap,
		templateParts,
	} = useNavigationLocations( menus );

	useEffect( () => {
		const refreshMenus = () => invalidateNavigationMenus();

		window.addEventListener( NAVIGATION_MENUS_CHANGED_EVENT, refreshMenus );

		return () => {
			window.removeEventListener(
				NAVIGATION_MENUS_CHANGED_EVENT,
				refreshMenus
			);
		};
	}, [ invalidateNavigationMenus ] );

	const selectedId = getNavigationMenuId(
		searchParams.menuId || searchParams.menuIds?.[ 0 ] || menus[ 0 ]?.id
	);
	const selectedMenu = useMemo(
		() =>
			menus.find(
				( menu ) => getNavigationMenuId( menu ) === selectedId
			),
		[ menus, selectedId ]
	);
	// Finding it parses every template part.
	const mainMenuId = useMemo(
		() => getMainMenu( menus, templateParts )?.id,
		[ menus, templateParts ]
	);

	return {
		error: error ? getErrorMessage( error ) : null,
		isLoading,
		isResolvingLocations,
		locationsError,
		mainMenuId,
		locationsMap,
		menus,
		selectedId,
		selectedMenu,
		templateParts,
	};
}
