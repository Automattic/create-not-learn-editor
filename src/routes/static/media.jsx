/**
 * WordPress dependencies
 */
import {
	altTextField,
	authorField,
	dateAddedField,
	filenameField,
	filesizeField,
	mediaDimensionsField,
	mediaThumbnailField,
	mimeTypeField,
} from '@wordpress/media-fields';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getStaticScreen } from './screens';
import { useDataViews } from '../../use-dataviews';
import { EMPTY_ARRAY, getSearchParams } from './list-shared';
import { getErrorMessage } from '../../records';
import { settings } from '../../settings';
import { UploadMediaModal } from '../../upload-media';
import {
	Button,
	coreDataStore,
	decodeEntities,
	DropZone,
	EmptyState,
	imageIcon,
	Page,
	Spinner,
	Tabs,
	__,
	uploadIcon,
	useCallback,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

/*
 * The kinds of media, as tabs. Each value is a `media_type` the REST API
 * filters attachments by; documents are its `application` type.
 */
const MEDIA_TABS = [
	{ label: __( 'All media' ), value: 'all' },
	{ label: __( 'Images' ), value: 'image' },
	{ label: __( 'Videos' ), value: 'video' },
	{ label: __( 'Audio' ), value: 'audio' },
	{ label: __( 'Documents' ), value: 'application' },
];

/*
 * Core's new media modal shows media the same way: square thumbnails, each
 * whole inside its square, and the details in the table.
 */
const DEFAULT_MEDIA_VIEW = {
	fields: [],
	filters: [],
	layout: {
		density: 'compact',
		mediaFit: 'contain',
		previewSize: 170,
	},
	mediaField: 'media_thumbnail',
	page: 1,
	perPage: 40,
	search: '',
	showTitle: true,
	sort: {
		direction: 'desc',
		field: 'date',
	},
	titleField: 'title',
	type: 'grid',
};

const MEDIA_LAYOUTS = {
	grid: {
		layout: {
			density: 'compact',
			mediaFit: 'contain',
			previewSize: 170,
		},
		showTitle: true,
	},
	table: {
		fields: [ 'filename', 'filesize', 'media_dimensions', 'date' ],
		showTitle: true,
	},
};

const DATAVIEWS_CONFIG = {
	perPageSizes: [ 20, 40, 80 ],
	mediaFitControl: true,
};

// Fields from `@wordpress/media-fields`, the ones core's media modal uses.
const MEDIA_FIELDS = [
	{ ...mediaThumbnailField, enableHiding: false },
	{
		enableGlobalSearch: true,
		enableHiding: false,
		getValue: ( { item } ) =>
			decodeEntities( item.title?.raw || item.title?.rendered || '' ) ||
			__( '(no title)' ),
		id: 'title',
		label: __( 'Title' ),
		type: 'text',
	},
	{ ...dateAddedField, filterBy: false },
	{ ...authorField, filterBy: false },
	filenameField,
	filesizeField,
	mediaDimensionsField,
	mimeTypeField,
	altTextField,
];

function getMediaTabFromSearch() {
	const type = getSearchParams().get( 'type' );

	return MEDIA_TABS.some( ( tab ) => tab.value === type ) ? type : 'all';
}

function getMediaQuery( view, tab ) {
	return {
		_embed: 'author',
		media_type: tab === 'all' ? undefined : tab,
		order: view.sort?.direction,
		orderby: view.sort?.field,
		page: view.page || 1,
		per_page: view.perPage || DEFAULT_MEDIA_VIEW.perPage,
		search: view.search || undefined,
		status: 'inherit',
	};
}

/*
 * Gutenberg's media editor when it's on (see `includes/media.php`), or else
 * WordPress's own Edit Media screen, in a new tab, as the rest of wp-admin
 * opens.
 */
function useOpenMedia() {
	const navigate = useNavigate();

	return useCallback(
		( item ) => {
			if ( settings.mediaEditor ) {
				navigate( { to: `/media-editor/${ item.id }` } );
				return;
			}

			window.open(
				`${ settings.adminUrl || '/wp-admin/' }post.php?post=${
					item.id
				}&action=edit`,
				'_blank',
				'noopener'
			);
		},
		[ navigate ]
	);
}

function MediaDataViewsLayout() {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-pattern-list__dataviews">
			<div className="routes-pattern-list__dataviews-toolbar">
				<div className="routes-pattern-list__dataviews-toolbar-start">
					<DataViews.Search label={ __( 'Search media' ) } />
				</div>
				<div className="routes-pattern-list__dataviews-toolbar-end">
					<DataViews.LayoutSwitcher />
					<DataViews.ViewConfig />
				</div>
			</div>
			<div className="routes-pattern-list__dataviews-scroll">
				<DataViews.Layout />
				<DataViews.Pagination />
			</div>
		</div>
	);
}

