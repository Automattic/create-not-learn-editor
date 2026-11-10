/**
 * The Pages sidebar: a page opened up into a summary of it, with its layout
 * and every detail a step further in.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import ScreenLinks from '../../../screen-links';
import { getPageTitle, usePages, usePageSections } from './data';
import { getPageAncestorTitles } from './page-tree';
import { groupSections } from './page-sections';
import { LIST_PATH } from './page-tree-list';
import {
	DETAILS_VIEW,
	getPageSearchString,
	HOMEPAGE_VIEW,
	LAYOUT_VIEW,
} from './page-views';
import { PageDetails, PageSummary } from './page-details';
import { PageOptions } from './page-options';
import { MemoizedPageLayouts, usePageLayoutName } from './page-layout-picker';
import {
	__,
	Breadcrumbs,
	coreDataStore,
	infoIcon,
	layoutIcon,
	Page,
	settingsIcon,
	sprintf,
	useCallback,
	useMemo,
	useSelect,
} from '../../../wordpress-packages';

/**
 * A page opened up: whether visitors can see it and where, and the way on to
 * its layout and the rest of its details.
 *
 * The homepage's page opens as the homepage, with what the homepage shows
 * above the page's own details.
 *
 * @param {Object}  props                Component props.
 * @param {Element} props.configurePanel What the homepage shows, for the
 *                                       homepage.
 * @param {Element} props.intro          Shown first, for the homepage.
 * @param {boolean} props.isHomepage     Whether the page is the homepage.
 * @param {number}  props.pageId         Page ID.
 * @return {Element} The page stage.
 */
export function PageDetailStage( {
	configurePanel = null,
	intro = null,
	isHomepage = false,
	pageId,
} ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { pages } = usePages();
	const { blocks } = usePageSections( pageId );
	// Each run of text is one section, as on the canvas.
	const sectionCount = useMemo(
		() => groupSections( blocks ).length,
		[ blocks ]
	);
	const page = useSelect(
		( selectStore ) => {
			const store = selectStore( coreDataStore );

			// Edited records aren't fetched on their own: ask for the page,
			// so its details load when nothing else has asked yet.
			if ( ! store.getEntityRecord( 'postType', 'page', pageId ) ) {
				return null;
			}

			return store.getEditedEntityRecord( 'postType', 'page', pageId );
		},
		[ pageId ]
	);
	const layoutName = usePageLayoutName( {
		isFrontPage: isHomepage,
		slug: page?.slug,
		template: page?.template,
	} );
	const listPage = pages.find( ( item ) => Number( item.id ) === pageId );
	const title = isHomepage
		? __( 'Homepage' )
		: getPageTitle( listPage || page );
	const ancestors = isHomepage
		? []
		: getPageAncestorTitles( pages, pageId, getPageTitle );
	const viewTitles = {
		[ DETAILS_VIEW ]: __( 'See all details' ),
		[ LAYOUT_VIEW ]: __( 'Change layout' ),
		...( configurePanel && {
			[ HOMEPAGE_VIEW ]: __( 'Configure homepage' ),
		} ),
	};
	const view = viewTitles[ searchParams.view ] ? searchParams.view : null;
	const openLayouts = useCallback(
		() =>
			navigate( {
				search: { ...searchParams, view: LAYOUT_VIEW },
				to: LIST_PATH,
			} ),
		[ navigate, searchParams ]
	);

	const editPage = () => navigate( { to: `/types/page/edit/${ pageId }` } );
	const actions = (
		<PageOptions
			isHomepage={ isHomepage }
			onEdit={ editPage }
			page={ listPage ? { ...listPage, ...page } : page }
			pageId={ pageId }
		/>
	);
	let body;

	if ( view === LAYOUT_VIEW ) {
		body = (
			<MemoizedPageLayouts
				isFrontPage={ isHomepage }
				pageId={ pageId }
				sectionCount={ sectionCount }
				slug={ page?.slug }
				template={ page?.template }
			/>
		);
	} else if ( view === DETAILS_VIEW ) {
		body = (
			<PageDetails
				layoutName={ layoutName }
				onOpenLayouts={ openLayouts }
				pageId={ pageId }
			/>
		);
	} else if ( view === HOMEPAGE_VIEW ) {
		body = configurePanel;
	} else {
		body = (
			<>
				<PageSummary pageId={ pageId } />
				{ intro }
				<ScreenLinks
					label={ __( 'More about this page' ) }
					links={ [
						{
							description: layoutName
								? sprintf(
										/* translators: %s: layout name. */
										__( 'Uses the %s layout' ),
										layoutName
									)
								: __( 'How the page is set out' ),
							icon: layoutIcon,
							search: { ...searchParams, view: LAYOUT_VIEW },
							title: __( 'Change layout' ),
							to: LIST_PATH,
						},
						{
							description: __( 'Author, dates and more' ),
							icon: infoIcon,
							search: { ...searchParams, view: DETAILS_VIEW },
							title: __( 'See all details' ),
							to: LIST_PATH,
						},
						configurePanel && {
							description: __( 'Choose what visitors see first' ),
							icon: settingsIcon,
							search: { ...searchParams, view: HOMEPAGE_VIEW },
							title: __( 'Configure homepage' ),
							to: LIST_PATH,
						},
					].filter( Boolean ) }
				/>
			</>
		);
	}

	return (
		<Page
			actions={ actions }
			ariaLabel={ title }
			breadcrumbs={
				<Breadcrumbs
					items={ [
						{ label: __( 'Pages' ), to: LIST_PATH },
						...ancestors.map( ( label ) => ( { label } ) ),
						// A view drilled into leads back to the summary.
						...( view
							? [
									{
										label: title,
										to: `${ LIST_PATH }?${ getPageSearchString(
											searchParams
										) }`,
									},
									{ label: viewTitles[ view ] },
								]
							: [ { label: title } ] ),
					] }
				/>
			}
			className="cnl-editor-stage cnl-pages-detail"
			hasPadding={ false }
			headingLevel={ 2 }
		>
			<div className="cnl-pages-detail__body">{ body }</div>
		</Page>
	);
}
