/**
 * A pointer to Edit while the page is on view, for people who move over the
 * site looking for a way to change it. Until someone has used Edit, a notice
 * is drawn around the real Edit button; once they have, ever, Edit pulses
 * instead. See "Pointing to Edit" in this folder's README.
 */

/**
 * WordPress dependencies
 *
 * Imported here rather than through `src/wordpress-packages.js`, as other
 * features importing preferences do: added there, they become a dependency of
 * every route, over the performance budget.
 */
import { speak } from '@wordpress/a11y';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	closeSmallIcon,
	dispatch,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useSelect,
	useState,
} from '../wordpress-packages';
import { getEditHint, setEditHint, useEditHint } from './mode';

const PREFERENCES_SCOPE = 'create-not-learn-editor';
const PREFERENCE_NAME = 'editButtonUsed';

// How long the pointer can be off the site before its visit ends.
const LEAVE_MS = 1000;
// As long as the pulse's animation, three rings of 600ms.
const PULSE_MS = 1800;
// Room around Edit inside the notice.
const PAD = 8;

// Only one canvas, so one notice, is on the page at a time.
const TEXT_ID = 'cnl-edit-hint-text';

const NOTICE_TEXT = () => __( 'Trying to change something on this page?' );

// Anything open over the editor, while which the hint keeps out of the way:
// popovers other than tooltips, menus, dialogs and the page finder.
const OPEN_SELECTOR = [
	'.components-popover:not(.components-tooltip)',
	'[role="menu"]',
	'[role="dialog"]',
	'[role="alertdialog"]',
	'.cnl-page-switcher.is-finding',
].join( ',' );

function isSomethingOpen() {
	// The admin bar's own menus are always in the page, and don't count.
	return Array.from( document.querySelectorAll( OPEN_SELECTOR ) ).some(
		( element ) =>
			! element.closest( '#wpadminbar' ) &&
			element.getClientRects().length > 0
	);
}

/**
 * Note that Edit has been used, so the notice is never shown again.
 */
export function rememberEditUsed() {
	dispatch( preferencesStore ).set(
		PREFERENCES_SCOPE,
		PREFERENCE_NAME,
		true
	);
}

/**
 * Where the notice goes, around the Edit button, in the toolbar's terms.
 *
 * @param {Element} toolbar The toolbar.
 * @return {?Object} Its offsets and padding, or null without an Edit button.
 */
function measure( toolbar ) {
	const edit = toolbar?.querySelector( '.cnl-site-canvas__edit' );

	if ( ! edit ) {
		return null;
	}

	const bar = toolbar.getBoundingClientRect();
	const button = edit.getBoundingClientRect();
	// Trimmed where the padding would cross the toolbar's edge.
	const padTop = Math.max( 0, Math.min( PAD, button.top - bar.top ) );
	const padRight = Math.max( 0, Math.min( PAD, bar.right - button.right ) );

	return {
		height: button.height + padTop + PAD,
		maxWidth: button.right + padRight - bar.left - PAD,
		// Room for Edit, which shows through, and the gap before it.
		paddingRight: button.width + padRight + PAD,
		right: bar.right - button.right - padRight,
		top: button.top - bar.top - padTop,
	};
}

/**
 * Watches the pointer over the site while the page is on view, and says
 * whether to show the notice around Edit or pulse Edit.
 *
 * Mouse and pen only: a touch has no hover, so on touch nothing happens.
 *
 * @param {Object}  options
 * @param {boolean} options.isActive   Whether the page is on view with
 *                                     Edit offered.
 * @param {Object}  options.previewRef Ref to the preview's area.
 * @param {Object}  options.toolbarRef Ref to the toolbar.
 * @return {Object} `{ isPulsing, notice }`, `notice` being the props for
 *                  `EditHintNotice`, or null while it is hidden.
 */
