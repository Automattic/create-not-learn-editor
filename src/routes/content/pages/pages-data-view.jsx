/**
 * The Pages screen's list while the main menu is set by hand: a plain
 * DataViews list of pages, so it doesn't look like the menu it no longer
 * changes. The tree, with its switches, is for an auto menu (`pages-list-view.jsx`).
 */

/**
 * Internal dependencies
 */
import { getContentFields } from '../content-fields';
import { DEFAULT_CONTENT_VIEW, getStatusLabel } from '../helpers';
import { HOMEPAGE } from './homepage-state';
import { useDataViews } from '../../../use-dataviews';
import {
	__,
	draftsIcon,
	Icon,
	lockIcon,
	pendingIcon,
	publishedIcon,
	scheduledIcon,
	Spinner,
	sprintf,
	useMemo,
	useState,
} from '../../../wordpress-packages';

const EMPTY_ARRAY = [];
const NO_DATA = { data: EMPTY_ARRAY, paginationInfo: {} };
const DEFAULT_LAYOUTS = { list: {} };
const DEFAULT_VIEW = {
	...DEFAULT_CONTENT_VIEW,
	fields: [ 'status' ],
	sort: { direction: 'asc', field: 'title' },
	type: 'list',
};

// The icons the Posts screen's status tabs use, by status.
const STATUS_ICONS = {
	'auto-draft': draftsIcon,
	draft: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: lockIcon,
	publish: publishedIcon,
};

const STATUSES = [ 'publish', 'draft', 'future', 'pending', 'private' ];

/**
 * A page's status as its icon and word, with what it is on the site, when
 * it is the homepage or the blog.
 *
 * @param {Object} props             Component props.
 * @param {Object} props.item        Page record.
 * @param {number} props.frontPageId The page the homepage shows.
 * @param {number} props.postsPageId The page that lists posts.
 * @return {Element} The status.
 */
function PageStatus( { item, frontPageId, postsPageId } ) {
	const id = Number( item.id );
	let text = getStatusLabel( item.status );

	if ( id && id === frontPageId ) {
		/* translators: %s: page status, like Published. */
		text = sprintf( __( '%s · Homepage' ), text );
	} else if ( id && id === postsPageId ) {
		/* translators: %s: page status, like Published. */
		text = sprintf( __( '%s · Blog' ), text );
	}

	return (
		<span className="cnl-pages-data-view__status">
			{ STATUS_ICONS[ item.status ] && (
				<Icon icon={ STATUS_ICONS[ item.status ] } size={ 16 } />
			) }
			{ text }
		</span>
	);
}

/**
 * Every page in a DataViews list. Picking one opens its details, with it on
 * the canvas.
 *
 * @param {Object}        props             Component props.
 * @param {number}        props.frontPageId The page the homepage shows.
 * @param {boolean}       props.isLoading   Whether pages are still loading.
 * @param {Function}      props.onDelete    Asks to move a page to the Trash.
 * @param {Function}      props.onOpen      Opens a page's details, given its
 *                                          ID, or `HOMEPAGE`.
 * @param {Object[]}      props.pages       Every page.
 * @param {number}        props.postsPageId The page that lists posts.
 * @param {number|string} props.previewedId The page on show, or `HOMEPAGE`.
 * @return {Element} The list.
 */
export default function PagesDataView( {
	frontPageId,
	isLoading,
	onDelete,
	onOpen,
	pages,
	postsPageId,
	previewedId,
} ) {
	const dataViews = useDataViews();
	const [ view, setView ] = useState( DEFAULT_VIEW );
	// The title as the other lists show it, and the status in words with its
	// icon rather than a badge. Whether a page is in the menu is the Menus
	// screen's to say.
	const fields = useMemo(
		() => [
			getContentFields( { isPages: true } ).find(
				( field ) => field.id === 'title'
			),
			{
				elements: STATUSES.map( ( status ) => ( {
					label: getStatusLabel( status ),
					value: status,
				} ) ),
				enableSorting: false,
				filterBy: { operators: [ 'isAny' ] },
				getValue: ( { item } ) => item.status,
				id: 'status',
				label: __( 'Status' ),
				render: ( { item } ) => (
					<PageStatus
						frontPageId={ frontPageId }
						item={ item }
						postsPageId={ postsPageId }
					/>
				),
				type: 'text',
			},
		],
		[ frontPageId, postsPageId ]
	);
	const actions = useMemo(
		() => [
			{
				callback: ( [ item ] ) => item && onDelete( Number( item.id ) ),
				id: 'move-to-trash',
				isDestructive: true,
				// The homepage needs another before it can go.
				isEligible: ( item ) => Number( item.id ) !== frontPageId,
				label: __( 'Move to Trash' ),
				supportsBulk: false,
			},
		],
		[ frontPageId, onDelete ]
	);
	const { data, paginationInfo } = useMemo(
		() =>
			dataViews
				? dataViews.filterSortAndPaginate( pages, view, fields )
				: NO_DATA,
		[ dataViews, fields, pages, view ]
	);
	const selectedId =
		previewedId === HOMEPAGE ? frontPageId : Number( previewedId );
	const selection = useMemo(
		() => ( selectedId ? [ String( selectedId ) ] : EMPTY_ARRAY ),
		[ selectedId ]
	);

	if ( ! dataViews ) {
		return (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	const { DataViews } = dataViews;

	return (
		<div className="cnl-pages-data-view">
			<DataViews
				actions={ actions }
				data={ data }
				defaultLayouts={ DEFAULT_LAYOUTS }
				fields={ fields }
				getItemId={ ( item ) => String( item.id ) }
				isLoading={ isLoading && ! pages.length }
				onChangeSelection={ ( ids ) => {
					const id = Number( ids[ 0 ] );

					if ( id ) {
						onOpen( id === frontPageId ? HOMEPAGE : id );
					}
				} }
				onChangeView={ setView }
				paginationInfo={ paginationInfo }
				selection={ selection }
				view={ view }
			/>
		</div>
	);
}
