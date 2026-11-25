/**
 * Points at Edit when someone browsing clicks the page as if to change it:
 * on its words or a picture. The first time, it's an onboarding tip
 * (`src/onboarding/`). Otherwise Edit pulses, in every workspace and even
 * with hints turned off, as it answers the click rather than teaching. A
 * double click goes straight into Edit. Links, menus, buttons and other
 * controls are left to work as they do on the site, and nothing happens
 * while a menu, popover, dialog or the page finder is open. See "Pointing at
 * Edit" in this folder's README.
 */

/**
 * WordPress dependencies
 */
import { speak } from '@wordpress/a11y';

/**
 * Internal dependencies
 */
import { requestOnboardingTip } from '../onboarding/request';
import { EDIT_TIP } from '../onboarding/tip-ids';
import { __, useEffect, useRef } from '../wordpress-packages';

const PULSE_CLASS = 'is-pulsing';
// How long a click waits to see if it's the first of a double click, which
// goes into Edit instead of pointing at it. Without the wait, the spotlight
// would come up between the two clicks and take the second.
const DOUBLE_CLICK_WAIT_MS = 300;

// Anything open over the editor, while which the hint keeps out of the way.
const OPEN_SELECTOR = [
	'.components-popover:not(.components-tooltip)',
	'[role="menu"]',
	'[role="dialog"]',
	'[role="alertdialog"]',
	'.cnl-page-switcher.is-finding',
].join( ',' );

/**
 * @param {Document} doc The editor's document.
 * @return {boolean} Whether a menu, popover, dialog or the page finder is
 *                   open.
 */
function isSomethingOpen( doc ) {
	// The admin bar's own menus are always in the page, and don't count.
	return Array.from( doc.querySelectorAll( OPEN_SELECTOR ) ).some(
		( element ) =>
			! element.closest( '#wpadminbar' ) &&
			element.getClientRects().length > 0
	);
}

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
 * Listens to the preview for a reach to change the page, and points at Edit.
 *
 * @param {Object}    options
 * @param {Object}    options.anchorRef     Ref to the Edit button.
 * @param {?Document} options.frameDocument The page on view, once loaded.
 * @param {boolean}   options.isActive      Whether the page is only on view.
 * @param {Function}  options.onEdit        Starts editing, as Edit does.
 */
export function useEditHint( { anchorRef, frameDocument, isActive, onEdit } ) {
	// Read in the listener, so it isn't added again when it changes.
	const onEditRef = useRef( onEdit );
	onEditRef.current = onEdit;

	useEffect( () => {
		if ( ! isActive || ! frameDocument ) {
			return;
		}

		// Read as the press starts: clicking the preview moves focus out of
		// an open popover, which closes it before the click arrives.
		let wasSomethingOpen = false;
		let hasSpoken = false;
		let clickTimer;
		const onPointerDown = () => {
			wasSomethingOpen = isSomethingOpen( document );
		};
		const pointAtEdit = () => {
			if ( requestOnboardingTip( EDIT_TIP ) ) {
				return;
			}

			pulse( anchorRef.current );

			// Said once on each page, as the pulse can't be seen.
			if ( ! hasSpoken ) {
				hasSpoken = true;
				speak(
					__(
						'To change this page, use the Edit button.',
						'create-not-learn-editor'
					)
				);
			}
		};
		const onClick = ( event ) => {
			if ( ! isEditIntent( event ) || wasSomethingOpen ) {
				return;
			}

			window.clearTimeout( clickTimer );

			if ( event.detail === 2 ) {
				onEditRef.current();
			} else if ( event.detail < 2 ) {
				clickTimer = window.setTimeout(
					pointAtEdit,
					DOUBLE_CLICK_WAIT_MS
				);
			}
		};

		frameDocument.addEventListener( 'pointerdown', onPointerDown, true );
		frameDocument.addEventListener( 'click', onClick );

		return () => {
			frameDocument.removeEventListener(
				'pointerdown',
				onPointerDown,
				true
			);
			frameDocument.removeEventListener( 'click', onClick );
			window.clearTimeout( clickTimer );
		};
	}, [ anchorRef, frameDocument, isActive ] );
}