export function useEditHintState( { isActive, previewRef, toolbarRef } ) {
	const hasUsedEdit = useSelect(
		( select ) =>
			Boolean(
				select( preferencesStore ).get(
					PREFERENCES_SCOPE,
					PREFERENCE_NAME
				)
			),
		[]
	);
	const hintState = useEditHint();
	const [ isShown, setIsShown ] = useState( false );
	const [ isPulsing, setIsPulsing ] = useState( false );
	const noticeRef = useRef();
	const visitRef = useRef( false );
	const leaveTimer = useRef();
	const pulseTimer = useRef();
	const isShownRef = useRef( false );

	const show = useCallback( ( next ) => {
		isShownRef.current = next;
		setIsShown( next );
	}, [] );

	const canShowNotice =
		isActive && ! hasUsedEdit && hintState !== 'dismissed';

	// Gone as soon as the page stops being on view, or Edit is used.
	useEffect( () => {
		if ( ! canShowNotice ) {
			show( false );
		}
	}, [ canShowNotice, show ] );

	useEffect( () => {
		if ( ! isActive ) {
			setIsPulsing( false );
			visitRef.current = false;
		}
	}, [ isActive ] );

	useEffect(
		() => () => {
			clearTimeout( leaveTimer.current );
			clearTimeout( pulseTimer.current );
		},
		[]
	);

	useEffect( () => {
		if ( ! isActive ) {
			return;
		}

		const isWithinNotice = ( event ) => {
			const rect =
				isShownRef.current &&
				noticeRef.current?.getBoundingClientRect();

			return (
				!! rect &&
				event.clientX >= rect.left &&
				event.clientX <= rect.right &&
				event.clientY >= rect.top &&
				event.clientY <= rect.bottom
			);
		};

		const pulse = () => {
			setIsPulsing( true );
			clearTimeout( pulseTimer.current );
			pulseTimer.current = setTimeout(
				() => setIsPulsing( false ),
				PULSE_MS
			);
		};

		// The pointer moved over the site, or over the notice.
		const onInside = ( event, isOverSite ) => {
			clearTimeout( leaveTimer.current );
			leaveTimer.current = null;

			const isNewVisit = ! visitRef.current;
			visitRef.current = true;

			if ( ! isOverSite || event.buttons ) {
				return;
			}

			// What is open is looked for only when about to act, not on every
			// movement.
			if ( hasUsedEdit ) {
				if ( isNewVisit && ! isSomethingOpen() ) {
					pulse();
				}
			} else if (
				canShowNotice &&
				! isShownRef.current &&
				! isSomethingOpen()
			) {
				show( true );

				if ( ! getEditHint() ) {
					setEditHint( 'shown' );
					speak( NOTICE_TEXT() );
				}
			}
		};

		const onOutside = () => {
			if ( ! visitRef.current || leaveTimer.current ) {
				return;
			}

			const leave = () => {
				// Kept while keyboard focus is on its ×.
				if (
					noticeRef.current?.contains(
						noticeRef.current.ownerDocument.activeElement
					)
				) {
					leaveTimer.current = setTimeout( leave, LEAVE_MS );
					return;
				}

				leaveTimer.current = null;
				visitRef.current = false;
				show( false );
			};

			leaveTimer.current = setTimeout( leave, LEAVE_MS );
		};

		// Over the site's own page. Its events don't reach the editor's
		// document, so the preview's page is listened to as well.
		const onFrameMove = ( event ) => {
			if ( event.pointerType !== 'touch' ) {
				onInside( event, true );
			}
		};
		const onFrameOut = ( event ) => {
			if ( event.pointerType !== 'touch' && ! event.relatedTarget ) {
				onOutside();
			}
		};
		// Over the editor: around the preview's page, as round a phone's,
		// counts as the site, and the notice keeps it going.
		const onMove = ( event ) => {
			if ( event.pointerType === 'touch' ) {
				return;
			}

			if ( previewRef.current?.contains( event.target ) ) {
				onInside( event, true );
			} else if ( isWithinNotice( event ) ) {
				onInside( event, false );
			} else {
				onOutside();
			}
		};
		const onOut = ( event ) => {
			if ( event.pointerType !== 'touch' && ! event.relatedTarget ) {
				onOutside();
			}
		};
		// Something opened from under the notice, like the View menu or the
		// page finder, puts it away.
		const onPress = () => {
			window.requestAnimationFrame( () => {
				if ( isShownRef.current && isSomethingOpen() ) {
					show( false );
				}
			} );
		};

		// The preview's page is replaced with each page shown, and its iframe
		// can be too, so the listeners move to the page there now when it
		// loads, and when the pointer comes onto the iframe, as a page still
		// loading a slow picture hasn't sent its load yet.
		const preview = previewRef.current;
		let frameDocument = null;
		const listenToFrame = () => {
			let next = null;

			try {
				next = preview?.querySelector( 'iframe' )?.contentDocument;
			} catch {
				// Not the site's own page, so it can't be listened to.
			}

			if ( next === frameDocument ) {
				return;
			}

			frameDocument?.removeEventListener(
				'pointermove',
				onFrameMove,
				true
			);
			frameDocument?.removeEventListener(
				'pointerout',
				onFrameOut,
				true
			);
			frameDocument?.defaultView?.removeEventListener(
				'pagehide',
				onFrameHide
			);
			frameDocument = next || null;
			frameDocument?.addEventListener( 'pointermove', onFrameMove, true );
			frameDocument?.addEventListener( 'pointerout', onFrameOut, true );
			frameDocument?.defaultView?.addEventListener(
				'pagehide',
				onFrameHide
			);
		};
		// Going to another page in the preview, as by a link, the pointer
		// may stay on it: the next page is listened to as soon as it is
		// there, not when it has loaded.
		let pageTimer;
		const onFrameHide = () => {
			const hidden = frameDocument;
			let tries = 0;
			const check = () => {
				listenToFrame();

				const isWaiting =
					! frameDocument ||
					frameDocument === hidden ||
					frameDocument.URL.startsWith( 'about:' );

				if ( isWaiting && tries++ < 100 ) {
					pageTimer = setTimeout( check, 100 );
				}
			};

			clearTimeout( pageTimer );
			pageTimer = setTimeout( check, 100 );
		};
		const onOver = ( event ) => {
			if (
				event.target.tagName === 'IFRAME' &&
				preview?.contains( event.target )
			) {
				listenToFrame();
			}
		};

		listenToFrame();
		preview?.addEventListener( 'load', listenToFrame, true );
		document.addEventListener( 'pointerover', onOver, true );
		document.addEventListener( 'pointermove', onMove, true );
		document.addEventListener( 'pointerout', onOut, true );
		document.addEventListener( 'click', onPress, true );
		document.addEventListener( 'keyup', onPress, true );

		return () => {
			clearTimeout( pageTimer );
			preview?.removeEventListener( 'load', listenToFrame, true );
			document.removeEventListener( 'pointerover', onOver, true );
			frameDocument?.removeEventListener(
				'pointermove',
				onFrameMove,
				true
			);
			frameDocument?.removeEventListener(
				'pointerout',
				onFrameOut,
				true
			);
			frameDocument?.defaultView?.removeEventListener(
				'pagehide',
				onFrameHide
			);
			document.removeEventListener( 'pointermove', onMove, true );
			document.removeEventListener( 'pointerout', onOut, true );
			document.removeEventListener( 'click', onPress, true );
			document.removeEventListener( 'keyup', onPress, true );
		};
	}, [ isActive, canShowNotice, hasUsedEdit, previewRef, show ] );

	const dismiss = useCallback( () => {
		const hadFocus = noticeRef.current?.contains(
			noticeRef.current.ownerDocument.activeElement
		);

		setEditHint( 'dismissed' );
		show( false );

		// Focus stays where it was going, on Edit, rather than the body.
		if ( hadFocus ) {
			toolbarRef.current
				?.querySelector( '.cnl-site-canvas__edit' )
				?.focus();
		}
	}, [ show, toolbarRef ] );

	return {
		isPulsing: isActive && hasUsedEdit && isPulsing,
		notice:
			canShowNotice && isShown
				? { noticeRef, onDismiss: dismiss, toolbarRef }
				: null,
	};
}

