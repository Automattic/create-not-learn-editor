/**
 * WordPress dependencies
 */
import { useLinkProps } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { DesignPage } from './design-page';
import SitePreviewCanvas from './site-preview';
import ScreenLinks from '../../screen-links';
import {
	FONT_LIBRARY_PATH,
	FONT_LIBRARY_TABS,
	selectFontLibraryTab,
} from '../../font-library';
import {
	FontPicker,
	LookPicker,
	PalettePicker,
	useStylesData,
} from '../../pickers/styles';
import {
	Link,
	Spinner,
	Text,
	__,
	cloudDownloadIcon,
	colorIcon,
	coreDataStore,
	siteLogoIcon,
	sprintf,
	typographyIcon,
	uploadIcon,
	useSelect,
} from '../../wordpress-packages';

/*
 * Design leads with the site look, the one choice that changes everything at
 * once, and links on to the screens for the finer choices.
 */
const DESIGN_LINKS = [
	{
		description: __( 'Pick the colors your whole site uses.' ),
		icon: colorIcon,
		title: __( 'Colors' ),
		to: '/design/colors',
	},
	{
		description: __( 'Pick the fonts your whole site uses.' ),
		icon: typographyIcon,
		title: __( 'Fonts' ),
		to: '/design/fonts',
	},
	{
		description: __( 'Name your site and add a logo.' ),
		icon: siteLogoIcon,
		title: __( 'Name & logo' ),
		to: '/design/identity',
	},
];

/**
 * The way out to Gutenberg's full Styles editor, which the editor mounts at
 * `/styles` (`includes/gutenberg-routes.php`), as Builder's Home does.
 *
 * @return {Node} The line.
 */
function FullStylesLink() {
	const { href, onClick } = useLinkProps( { to: '/styles' } );

	return (
		<Text className="routes-styles__muted" variant="body-sm">
			{ __( 'Want more control? Every style setting is in the' ) }{ ' ' }
			<Link href={ href } onClick={ onClick }>
				{ __( 'full Styles editor' ) }
			</Link>
			.
		</Text>
	);
}

/**
 * The font library's tabs, as rows under the Fonts screen's pairings.
 * Installing and uploading need permission to add fonts, as in the font
 * library itself, and installing needs a font collection to choose from.
 *
 * @return {?Node} The rows, once it's known which this person can use.
 */
function FontLibraryLinks() {
	const { canAddFonts, collection } = useSelect( ( select ) => {
		const core = select( coreDataStore );
		// The font library's own query, so a collection whose fonts can't be
		// fetched is left out here as it is there, and the answer is shared.
		const collections = core.getEntityRecords( 'root', 'fontCollection', {
			_fields: 'slug,name,description',
		} );

		return {
			canAddFonts: core.canUser( 'create', {
				kind: 'postType',
				name: 'wp_font_family',
			} ),
			// Google Fonts, unless a plugin has swapped in others.
			collection:
				collections?.find( ( { slug } ) => slug === 'google-fonts' ) ??
				collections?.[ 0 ],
		};
	}, [] );

	const link = ( tabId, fields ) => ( {
		...fields,
		onSelect: () => selectFontLibraryTab( tabId ),
		to: FONT_LIBRARY_PATH,
	} );
	const links = [
		link( FONT_LIBRARY_TABS.library, {
			description: __(
				'Turn fonts and their styles on or off, or remove them.'
			),
			icon: typographyIcon,
			title: __( 'Configure fonts' ),
		} ),
		canAddFonts &&
			collection &&
			link( collection.slug, {
				description: __( 'Choose from hundreds of free fonts.' ),
				icon: cloudDownloadIcon,
				title: __( 'Install fonts' ),
			} ),
		canAddFonts &&
			link( FONT_LIBRARY_TABS.upload, {
				description: __( 'Add font files from your computer.' ),
				icon: uploadIcon,
				title: __( 'Upload fonts' ),
			} ),
	].filter( Boolean );

	return <ScreenLinks label={ __( 'More font options' ) } links={ links } />;
}

/**
 * The shell every styles screen shares: its title, the live-preview layout,
 * and a way out to where there's more.
 *
 * @param {Object}  props             Component props.
 * @param {Node}    props.children    The screen's options, once loaded.
 * @param {string}  props.description Sentence under the title.
 * @param {boolean} props.isLoading   Whether the theme's styles are still loading.
 * @param {boolean} props.isTopLevel  Whether this is the Design screen itself.
 * @param {Node}    props.moreLink    The way out, below the options. The full
 *                                    Styles editor unless given.
 * @param {string}  props.title       Screen title.
 * @return {Node} The screen.
 */
function StylesScreen( {
	children,
	description,
	isLoading,
	isTopLevel,
	moreLink = <FullStylesLink />,
	title,
} ) {
	return (
		<DesignPage
			description={ description }
			isTopLevel={ isTopLevel }
			title={ title }
		>
			{ isLoading && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ ! isLoading && children }
			{ ! isLoading && moreLink }
		</DesignPage>
	);
}

export function DesignStage() {
	const { isLoading } = useStylesData();

	return (
		<StylesScreen
			description={ __( 'How your whole site looks.' ) }
			isLoading={ isLoading }
			isTopLevel
			title={ __( 'Design' ) }
		>
			<LookPicker />
			<ScreenLinks
				label={ __( 'More design options' ) }
				links={ DESIGN_LINKS }
			/>
		</StylesScreen>
	);
}

function getThemeDescription( themeName, template ) {
	return themeName
		? sprintf( template, themeName )
		: __( 'Changes the whole site at once.' );
}

export function ColorsStage() {
	const { isLoading, themeName } = useStylesData();

	return (
		<StylesScreen
			description={ getThemeDescription(
				themeName,
				/* translators: %s: Theme name. */
				__(
					'Changes the whole site at once. Your theme, %s, provides these palettes.'
				)
			) }
			isLoading={ isLoading }
			title={ __( 'Colors' ) }
		>
			<PalettePicker allowCustom />
		</StylesScreen>
	);
}

export function FontsStage() {
	const { isLoading, themeName } = useStylesData();

	return (
		<StylesScreen
			description={ getThemeDescription(
				themeName,
				/* translators: %s: Theme name. */
				__(
					'Changes the whole site at once. Your theme, %s, provides these pairings.'
				)
			) }
			isLoading={ isLoading }
			moreLink={ <FontLibraryLinks /> }
			title={ __( 'Fonts' ) }
		>
			<FontPicker />
		</StylesScreen>
	);
}

export function StylesCanvas() {
	return <SitePreviewCanvas />;
}
