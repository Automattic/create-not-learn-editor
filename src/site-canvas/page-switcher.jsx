/**
 * The page on show, named in the middle of the canvas toolbar, in a bar
 * shaped like the finder's search field, its search icon in the same place:
 * it says where you are, and clicking it turns it into the page finder (see
 * `src/page-finder`) to go somewhere else, as a browser's address bar does.
 * It took over from the top bar's Go to page field, so the field and the
 * list it opens are one box, as they were there.
 *
 * The page's status is an icon at the bar's end, core's icon for it, named
 * in its own tooltip and in the bar's name, so a long name keeps its room.
 * For a page, the icon is a button that opens the page's settings
 * (`page-settings.jsx`). The bar's tooltip is the page's address.
 *
 * Layouts and template parts use the same bar. What sets them apart is that
 * changing one changes every page that uses it, so in place of a status they
 * get a purple filled symbol, the mark Review changes gives site-wide changes,
 * with a tooltip saying where changes show, and their name in the same purple.
 * A template part's bar doesn't open the finder: while one is open, going
 * to a page isn't what the screen is for.
 */

/**
 * WordPress dependencies
 */
import { symbolFilled as symbolFilledIcon } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';
import { PageSettings } from './page-settings';
import { getStatusLabel, POST_STATUS_ICONS } from '../post-status';
import {
	__,
	searchIcon,
	Tooltip,
	sprintf,
	useEffect,
	useRef,
	useState,
	VisuallyHidden,
} from '../wordpress-packages';

/**
 * An address as people read it, with letters like é rather than the codes
 * they are sent as.
 *
 * @param {string} url The address.
 * @return {string} The address to show.
 */
function getReadableUrl( url ) {
	try {
		return decodeURI( url );
	} catch {
		return url;
	}
}

/**
 * @param {Object}   props
 * @param {string}   props.title     The page's name.
 * @param {?string}  props.status    The page's status, like `draft`, when it is
 *                                   a post with one.
 * @param {?string}  props.meta      More to say after the name, like what the
 *                                   homepage shows.
 * @param {?string}  props.url       The page's address on the live site, for the
 *                                   bar's tooltip, when it has one.
 * @param {?number}  props.pageId    The page's ID, when it is a page, whose
 *                                   settings its status then opens.
 * @param {?string}  props.shared    For a layout or template part, where changes
 *                                   to it show. Marks the bar as shared.
 * @param {?boolean} props.canSwitch Whether clicking the bar opens the page
 *                                   finder. Without it, the bar only names
 *                                   what is open.
 * @return {Element} The switcher.
 */
