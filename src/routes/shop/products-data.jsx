/**
 * Products as DataViews sees them: the fields, the WooCommerce query behind a
 * view, and what can be done to a product. Shared by the list in Products and
 * the table of every product, so the two always agree.
 *
 * WooCommerce does the searching, filtering, sorting and paging, so a shop of
 * any size works.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { PRODUCT_KIND, PRODUCT_NAME, formatPrice } from './product-entity';
import {
	HAS_OPTIONS,
	STATUS_LABELS,
	STOCK_LABELS,
	getPriceLabel,
	getProductEditUrl,
} from './product-labels';
import { PRODUCTS_PATH } from './shop';
import {
	Badge,
	Button,
	EmptyState,
	Stack,
	__,
	coreDataStore,
	decodeEntities,
	noticesStore,
	searchIcon,
	sprintf,
	tagIcon,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

export const EMPTY_ARRAY = [];

const STATUS_OPTIONS = [
	{ label: __( 'In the shop', 'create-not-learn-editor' ), value: 'publish' },
	{ label: __( 'Draft', 'create-not-learn-editor' ), value: 'draft' },
	{
		label: __( 'Waiting for review', 'create-not-learn-editor' ),
		value: 'pending',
	},
	{ label: __( 'Private', 'create-not-learn-editor' ), value: 'private' },
	{ label: __( 'Scheduled', 'create-not-learn-editor' ), value: 'future' },
];

const STOCK_OPTIONS = [
	{ label: __( 'In stock', 'create-not-learn-editor' ), value: 'instock' },
	{ label: __( 'Sold out', 'create-not-learn-editor' ), value: 'outofstock' },
	{
		label: __( 'Taking orders', 'create-not-learn-editor' ),
		value: 'onbackorder',
	},
];

const TYPE_OPTIONS = [
	{ label: __( 'Simple', 'create-not-learn-editor' ), value: 'simple' },
	{
		label: __( 'With options', 'create-not-learn-editor' ),
		value: 'variable',
	},
	{ label: __( 'Group', 'create-not-learn-editor' ), value: 'grouped' },
	{
		label: __( 'Sold elsewhere', 'create-not-learn-editor' ),
		value: 'external',
	},
];

// The fields WooCommerce can sort by, and what it calls them.
const ORDER_BY = {
	date: 'date',
	name: 'title',
	price: 'price',
	total_sales: 'popularity',
};

function getLabel( options, value ) {
	return options.find( ( option ) => option.value === value )?.label;
}

/**
 * The table's view, as a WooCommerce products query.
 *
 * @param {Object} view DataViews view.
 * @return {Object} Query for `wc/v3/products`.
 */
/**
 * @param {Object} product Product record.
 * @return {string[]} Its status, sale and stock, where they need saying.
 */
function getProductBadges( product ) {
	return [
		STATUS_LABELS[ product.status ],
		! HAS_OPTIONS.includes( product.type ) &&
			product.sale_price &&
			__( 'On sale', 'create-not-learn-editor' ),
		product.type !== 'external' && STOCK_LABELS[ product.stock_status ],
	].filter( Boolean );
}

export function getQuery( view ) {
	const query = {
		order: view.sort?.direction || 'desc',
		orderby: ORDER_BY[ view.sort?.field ] || 'date',
		page: view.page || 1,
		per_page: view.perPage || 20,
		status: 'any',
	};

	if ( view.search ) {
		query.search = view.search;
	}

	// WooCommerce filters by one of each, so each filter is "is".
	( view.filters || [] ).forEach( ( { field, value } ) => {
		if ( value && [ 'status', 'stock_status', 'type' ].includes( field ) ) {
			query[ field ] = value;
		}
	} );

	return query;
}

