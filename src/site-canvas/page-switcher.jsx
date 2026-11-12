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
 * The bar's tooltip is the page's address.
 */

/**
 * WordPress dependencies
 */
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';
import { getStatusLabel, POST_STATUS_ICONS } from '../post-status';
import {
	__,
	searchIcon,
	Tooltip,
	sprintf,
	useEffect,
	useRef,
	useState,
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
 * @param {Object}  props
 * @param {string}  props.title  The page's name.
 * @param {?string} props.status The page's status, like `draft`, when it is
 *                               a post with one.
 * @param {?string} props.meta   More to say after the name, like what the
 *                               homepage shows.
 * @param {?string} props.url    The page's address on the live site, for the
 *                               bar's tooltip, when it has one.
 * @return {Element} The switcher.
 */
export function PageSwitcher( { title, status = '', meta = '', url = '' } ) {
	const [ isFinding, setIsFinding ] = useState( false );
	const toggleRef = useRef();
	const shouldRefocus = useRef( false );
	const statusIcon = POST_STATUS_ICONS[ status ];
	const statusLabel = statusIcon ? getStatusLabel( status ) : '';

	// Escape hands focus back to the bar, rather than losing it to the body.
	useEffect( () => {
		if ( ! isFinding && shouldRefocus.current ) {
			shouldRefocus.current = false;
			toggleRef.current?.focus();
		}
	}, [ isFinding ] );

	return (
		<div
			className={ [ 'cnl-page-switcher', isFinding && 'is-finding' ]
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
					placeholder={ __( 'Go to page…' ) }
				/>
			) : (
				// Still the screen's heading, as the page's name was before it
				// became a button.
				<h1 className="cnl-page-switcher__heading">
					<Tooltip.Root disabled={ ! url }>
						<Tooltip.Trigger
							aria-label={ sprintf(
								/* translators: %s: The name of the page on show, and its status. */
								__( '%s. Go to another page' ),
								[ title, statusLabel ]
									.filter( Boolean )
									.join( ', ' )
							) }
							className="cnl-page-switcher__toggle"
							onClick={ () => setIsFinding( true ) }
							ref={ toggleRef }
							render={ <button type="button" /> }
						>
							<Icon
								className="cnl-page-switcher__search"
								icon={ searchIcon }
								size={ 20 }
							/>
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
						</Tooltip.Trigger>
						{ /* Below, as the bar is at the top of the window. */ }
						<Tooltip.Popup
							positioner={ <Tooltip.Positioner side="bottom" /> }
						>
							{ getReadableUrl( url ) }
						</Tooltip.Popup>
					</Tooltip.Root>
					{ /*
					 * Over the bar's end rather than in it, so it has a
					 * tooltip of its own. The bar's name already says the
					 * status, so it is hidden from screen readers, and a
					 * click on it opens the finder as the bar does.
					 */ }
					{ statusIcon && (
						<Tooltip.Root>
							<Tooltip.Trigger
								aria-hidden
								className={ `cnl-page-switcher__status is-${ status }` }
								onClick={ () => setIsFinding( true ) }
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
 * @return {Object} `{ title, status, meta, url }` for `PageSwitcher`.
 */
export function getPreviewSwitcherProps( {
	isLoadingContext,
	previewContext,
	liveUrl,
} ) {
	const title = previewContext?.previewLabel || __( 'Home' );
	const url = liveUrl || '';

	if ( isLoadingContext ) {
		return { title, url, meta: __( 'Loading preview details' ) };
	}

	// The homepage is live whatever it shows.
	const status =
		previewContext?.previewStatus === 'homepage'
			? 'publish'
			: previewContext?.previewStatus;

	if ( POST_STATUS_ICONS[ status ] ) {
		return { title, status, url };
	}

	return {
		title,
		url,
		meta: [
			previewContext?.previewTypeLabel,
			previewContext?.previewStatusLabel || __( 'Preview' ),
		]
			.filter( Boolean )
			.join( ' · ' ),
	};
}
