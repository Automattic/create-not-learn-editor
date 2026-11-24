/**
 * Points at Edit when someone browsing clicks the page as if to change it:
 * on its words or a picture. The first time, the rest of the editor goes dark
 * round Edit, with a popover saying that's where changes are made. After that
 * Edit only pulses. Links, menus, buttons and other controls are left to work
 * as they do on the site. See "Pointing at Edit" in this folder's README.
 */

/**
 * WordPress dependencies
 */
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	createPortal,
	Popover,
	useDispatch,
	useEffect,
	useLayoutEffect,
	useRef,
	useSelect,
	useState,
} from '../wordpress-packages';

const PREFERENCES_SCOPE = 'create-not-learn-editor';
const PREFERENCE_NAME = 'editHintShown';
// Room between Edit and the edge of the light round it.
const SPOTLIGHT_PADDING = 6;
const PULSE_CLASS = 'is-pulsing';

// Whatever works on the site as it is: following, opening, toggling or
// typing. A click in any of these is never a reach to change the page.
const INTERACTIVE_SELECTOR = [
	'a[href]',
	'button',
	'input',
	'select',
	'textarea',
	'label',
	'summary',
	'form',
	'nav',
	'audio',
	'video[controls]',
	'iframe',
	'[contenteditable]',
	'[role="button"]',
	'[role="link"]',
	'[role="menu"]',
	'[role="menuitem"]',
	'[role="tab"]',
	'[role="switch"]',
	'[role="checkbox"]',
	'[role="dialog"]',
	'.wp-block-navigation',
].join( ',' );

// Pictures, which content-only editing lets someone replace.
const IMAGE_SELECTOR = [
	'img',
	'picture',
	'video',
	'.wp-block-cover__background',
	'.wp-block-cover__image-background',
	'.wp-block-media-text__media',
].join( ',' );

/**
 * @param {Document} doc The page.
 * @param {number}   x   Where it was clicked, from the left.
 * @param {number}   y   Where it was clicked, from the top.
 * @return {boolean} Whether a line of words is under the point, not only the
 *                   space round them.
 */
function isOverText( doc, x, y ) {
	let node;

	if ( doc.caretPositionFromPoint ) {
		node = doc.caretPositionFromPoint( x, y )?.offsetNode;
	} else if ( doc.caretRangeFromPoint ) {
		node = doc.caretRangeFromPoint( x, y )?.startContainer;
	}

	if ( ! node || node.nodeType !== node.TEXT_NODE || ! node.data.trim() ) {
		return false;
	}

	const range = doc.createRange();
	range.selectNodeContents( node );

	return Array.from( range.getClientRects() ).some(
		( rect ) =>
			x >= rect.left &&
			x <= rect.right &&
			y >= rect.top &&
			y <= rect.bottom
	);
}

/**
 * @param {MouseEvent} event A click on the page.
 * @return {boolean} Whether it looks like a reach to change words or a
 *                   picture.
 */
export function isEditIntent( event ) {
	const { target } = event;

	if (
		event.button !== 0 ||
		! target?.closest ||
		target.closest( INTERACTIVE_SELECTOR )
	) {
		return false;
	}

	return (
		Boolean( target.closest( IMAGE_SELECTOR ) ) ||
		isOverText( target.ownerDocument, event.clientX, event.clientY )
	);
}

/**
 * Pulses an element, starting again if it is pulsing already.
 *
 * @param {?Element} element The element.
 */
function pulse( element ) {
	if ( ! element ) {
		return;
	}

	element.classList.remove( PULSE_CLASS );
	// Read layout, so taking the class off and putting it back restarts it.
	// eslint-disable-next-line no-unused-expressions
	element.offsetWidth;
	element.classList.add( PULSE_CLASS );
	element.addEventListener(
		'animationend',
		() => element.classList.remove( PULSE_CLASS ),
		{ once: true }
	);
}

/**
 * Keeps an element's place on screen up to date.
 *
 * @param {?Element} element The element.
 * @param {boolean}  isOn    Whether to follow it.
 * @return {?DOMRect} Where it is.
 */
function useRect( element, isOn ) {
	const [ rect, setRect ] = useState( null );

	useLayoutEffect( () => {
		if ( ! isOn || ! element ) {
			setRect( null );
			return;
		}

		const update = () => setRect( element.getBoundingClientRect() );
		const view = element.ownerDocument.defaultView;
		const observer = new view.ResizeObserver( update );

		update();
		observer.observe( element.ownerDocument.body );
		view.addEventListener( 'resize', update );
		view.addEventListener( 'scroll', update, true );

		return () => {
			observer.disconnect();
			view.removeEventListener( 'resize', update );
			view.removeEventListener( 'scroll', update, true );
		};
	}, [ element, isOn ] );

	return rect;
}