export function getProductFields() {
	return [
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'image',
			label: __( 'Photo', 'create-not-learn-editor' ),
			render: ( { item } ) =>
				item.images?.[ 0 ]?.src ? (
					<img
						alt=""
						className="cnl-shop-table__photo"
						src={ item.images[ 0 ].src }
					/>
				) : (
					<span
						aria-hidden
						className="cnl-shop-table__photo is-empty"
					/>
				),
			type: 'media',
		},
		{
			enableGlobalSearch: true,
			enableHiding: false,
			filterBy: false,
			getValue: ( { item } ) => decodeEntities( item.name || '' ),
			id: 'name',
			label: __( 'Name', 'create-not-learn-editor' ),
			render: ( { item } ) => (
				<Stack align="center" direction="row" gap="sm">
					{ decodeEntities( item.name || '' ) ||
						__( 'Untitled product', 'create-not-learn-editor' ) }
					{ item.isUnsaved && (
						<Badge intent="draft">
							{ __( 'Not saved', 'create-not-learn-editor' ) }
						</Badge>
					) }
				</Stack>
			),
			type: 'text',
		},
		{
			// Price and stock in one line, under the name in the list.
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				[
					getPriceLabel( item ),
					item.manage_stock &&
						sprintf(
							/* translators: %d: How many are in stock. */
							__( '%d in stock', 'create-not-learn-editor' ),
							item.stock_quantity ?? 0
						),
				]
					.filter( Boolean )
					.join( ' · ' ),
			id: 'summary',
			label: __( 'Summary', 'create-not-learn-editor' ),
			type: 'text',
		},
		{
			// What is out of the ordinary about a product, at a glance.
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getProductBadges( item ).join( ', ' ),
			id: 'badges',
			label: __( 'Notes', 'create-not-learn-editor' ),
			render: ( { item } ) => {
				const badges = getProductBadges( item );

				return badges.length ? (
					<Stack direction="row" gap="xs" wrap="wrap">
						{ badges.map( ( badge ) => (
							<Badge intent="draft" key={ badge }>
								{ badge }
							</Badge>
						) ) }
					</Stack>
				) : null;
			},
			type: 'text',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => Number( item.price ) || 0,
			id: 'price',
			label: __( 'Price', 'create-not-learn-editor' ),
			render: ( { item } ) =>
				! HAS_OPTIONS.includes( item.type ) && item.sale_price
					? sprintf(
							/* translators: 1: Sale price, 2: Usual price. */
							__( '%1$s (was %2$s)', 'create-not-learn-editor' ),
							formatPrice( item.sale_price ),
							formatPrice( item.regular_price )
						)
					: getPriceLabel( item ),
			type: 'number',
		},
		{
			elements: STOCK_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.stock_status,
			id: 'stock_status',
			label: __( 'Stock', 'create-not-learn-editor' ),
			render: ( { item } ) => {
				// Sold on another site, so it has no stock here.
				if ( item.type === 'external' ) {
					return '';
				}

				return item.manage_stock
					? sprintf(
							/* translators: %d: How many are in stock. */
							__( '%d in stock', 'create-not-learn-editor' ),
							item.stock_quantity ?? 0
						)
					: getLabel( STOCK_OPTIONS, item.stock_status );
			},
			type: 'text',
		},
		{
			elements: STATUS_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.status,
			id: 'status',
			label: __( 'Shown', 'create-not-learn-editor' ),
			render: ( { item } ) =>
				item.status === 'publish' ? (
					getLabel( STATUS_OPTIONS, item.status )
				) : (
					<Badge intent="draft">
						{ STATUS_LABELS[ item.status ] || item.status }
					</Badge>
				),
			type: 'text',
		},
		{
			elements: TYPE_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.type,
			id: 'type',
			label: __( 'Kind', 'create-not-learn-editor' ),
			render: ( { item } ) =>
				getLabel( TYPE_OPTIONS, item.type ) || item.type,
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				( item.categories || [] )
					.map( ( { name } ) => decodeEntities( name ) )
					.join( ', ' ),
			id: 'categories',
			label: __( 'Categories', 'create-not-learn-editor' ),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => item.sku || '',
			id: 'sku',
			label: __( 'SKU', 'create-not-learn-editor' ),
			type: 'text',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => item.total_sales || 0,
			id: 'total_sales',
			label: __( 'Sold', 'create-not-learn-editor' ),
			type: 'integer',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => item.date_created,
			id: 'date',
			label: __( 'Added', 'create-not-learn-editor' ),
			render: ( { item } ) =>
				item.date_created
					? new Date( item.date_created ).toLocaleDateString(
							undefined,
							{
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							}
						)
					: '',
			type: 'datetime',
		},
	];
}

export function useProductsPage( view ) {
	const query = useMemo( () => getQuery( view ), [ view ] );

	return useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const args = [ PRODUCT_KIND, PRODUCT_NAME, query ];
			const records = store.getEntityRecords( ...args );

			return {
				// What is shown includes unsaved changes, so a change made
				// here shows straight away. WooCommerce searches and filters
				// what is saved, so a changed product is marked as such, as
				// it may not match the filters until it is saved.
				data:
					records?.map( ( { id } ) => {
						const product = store.getEditedEntityRecord(
							PRODUCT_KIND,
							PRODUCT_NAME,
							id
						);
						// The name and description are changed on the
						// product's post, by the editor and the Products
						// screen alike.
						const hasPostEdits = store.hasEditsForEntityRecord(
							'postType',
							'product',
							id
						);
						const postEdits = hasPostEdits
							? store.getEntityRecordEdits(
									'postType',
									'product',
									id
								)
							: null;

						if (
							! hasPostEdits &&
							! store.hasEditsForEntityRecord(
								PRODUCT_KIND,
								PRODUCT_NAME,
								id
							)
						) {
							return product;
						}

						return {
							...product,
							isUnsaved: true,
							name: postEdits?.title ?? product.name,
							short_description:
								postEdits?.excerpt ?? product.short_description,
						};
					} ) || EMPTY_ARRAY,
				isLoading: ! store.hasFinishedResolution(
					'getEntityRecords',
					args
				),
				totalItems: store.getEntityRecordsTotalItems?.( ...args ) || 0,
				totalPages: store.getEntityRecordsTotalPages?.( ...args ) || 0,
			};
		},
		[ query ]
	);
}

