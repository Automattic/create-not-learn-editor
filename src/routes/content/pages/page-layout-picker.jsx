/**
 * The layouts an opened page can use.
 */

/**
 * Internal dependencies
 */
import { getTemplateDisplayTitle } from '../../../records';
import { usePageLayouts } from './data';
import { getLayoutDescription, getLayoutOutline } from './layout-outline';
import LayoutSketch from './layout-sketch';
import {
	__,
	checkIcon,
	coreDataStore,
	Icon,
	memo,
	Skeleton,
	Text,
	useDispatch,
	useId,
	useMemo,
} from '../../../wordpress-packages';

function LayoutCard( { isSelected, label, onPick, outline, sectionCount } ) {
	const descriptionId = useId();

	return (
		<li className="cnl-page-layouts__item">
			<button
				aria-describedby={ descriptionId }
				aria-pressed={ isSelected }
				className="cnl-page-layout"
				disabled={ ! onPick }
				onClick={ onPick }
				type="button"
			>
				<span className="cnl-page-layout__preview">
					<LayoutSketch
						outline={ outline }
						sectionCount={ sectionCount }
					/>
				</span>
				<span className="cnl-page-layout__footer">
					<span className="cnl-page-layout__name">{ label }</span>
					{ isSelected && (
						<Icon
							className="cnl-page-layout__check"
							icon={ checkIcon }
							size={ 20 }
						/>
					) }
				</span>
				<span hidden id={ descriptionId }>
					{ getLayoutDescription( outline ) }
				</span>
			</button>
		</li>
	);
}

/**
 * The layouts a page can use, as options to pick from.
 *
 * @param {string}  slug             Page slug.
 * @param {boolean} isFrontPage      Whether the page is the homepage.
 * @param {boolean} showsLatestPosts Whether the homepage, kept on this page,
 *                                   lists the latest posts.
 * @return {Object} `{ frontPageTemplate, isLoading, options }`, each option
 *                  `{ label, outline, value }`.
 */
function useLayoutOptions( slug, isFrontPage, showsLatestPosts ) {
	const { custom, defaultTemplate, frontPageTemplate, isLoading, patterns } =
		usePageLayouts( slug, isFrontPage, showsLatestPosts );
	const options = useMemo( () => {
		const resolvePattern = ( name ) =>
			patterns.find( ( pattern ) => pattern.name === name )?.content;
		const toOption = ( template, label, value ) => ( {
			label,
			outline: getLayoutOutline( template.content?.raw, {
				resolvePattern,
			} ),
			value,
		} );

		if ( frontPageTemplate ) {
			return [
				toOption(
					frontPageTemplate,
					getTemplateDisplayTitle( frontPageTemplate ) ||
						__( 'Homepage' )
				),
			];
		}

		return [
			defaultTemplate &&
				toOption( defaultTemplate, __( 'Standard' ), '' ),
			...custom
				.filter( ( template ) => template.content?.raw )
				.map( ( template ) =>
					toOption(
						template,
						getTemplateDisplayTitle( template ) || template.slug,
						template.slug
					)
				),
		].filter( Boolean );
	}, [ custom, defaultTemplate, frontPageTemplate, patterns ] );

	return { frontPageTemplate, isLoading, options };
}

/**
 * The name of the layout a page uses.
 *
 * @param {Object}  props             Hook options.
 * @param {boolean} props.isFrontPage Whether the page is the homepage.
 * @param {string}  props.slug        Page slug.
 * @param {string}  props.template    The page's chosen template slug, if any.
 * @return {string} The name, or an empty string until the layouts load.
 */
export function usePageLayoutName( { isFrontPage, slug, template = '' } ) {
	const { frontPageTemplate, isLoading, options } = useLayoutOptions(
		slug,
		isFrontPage
	);

	if ( isLoading ) {
		return '';
	}

	if ( frontPageTemplate ) {
		return options[ 0 ]?.label || '';
	}

	// A layout that has since gone falls back to the standard one.
	return (
		options.find( ( option ) => option.value === template )?.label ||
		options.find( ( option ) => option.value === '' )?.label ||
		''
	);
}

/**
 * The layouts a page can use, each drawn with the page's sections in it, so
 * picking one is picking how this page looks. The canvas follows the choice
 * straight away; it is saved with the page.
 *
 * Layouts are drawn from their templates rather than rendered. Rendering each
 * one with the page in it, again on every change to the page, made typing on
 * this screen crawl.
 *
 * @param {Object}  props                  Component props.
 * @param {boolean} props.isFrontPage      Whether the page is the homepage.
 * @param {number}  props.pageId           Page ID.
 * @param {number}  props.sectionCount     How many sections the page has.
 * @param {boolean} props.showsLatestPosts Whether the homepage, kept on this
 *                                         page, lists the latest posts.
 * @param {string}  props.slug             Page slug.
 * @param {string}  props.template         The page's chosen template slug, if
 *                                         any.
 * @return {Element} The layout picker.
 */
function PageLayouts( {
	isFrontPage,
	pageId,
	sectionCount,
	showsLatestPosts,
	slug,
	template: current = '',
} ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { frontPageTemplate, isLoading, options } = useLayoutOptions(
		slug,
		isFrontPage,
		showsLatestPosts
	);
	let body;

	if ( isLoading ) {
		body = (
			<div aria-hidden className="cnl-page-layouts__grid">
				{ [ 0, 1 ].map( ( key ) => (
					<Skeleton key={ key } style={ { height: 150 } } />
				) ) }
			</div>
		);
	} else {
		body = (
			<ul
				aria-label={ __( 'Layouts' ) }
				className="cnl-page-layouts__grid"
				role="list"
			>
				{ options.map( ( option ) => (
					<LayoutCard
						isSelected={
							Boolean( frontPageTemplate ) ||
							option.value === current
						}
						key={ option.value || 'default' }
						label={ option.label }
						onPick={
							frontPageTemplate
								? undefined
								: () =>
										editEntityRecord(
											'postType',
											'page',
											pageId,
											{
												template: option.value,
											}
										)
						}
						outline={ option.outline }
						sectionCount={ sectionCount }
					/>
				) ) }
			</ul>
		);
	}

	return (
		<section
			aria-label={ __( 'Change layout' ) }
			className="cnl-page-layouts"
		>
			<Text className="cnl-page-sections__hint" variant="body-sm">
				{ frontPageTemplate
					? __(
							'Your homepage always uses this layout. WordPress calls layouts templates.'
						)
					: __(
							'How the page is set out around its sections, like whether the title shows. WordPress calls these templates.'
						) }
			</Text>
			{ body }
		</section>
	);
}

// Typing the title changes the page on every key, but none of what this shows.
export const MemoizedPageLayouts = memo( PageLayouts );