/**
 * The editor dark round Edit, with a gap Edit can still be clicked through,
 * and the popover beside it.
 *
 * @param {Object}   props
 * @param {Element}  props.anchor  The Edit button.
 * @param {Function} props.onClose Closes it.
 * @return {?Element} The spotlight.
 */
function Spotlight( { anchor, onClose } ) {
	const rect = useRect( anchor, true );

	if ( ! rect ) {
		return null;
	}

	const hole = {
		left: rect.left - SPOTLIGHT_PADDING,
		top: rect.top - SPOTLIGHT_PADDING,
		width: rect.width + SPOTLIGHT_PADDING * 2,
		height: rect.height + SPOTLIGHT_PADDING * 2,
	};
	const { innerWidth: w, innerHeight: h } = anchor.ownerDocument.defaultView;
	// The dark layer catches clicks everywhere but the gap round Edit.
	const clipPath = `path(evenodd, 'M0 0H${ w }V${ h }H0Z M${ hole.left } ${
		hole.top
	}h${ hole.width }v${ hole.height }h${ -hole.width }Z')`;

	return (
		<>
			{ createPortal(
				<div className="cnl-edit-hint">
					<div
						aria-hidden="true"
						className="cnl-edit-hint__backdrop"
						onClick={ onClose }
						style={ { clipPath } }
					/>
					<div
						aria-hidden="true"
						className="cnl-edit-hint__ring"
						style={ hole }
					/>
				</div>,
				anchor.ownerDocument.body
			) }
			<Popover
				anchor={ anchor }
				className="cnl-edit-hint__popover"
				focusOnMount="firstElement"
				offset={ SPOTLIGHT_PADDING + 8 }
				onClose={ onClose }
				placement="bottom-end"
				role="dialog"
				aria-labelledby="cnl-edit-hint-title"
			>
				<div className="cnl-edit-hint__content">
					<h2
						className="cnl-edit-hint__title"
						id="cnl-edit-hint-title"
					>
						{ __( 'Want to change something?' ) }
					</h2>
					<p className="cnl-edit-hint__text">
						{ __(
							'You’re looking around your site. Click Edit to change its words and pictures.'
						) }
					</p>
					<Button
						__next40pxDefaultSize
						onClick={ onClose }
						variant="secondary"
					>
						{ __( 'Got it' ) }
					</Button>
				</div>
			</Popover>
		</>
	);
}

/**
 * Listens to the preview for a reach to change the page, and points at Edit.
 *
 * @param {Object}    props
 * @param {Object}    props.anchorRef     Ref to the Edit button.
 * @param {?Document} props.frameDocument The page on view, once loaded.
 * @param {boolean}   props.isActive      Whether the page is only on view.
 * @return {?Element} The spotlight, while it shows.
 */
export function EditHint( { anchorRef, frameDocument, isActive } ) {
	const hasShown = useSelect(
		( select ) =>
			Boolean(
				select( preferencesStore ).get(
					PREFERENCES_SCOPE,
					PREFERENCE_NAME
				)
			),
		[]
	);
	const { set } = useDispatch( preferencesStore );
	const [ isOpen, setIsOpen ] = useState( false );
	// Read in the listener, so it isn't added again when these change.
	const stateRef = useRef();
	stateRef.current = { hasShown, isOpen };

	useEffect( () => {
		if ( ! isActive || ! frameDocument ) {
			return;
		}

		const onClick = ( event ) => {
			if ( ! isEditIntent( event ) ) {
				return;
			}

			if ( ! stateRef.current.hasShown ) {
				// Said once: a reload or another visit only pulses.
				set( PREFERENCES_SCOPE, PREFERENCE_NAME, true );
				setIsOpen( true );
			} else if ( ! stateRef.current.isOpen ) {
				pulse( anchorRef.current );
			}
		};

		frameDocument.addEventListener( 'click', onClick );

		return () => frameDocument.removeEventListener( 'click', onClick );
	}, [ anchorRef, frameDocument, isActive, set ] );

	// Going into editing any way, or leaving the page, closes it.
	useEffect( () => {
		if ( ! isActive ) {
			setIsOpen( false );
		}
	}, [ isActive ] );

	if ( ! isOpen || ! isActive || ! anchorRef.current ) {
		return null;
	}

	return (
		<Spotlight
			anchor={ anchorRef.current }
			onClose={ () => setIsOpen( false ) }
		/>
	);
}