/**
 * Adds a product and opens it. A draft, so nothing shows in the shop until
 * it is switched on.
 *
 * @return {{ add: () => Promise<void>, isAdding: boolean }} Adds one, and
 *         whether it is.
 */
export function useAddProduct() {
	const navigate = useNavigate();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const [ isAdding, setIsAdding ] = useState( false );

	const add = async () => {
		setIsAdding( true );

		try {
			const product = await saveEntityRecord(
				PRODUCT_KIND,
				PRODUCT_NAME,
				{
					name: __( 'New product', 'create-not-learn-editor' ),
					status: 'draft',
					type: 'simple',
				},
				{ throwOnError: true }
			);
			navigate( {
				search: { product: product.id },
				to: PRODUCTS_PATH,
			} );
		} catch ( addError ) {
			createErrorNotice( addError.message, { type: 'snackbar' } );
		}

		setIsAdding( false );
	};

	return { add, isAdding };
}

/**
 * What the list and the table show with no products in them: a way to add
 * the first, or, when a search finds nothing, what was searched for.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.view The DataViews view.
 * @return {Element} The empty state.
 */
export function ProductsEmpty( { view } ) {
	const { add, isAdding } = useAddProduct();
	const isFiltered = !! view.search || !! view.filters?.length;
	let title = __( 'No products yet', 'create-not-learn-editor' );

	if ( view.search ) {
		title = sprintf(
			/* translators: %s: What the products were searched for. */
			__( 'Nothing matches “%s”', 'create-not-learn-editor' ),
			view.search
		);
	} else if ( isFiltered ) {
		title = __( 'No products match', 'create-not-learn-editor' );
	}

	return (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ isFiltered ? searchIcon : tagIcon } />
				<EmptyState.Title>{ title }</EmptyState.Title>
				<EmptyState.Description>
					{ isFiltered
						? __(
								'Try other words, or clear the filters.',
								'create-not-learn-editor'
							)
						: __(
								'Add what you sell, with a photo and a price, and it shows in your shop.',
								'create-not-learn-editor'
							) }
				</EmptyState.Description>
				{ ! isFiltered && (
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							disabled={ isAdding }
							isBusy={ isAdding }
							onClick={ add }
							variant="primary"
						>
							{ __( 'Add product', 'create-not-learn-editor' ) }
						</Button>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		</div>
	);
}

export function useProductActions() {
	const navigate = useNavigate();
	const { editEntityRecord } = useDispatch( coreDataStore );
	const edit = ( items, edits ) =>
		items.forEach( ( item ) =>
			editEntityRecord( PRODUCT_KIND, PRODUCT_NAME, item.id, edits )
		);
	const isSimple = ( item ) =>
		! HAS_OPTIONS.includes( item.type ) &&
		item.type !== 'external' &&
		! item.manage_stock;

	return [
		{
			callback: ( [ item ] ) =>
				navigate( {
					search: { product: item.id },
					to: PRODUCTS_PATH,
				} ),
			id: 'edit',
			isPrimary: true,
			label: __( 'Edit', 'create-not-learn-editor' ),
		},
		{
			callback: ( items ) => edit( items, { status: 'publish' } ),
			id: 'show',
			isEligible: ( item ) => item.status !== 'publish',
			label: __( 'Show in your shop', 'create-not-learn-editor' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) => edit( items, { status: 'draft' } ),
			id: 'hide',
			isEligible: ( item ) => item.status === 'publish',
			label: __( 'Hide from your shop', 'create-not-learn-editor' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) => edit( items, { stock_status: 'instock' } ),
			id: 'in-stock',
			isEligible: ( item ) =>
				isSimple( item ) && item.stock_status !== 'instock',
			label: __( 'Mark as in stock', 'create-not-learn-editor' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) =>
				edit( items, { stock_status: 'outofstock' } ),
			id: 'sold-out',
			isEligible: ( item ) =>
				isSimple( item ) && item.stock_status !== 'outofstock',
			label: __( 'Mark as sold out', 'create-not-learn-editor' ),
			supportsBulk: true,
		},
		{
			callback: ( [ item ] ) =>
				window.open( item.permalink, '_blank', 'noopener,noreferrer' ),
			id: 'view',
			isEligible: ( item ) => item.status === 'publish',
			label: __( 'View in your shop', 'create-not-learn-editor' ),
		},
		{
			callback: ( [ item ] ) =>
				window.open(
					getProductEditUrl( item.id ),
					'_blank',
					'noopener,noreferrer'
				),
			id: 'admin',
			label: __( 'Edit in WP Admin', 'create-not-learn-editor' ),
		},
	];
}
