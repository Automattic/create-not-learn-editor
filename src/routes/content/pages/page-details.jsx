/**
 * What there is to know about an opened page: a short summary at the top of
 * its screen, and every detail, a step further in.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getStatusLabel } from '../helpers';
import { getPageTitle } from './data';
import {
	__,
	Button,
	coreDataStore,
	dateI18n,
	decodeEntities,
	draftsIcon,
	externalIcon,
	getDateSettings,
	humanTimeDiff,
	Icon,
	notAllowedIcon,
	pendingIcon,
	publishedIcon,
	scheduledIcon,
	sprintf,
	Text,
	trashIcon,
	useSelect,
} from '../../../wordpress-packages';

// Statuses whose address visitors can open.
const LIVE_STATUSES = [ 'publish', 'private' ];

/**
 * A page's address as people read it: no `https://`, and no trailing slash
 * after the domain on its own.
 *
 * @param {string} link Page URL.
 * @return {string} The address.
 */
function getDisplayAddress( link ) {
	if ( ! link ) {
		return '';
	}

	try {
		const url = new URL( link );
		const path = decodeURI( url.pathname + url.search );

		return url.host + ( path === '/' ? '' : path );
	} catch {
		return link;
	}
}

// The icons the editor's own Status field shows for each status.
const STATUS_ICONS = {
	'auto-draft': draftsIcon,
	draft: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: notAllowedIcon,
	publish: publishedIcon,
	trash: trashIcon,
};

function StatusValue( { status } ) {
	return (
		<span className="cnl-page-details__status">
			{ STATUS_ICONS[ status ] && (
				<Icon icon={ STATUS_ICONS[ status ] } size={ 24 } />
			) }
			{ getStatusLabel( status ) }
		</span>
	);
}

function AddressValue( { page } ) {
	if ( ! page?.link || ! LIVE_STATUSES.includes( page.status ) ) {
		return (
			<Text className="cnl-page-details__muted" variant="body-sm">
				{ __( 'Not on your site yet' ) }
			</Text>
		);
	}

	return (
		<a
			className="cnl-page-details__link"
			href={ page.link }
			rel="noopener noreferrer"
			target="_blank"
		>
			<span className="cnl-page-details__link-text">
				{ getDisplayAddress( page.link ) }
			</span>
			<Icon icon={ externalIcon } size={ 16 } />
			<span className="screen-reader-text">
				{ __( '(opens in a new tab)' ) }
			</span>
		</a>
	);
}

/**
 * Label and value pairs, one row each.
 *
 * @param {Object}   props       Component props.
 * @param {string}   props.label Accessible name for the list.
 * @param {Object[]} props.rows  `{ label, value }` for each row. Rows without
 *                               a value are left out.
 * @return {Element} The list.
 */
function DetailsList( { label, rows } ) {
	return (
		<dl aria-label={ label } className="cnl-page-details">
			{ rows
				.filter( ( row ) => row.value )
				.map( ( row ) => (
					<div className="cnl-page-details__row" key={ row.label }>
						<dt className="cnl-page-details__label">
							{ row.label }
						</dt>
						<dd className="cnl-page-details__value">
							{ row.value }
						</dd>
					</div>
				) ) }
		</dl>
	);
}

/**
 * The two things most worth knowing about a page at a glance: whether
 * visitors can see it, and where.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.page Page record, with any unsaved edits.
 * @return {Element} The summary.
 */
export function PageSummary( { page } ) {
	if ( ! page?.status ) {
		return null;
	}

	return (
		<DetailsList
			label={ __( 'About this page' ) }
			rows={ [
				{
					label: __( 'Status' ),
					value: <StatusValue status={ page.status } />,
				},
				{
					label: __( 'Address' ),
					value: <AddressValue page={ page } />,
				},
			] }
		/>
	);
}

/**
 * When the page went live, or will.
 *
 * @param {Object} page Page record.
 * @return {?Object} `{ label, value }`, or `null` for a page that hasn't been
 *                   published or scheduled.
 */
function getDateRow( page ) {
	if ( ! page?.date ) {
		return null;
	}

	const value = dateI18n( getDateSettings().formats.datetime, page.date );

	if ( page.status === 'future' ) {
		return { label: __( 'Goes live' ), value };
	}

	if ( LIVE_STATUSES.includes( page.status ) ) {
		return { label: __( 'Published' ), value };
	}

	return null;
}

/**
 * Every detail about a page, as WordPress keeps them, in plain words. Its
 * layout leads on to the layouts it can use.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.layoutName    The name of the page's layout.
 * @param {Function} props.onOpenLayouts Opens the layouts.
 * @param {Object}   props.page          Page record, with any unsaved edits.
 * @param {Object[]} props.pages         Every page, to name its parent.
 * @return {Element} The details.
 */
export function PageDetails( { layoutName, onOpenLayouts, page, pages } ) {
	const { author, image } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				author: page?.author
					? store.getEntityRecord( 'root', 'user', page.author )
					: null,
				image: page?.featured_media
					? store.getEntityRecord(
							'postType',
							'attachment',
							page.featured_media
						)
					: null,
			};
		},
		[ page?.author, page?.featured_media ]
	);
	const parent = page?.parent
		? pages.find( ( item ) => Number( item.id ) === page.parent )
		: null;
	const thumbnail =
		image?.media_details?.sizes?.thumbnail?.source_url || image?.source_url;
	const navigate = useNavigate();

	if ( ! page?.status ) {
		return null;
	}

	return (
		<DetailsList
			label={ __( 'See all details' ) }
			rows={ [
				{
					label: __( 'Status' ),
					value: <StatusValue status={ page.status } />,
				},
				{
					label: __( 'Address' ),
					value: <AddressValue page={ page } />,
				},
				getDateRow( page ),
				page.modified && {
					label: __( 'Last edited' ),
					value: humanTimeDiff( page.modified ),
				},
				{
					label: __( 'Author' ),
					value: author?.name ? decodeEntities( author.name ) : '',
				},
				{
					label: __( 'Layout' ),
					value: layoutName && (
						<Button
							className="cnl-page-details__button"
							onClick={ onOpenLayouts }
							variant="link"
						>
							{ layoutName }
						</Button>
					),
				},
				{
					label: __( 'Parent page' ),
					value: parent ? (
						<Button
							className="cnl-page-details__button"
							onClick={ () =>
								navigate( {
									search: {
										postId: parent.id,
										previewId: parent.id,
									},
									to: '/types/page/list/all',
								} )
							}
							variant="link"
						>
							{ getPageTitle( parent ) }
						</Button>
					) : (
						__( 'None' )
					),
				},
				{
					label: __( 'Featured image' ),
					value: thumbnail ? (
						<img
							alt={
								image?.alt_text ||
								sprintf(
									/* translators: %s: page title. */
									__( 'Featured image for %s' ),
									getPageTitle( page )
								)
							}
							className="cnl-page-details__image"
							src={ thumbnail }
						/>
					) : (
						__( 'None' )
					),
				},
				page.password && {
					label: __( 'Password' ),
					value: __( 'Needed to see it' ),
				},
			].filter( Boolean ) }
		/>
	);
}
