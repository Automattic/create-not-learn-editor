/**
 * What there is to know about an opened page, and changing it: a short
 * summary at the top of its screen, and every detail a step further in.
 *
 * Both are core's own page fields, the ones the editor's sidebar shows, in a
 * DataForm as the editor's DataForm summary lays them out. Changes are edits
 * to the page, saved with the rest of the page's changes.
 */

/**
 * WordPress dependencies
 */
import { privateApis as editorPrivateApis } from '@wordpress/editor';

/**
 * Internal dependencies
 */
import { unlock } from '../../../lock-unlock';
import { useDataViews } from '../../../use-dataviews';
import { PageMenusEdit, PageMenusView } from './page-menus';
import { getPagePath } from './page-path';
import {
	__,
	Button,
	Card,
	coreDataStore,
	Skeleton,
	Text,
	useDispatch,
	useMemo,
	useSelect,
} from '../../../wordpress-packages';

const { usePostFields } = unlock( editorPrivateApis );

// The page's status, and what goes with it, as the editor groups them.
const STATUS_GROUP = {
	id: 'status',
	label: __( 'Status' ),
	children: [
		{
			id: 'status',
			layout: { type: 'regular', labelPosition: 'none' },
		},
		'scheduled_date',
		'password',
	],
};

const SUMMARY_FORM = {
	layout: { type: 'panel' },
	fields: [ STATUS_GROUP, 'slug', 'cnl_menus' ],
};

// Everything in the editor's summary that applies to a page, but its
// discussion, as pages aren't commented on, and its template, which is
// changed from Change layout.
const DETAILS_FORM = {
	layout: { type: 'panel' },
	fields: [
		{
			id: 'featured_media',
			layout: { type: 'regular', labelPosition: 'none' },
		},
		STATUS_GROUP,
		'date',
		'slug',
		'cnl_menus',
		'author',
		'cnl_layout',
		'parent',
		// Its value says what it is, as in the editor's summary.
		{
			id: 'last_edited_date',
			layout: { type: 'regular', labelPosition: 'none' },
		},
	],
};

// Plain words for the editor's labels.
const LABELS = {
	parent: __( 'Parent page' ),
	slug: __( 'Address' ),
};

/**
 * The Address row's value: the page's path, or `/` for the homepage.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.item Page record.
 * @return {string} The path.
 */
function AddressView( { item } ) {
	const isHomepage = useSelect(
		( select ) => {
			const site = select( coreDataStore ).getEditedEntityRecord(
				'root',
				'site'
			);

			return (
				site?.show_on_front === 'page' &&
				Number( site.page_on_front ) === Number( item.id )
			);
		},
		[ item.id ]
	);

	return isHomepage ? '/' : getPagePath( item );
}

/**
 * Core's page fields, in plain words, with rows of our own for the menus the
 * page is in and a Layout row that leads to Change layout.
 *
 * @param {string}   layoutName    The name of the page's layout.
 * @param {Function} onOpenLayouts Opens the layouts.
 * @return {?Object[]} DataForm fields, or `null` until they are registered.
 */
function usePageFields( layoutName, onOpenLayouts ) {
	const fields = usePostFields( { postType: 'page' } );

	return useMemo( () => {
		if ( ! fields?.length ) {
			return null;
		}

		return [
			...fields.map( ( field ) => {
				let next = field;

				if ( LABELS[ field.id ] ) {
					next = { ...next, label: LABELS[ field.id ] };
				}

				if ( field.id === 'slug' ) {
					next = { ...next, render: AddressView };
				}

				// A note rather than a detail to change, so quieter, as in
				// the editor's summary.
				if ( field.id === 'last_edited_date' && field.render ) {
					const FieldView = field.render;

					next = {
						...next,
						render: ( props ) => (
							<Text
								className="cnl-page-details__note"
								variant="body-sm"
							>
								<FieldView { ...props } />
							</Text>
						),
					};
				}

				// As in the editor, a page is moved to the trash, not given
				// it as a status.
				if ( field.id === 'status' ) {
					next = {
						...next,
						elements: field.elements.filter(
							( element ) => element.value !== 'trash'
						),
					};
				}

				return next;
			} ),
			// Which menus the page is in. Its switches change the menus
			// themselves, not the page, so nothing goes through `onChange`.
			{
				id: 'cnl_menus',
				label: __( 'Menus' ),
				Edit: PageMenusEdit,
				render: PageMenusView,
			},
			{
				id: 'cnl_layout',
				label: __( 'Layout' ),
				readOnly: true,
				render: () =>
					layoutName ? (
						<Button
							className="cnl-page-details__button"
							onClick={ onOpenLayouts }
							variant="link"
						>
							{ layoutName }
						</Button>
					) : null,
			},
		];
	}, [ fields, layoutName, onOpenLayouts ] );
}