/**
 * The notice, a card drawn around the real Edit button, which stays where it
 * is and on top, so pressing Edit through the card is Edit itself. The card
 * lets the pointer through to the toolbar under it, all but its ×.
 *
 * @param {Object}   props
 * @param {Object}   props.noticeRef  Ref for the card.
 * @param {Function} props.onDismiss  Called by the ×.
 * @param {Object}   props.toolbarRef Ref to the toolbar it is drawn in.
 * @return {Element} The card.
 */
export function EditHintNotice( { noticeRef, onDismiss, toolbarRef } ) {
	const [ place, setPlace ] = useState( null );

	useLayoutEffect( () => {
		const toolbar = toolbarRef.current;
		const update = () => setPlace( measure( toolbar ) );

		update();

		const observer = new window.ResizeObserver( update );

		observer.observe( toolbar );
		window.addEventListener( 'resize', update );

		return () => {
			observer.disconnect();
			window.removeEventListener( 'resize', update );
		};
	}, [ toolbarRef ] );

	if ( ! place ) {
		return null;
	}

	return (
		<div
			aria-labelledby={ TEXT_ID }
			className="cnl-edit-hint"
			ref={ noticeRef }
			role="note"
			style={ {
				height: place.height,
				maxWidth: place.maxWidth,
				paddingRight: place.paddingRight,
				right: place.right,
				top: place.top,
			} }
		>
			<p className="cnl-edit-hint__text" id={ TEXT_ID }>
				{ NOTICE_TEXT() }
			</p>
			{ /* Shown at the card's left end, so it doesn't cover the
			controls beside Edit, like View. After the words in the
			source, so they are read first. */ }
			<Button
				className="cnl-edit-hint__close"
				icon={ closeSmallIcon }
				label={ __( 'Close the tip about Edit' ) }
				onClick={ onDismiss }
				size="compact"
			/>
		</div>
	);
}