export function PageSwitcher( {
	title,
	status = '',
	meta = '',
	url = '',
	pageId = 0,
	shared = '',
	canSwitch = true,
} ) {
	const [ isFinding, setIsFinding ] = useState( false );
	const toggleRef = useRef();
	const shouldRefocus = useRef( false );
	const statusIcon = shared ? symbolFilledIcon : POST_STATUS_ICONS[ status ];
	const statusLabel =
		shared || ( statusIcon ? getStatusLabel( status ) : '' );
	const openFinder = canSwitch ? () => setIsFinding( true ) : undefined;
	const label = (
		<span className="cnl-page-switcher__label">
			<span className="cnl-page-switcher__title cnl-editor-homepage-document__title">
				{ title }
			</span>
			{ meta && (
				<span className="cnl-page-switcher__meta cnl-editor-homepage-document__meta">
					{ meta }
				</span>
			) }
		</span>
	);

	// Escape hands focus back to the bar, rather than losing it to the body.
	useEffect( () => {
		if ( ! isFinding && shouldRefocus.current ) {
			shouldRefocus.current = false;
			toggleRef.current?.focus();
		}
	}, [ isFinding ] );

	return (
		<div
			className={ [
				'cnl-page-switcher',
				isFinding && 'is-finding',
				shared && 'is-shared',
				! canSwitch && 'is-static',
			]
				.filter( Boolean )
				.join( ' ' ) }
		>
			{ isFinding ? (
				<PageFinder
					startsOpen
					className="cnl-page-switcher__finder"
					onDone={ ( { isEscape } ) => {
						shouldRefocus.current = isEscape;
						setIsFinding( false );
					} }
					placeholder={ __(
						'Go to page…',
						'create-not-learn-editor'
					) }
				/>
			) : (
				// Still the screen's heading, as the page's name was before it
				// became a button.
				<h1 className="cnl-page-switcher__heading">
					{ canSwitch ? (
						<Tooltip.Root disabled={ ! url }>
							<Tooltip.Trigger
								aria-label={ sprintf(
									/* translators: %s: The name of the page on show, and its status. */
									__(
										'%s. Go to another page',
										'create-not-learn-editor'
									),
									[ title, statusLabel ]
										.filter( Boolean )
										.join( ', ' )
								) }
								className="cnl-page-switcher__toggle"
								onClick={ openFinder }
								ref={ toggleRef }
								render={ <button type="button" /> }
							>
								<Icon
									className="cnl-page-switcher__search"
									icon={ searchIcon }
									size={ 20 }
								/>
								{ label }
							</Tooltip.Trigger>
							{ /* Below, as the bar is at the top of the window. */ }
							<Tooltip.Popup
								positioner={
									<Tooltip.Positioner side="bottom" />
								}
							>
								{ getReadableUrl( url ) }
							</Tooltip.Popup>
						</Tooltip.Root>
					) : (
						<div className="cnl-page-switcher__toggle">
							{ label }
							{ shared && (
								<VisuallyHidden>{ shared }</VisuallyHidden>
							) }
						</div>
					) }
					{ /*
					 * Over the bar's end rather than in it, so it has a
					 * tooltip of its own. A page's opens its settings.
					 */ }
					{ statusIcon && pageId > 0 && (
						<PageSettings
							pageId={ pageId }
							status={ status }
							statusIcon={ statusIcon }
							statusLabel={ statusLabel }
						/>
					) }
					{ /*
					 * Anything else's only says the status. The bar's name
					 * already does, so it is hidden from screen readers,
					 * and a click on it opens the finder as the bar does.
					 */ }
					{ statusIcon && ! pageId && (
						<Tooltip.Root>
							<Tooltip.Trigger
								aria-hidden
								className={ `cnl-page-switcher__status is-${
									shared ? 'shared' : status
								}` }
								onClick={ openFinder }
								render={ <span /> }
							>
								<Icon icon={ statusIcon } size={ 20 } />
							</Tooltip.Trigger>
							<Tooltip.Popup
								positioner={
									<Tooltip.Positioner side="bottom" />
								}
							>
								{ statusLabel }
							</Tooltip.Popup>
						</Tooltip.Root>
					) }
				</h1>
			) }
		</div>
	);
}

/**
 * What the switcher says for the page a preview shows, from its context (see
 * `includes/preview-context.php`): a post's status as its icon, or, for what
 * has none, like a layout, what it is in words.
 *
 * @param {Object}  canvas                  Result of `useSiteCanvas`.
 * @param {boolean} canvas.isLoadingContext Whether the context is loading.
 * @param {?Object} canvas.previewContext   The preview's context.
 * @param {string}  canvas.liveUrl          The live page's address, if any.
 * @return {Object} `{ title, status, meta, url, pageId }` for `PageSwitcher`.
 */
export function getPreviewSwitcherProps( {
	isLoadingContext,
	previewContext,
	liveUrl,
} ) {
	const title =
		previewContext?.previewLabel || __( 'Home', 'create-not-learn-editor' );
	const url = liveUrl || '';

	if ( isLoadingContext ) {
		return {
			title,
			url,
			meta: __( 'Loading preview details', 'create-not-learn-editor' ),
		};
	}

	// The homepage is live whatever it shows.
	const status =
		previewContext?.previewStatus === 'homepage'
			? 'publish'
			: previewContext?.previewStatus;

	if ( POST_STATUS_ICONS[ status ] ) {
		const pageId =
			previewContext?.editPostType === 'page'
				? Number( previewContext.editPostId ) || 0
				: 0;

		return { title, status, url, pageId };
	}

	return {
		title,
		url,
		meta: [
			previewContext?.previewTypeLabel,
			previewContext?.previewStatusLabel ||
				__( 'Preview', 'create-not-learn-editor' ),
		]
			.filter( Boolean )
			.join( ' · ' ),
	};
}