/**
 * A page's details as a form, on a card of their own: each one shows its
 * value, and its pencil changes it.
 *
 * @param {Object}   props               Component props.
 * @param {Object}   props.form          DataForm form.
 * @param {string}   props.label         Accessible name.
 * @param {string}   props.layoutName    The name of the page's layout.
 * @param {Function} props.onOpenLayouts Opens the layouts.
 * @param {number}   props.pageId        Page ID.
 * @return {Element} The form.
 */
function PageDetailsForm( { form, label, layoutName, onOpenLayouts, pageId } ) {
	const dataviews = useDataViews();
	const fields = usePageFields( layoutName, onOpenLayouts );
	const page = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			// Edited records aren't fetched on their own.
			if ( ! store.getEntityRecord( 'postType', 'page', pageId ) ) {
				return null;
			}

			return store.getEditedEntityRecord( 'postType', 'page', pageId );
		},
		[ pageId ]
	);
	const { editEntityRecord } = useDispatch( coreDataStore );

	if ( ! dataviews || ! fields || ! page ) {
		return (
			<Card.Root aria-hidden className="cnl-page-details">
				<Card.Content className="cnl-page-details__content is-loading">
					<Skeleton style={ { height: 20, width: '70%' } } />
					<Skeleton style={ { height: 20, width: '55%' } } />
				</Card.Content>
			</Card.Root>
		);
	}

	// As the editor does: a page no longer scheduled loses its future date,
	// and a private one its password.
	const onChange = ( edits ) => {
		const next = { ...edits };

		if (
			next.status &&
			next.status !== 'future' &&
			page.status === 'future' &&
			new Date( page.date ) > new Date()
		) {
			next.date = null;
		}

		if ( next.status === 'private' && page.password ) {
			next.password = '';
		}

		editEntityRecord( 'postType', 'page', pageId, next );
	};

	return (
		<Card.Root
			aria-label={ label }
			className="cnl-page-details"
			render={ <section /> }
		>
			<Card.Content className="cnl-page-details__content">
				<dataviews.DataForm
					data={ page }
					fields={ fields }
					form={ form }
					onChange={ onChange }
				/>
			</Card.Content>
		</Card.Root>
	);
}

/**
 * The two things most worth knowing about a page at a glance, and changing:
 * whether visitors can see it, and where.
 *
 * @param {Object} props        Component props.
 * @param {number} props.pageId Page ID.
 * @return {Element} The summary.
 */
export function PageSummary( { pageId } ) {
	return (
		<PageDetailsForm
			form={ SUMMARY_FORM }
			label={ __( 'About this page' ) }
			pageId={ pageId }
		/>
	);
}

/**
 * Every detail about a page that can be changed. Its layout leads on to the
 * layouts it can use.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.layoutName    The name of the page's layout.
 * @param {Function} props.onOpenLayouts Opens the layouts.
 * @param {number}   props.pageId        Page ID.
 * @return {Element} The details.
 */
export function PageDetails( { layoutName, onOpenLayouts, pageId } ) {
	return (
		<PageDetailsForm
			form={ DETAILS_FORM }
			label={ __( 'See all details' ) }
			layoutName={ layoutName }
			onOpenLayouts={ onOpenLayouts }
			pageId={ pageId }
		/>
	);
}