export function MediaStage() {
	const navigate = useNavigate();
	const dataViews = useDataViews();
	const openMedia = useOpenMedia();
	// The files to upload, or `[]` for an empty modal; `null` when closed.
	const [ uploadFiles, setUploadFiles ] = useState( null );
	const [ view, setView ] = useState( DEFAULT_MEDIA_VIEW );
	const [ activeTab, setActiveTab ] = useState( getMediaTabFromSearch );
	const query = useMemo(
		() => getMediaQuery( view, activeTab ),
		[ activeTab, view ]
	);
	const { canUpload, error, isLoading, media, totalItems, totalPages } =
		useSelect(
			( select ) => {
				const store = select( coreDataStore );
				const args = [ 'postType', 'attachment', query ];
				const resolutionError = store.getResolutionError?.(
					'getEntityRecords',
					args
				);

				return {
					canUpload: store.canUser?.( 'create', {
						kind: 'postType',
						name: 'attachment',
					} ),
					error: resolutionError
						? getErrorMessage( resolutionError )
						: null,
					isLoading: ! store.hasFinishedResolution(
						'getEntityRecords',
						args
					),
					media: store.getEntityRecords( ...args ) || EMPTY_ARRAY,
					totalItems:
						store.getEntityRecordsTotalItems?.( ...args ) || 0,
					totalPages:
						store.getEntityRecordsTotalPages?.( ...args ) || 0,
				};
			},
			[ query ]
		);
	const paginationInfo = useMemo(
		() => ( { totalItems, totalPages } ),
		[ totalItems, totalPages ]
	);
	const actions = useMemo(
		() => [
			{
				callback: ( items ) => openMedia( items[ 0 ] ),
				id: 'edit-media',
				isPrimary: true,
				label: __( 'Edit' ),
				supportsBulk: false,
			},
		],
		[ openMedia ]
	);
	const syncSearch = ( nextView, nextTab ) =>
		navigate( {
			search: {
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
				type: nextTab === 'all' ? undefined : nextTab,
			},
			to: '/media',
		} );
	const selectTab = ( nextTab ) => {
		const nextView = { ...view, page: 1 };

		setActiveTab( nextTab );
		setView( nextView );
		syncSearch( nextView, nextTab );
	};
	const onChangeView = ( nextView ) => {
		setView( nextView );
		syncSearch( nextView, activeTab );
	};
	const canAdd = canUpload !== false;
	const pageActions = canAdd && (
		<Button
			__next40pxDefaultSize
			icon={ uploadIcon }
			onClick={ () => setUploadFiles( [] ) }
			variant="primary"
		>
			{ __( 'Upload' ) }
		</Button>
	);
	const empty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ imageIcon } />
				<EmptyState.Title>
					{ view.search || activeTab !== 'all'
						? __( 'Nothing found' )
						: __( 'No media yet' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ canAdd
						? __(
								'Upload photos, videos, or files, or drop them here.'
							)
						: __(
								'Photos, videos, and files will appear here once they are uploaded.'
							) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);
	const DataViews = dataViews?.DataViews;
	const screen = getStaticScreen();

	return (
		<Page
			actions={ pageActions }
			className="cnl-editor-stage routes-pattern-list routes-media-list"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ screen.description }
			title={ screen.title }
		>
			{ canAdd && (
				<DropZone
					label={ __( 'Drop files to upload them' ) }
					onFilesDrop={ setUploadFiles }
				/>
			) }
			{ uploadFiles && (
				<UploadMediaModal
					initialFiles={ uploadFiles }
					onClose={ () => setUploadFiles( null ) }
				/>
			) }
			<div className="routes-pattern-list__tabs-wrapper">
				<Tabs.Root onValueChange={ selectTab } value={ activeTab }>
					<Tabs.List>
						{ MEDIA_TABS.map( ( tab ) => (
							<Tabs.Tab key={ tab.value } value={ tab.value }>
								{ tab.label }
							</Tabs.Tab>
						) ) }
					</Tabs.List>
				</Tabs.Root>
			</div>
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ DataViews ? (
				<DataViews
					actions={ actions }
					config={ DATAVIEWS_CONFIG }
					data={ media }
					defaultLayouts={ MEDIA_LAYOUTS }
					empty={ empty }
					fields={ MEDIA_FIELDS }
					getItemId={ ( item ) => String( item.id ) }
					isLoading={ isLoading }
					onChangeSelection={ () => {} }
					onChangeView={ onChangeView }
					onClickItem={ openMedia }
					paginationInfo={ paginationInfo }
					selection={ EMPTY_ARRAY }
					view={ view }
				>
					<MediaDataViewsLayout />
				</DataViews>
			) : (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
		</Page>
	);
}
