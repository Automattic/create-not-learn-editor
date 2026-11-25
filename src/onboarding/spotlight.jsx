/**
 * WordPress dependencies
 */
import { Button, CheckboxControl, Popover } from '@wordpress/components';
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { setShowsHints } from './preferences';

// Room between the control and the edge of the light round it.
const PADDING = 6;

/**
 * Keeps an element's place on screen up to date, as the layout round it
 * changes, the window resizes or anything scrolls.
 *
 * @param {Element} element The element.
 * @return {DOMRect} Where it is.
 */
function useRect( element ) {
	const [ rect, setRect ] = useState( () => element.getBoundingClientRect() );

	useLayoutEffect( () => {
		const update = () => setRect( element.getBoundingClientRect() );
		const view = element.ownerDocument.defaultView;
		const observer = new view.ResizeObserver( update );

		update();
		observer.observe( element );
		observer.observe( element.ownerDocument.body );
		view.addEventListener( 'resize', update );
		view.addEventListener( 'scroll', update, true );

		return () => {
			observer.disconnect();
			view.removeEventListener( 'resize', update );
			view.removeEventListener( 'scroll', update, true );
		};
	}, [ element ] );

	return rect;
}

const prefersReducedMotion = () =>
	window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches;

/**
 * A tip: the rest of the editor dark round the control it's about, and beside
 * the control, a short looping video of it with what it's for.
 *
 * The dark layer catches clicks everywhere but a gap round the control, cut
 * out with `clip-path`, so the control can still be used straight away. Using
 * it, Got it, Escape or a click on the dark layer closes the tip. Its
 * checkbox turns every hint off, for good, until Preferences turns them on.
 *
 * @param {Object}   props         Component props.
 * @param {Object}   props.tip     The tip (see `registerOnboardingTip`).
 * @param {Element}  props.target  The control.
 * @param {Function} props.onClose Close the tip.
 * @return {Element} The tip.
 */
export function Spotlight( { tip, target, onClose } ) {
	const rect = useRect( target );
	const reduceMotion = prefersReducedMotion();
	const [ isOptedOut, setIsOptedOut ] = useState( false );
	const gotItRef = useRef();

	// Got it first, not the opt-out before it, so a stray Space or Enter
	// only closes the tip. Once the popover has placed itself.
	useEffect( () => {
		const frame = window.requestAnimationFrame( () =>
			gotItRef.current?.focus()
		);
		return () => window.cancelAnimationFrame( frame );
	}, [] );
	const { innerWidth: width, innerHeight: height } =
		target.ownerDocument.defaultView;
	const hole = {
		left: rect.left - PADDING,
		top: rect.top - PADDING,
		width: rect.width + PADDING * 2,
		height: rect.height + PADDING * 2,
	};
	const clipPath = `path(evenodd, 'M0 0H${ width }V${ height }H0Z M${
		hole.left
	} ${ hole.top }h${ hole.width }v${ hole.height }h${ -hole.width }Z')`;

	useEffect( () => {
		target.addEventListener( 'click', onClose );
		return () => target.removeEventListener( 'click', onClose );
	}, [ target, onClose ] );

	return (
		<>
			<div className="cnl-onboarding__overlay">
				<div
					aria-hidden="true"
					className="cnl-onboarding__backdrop"
					onClick={ onClose }
					style={ { clipPath } }
				/>
				<div
					aria-hidden="true"
					className="cnl-onboarding__ring"
					style={ hole }
				/>
			</div>
			<Popover
				className="cnl-onboarding"
				anchor={ target }
				placement={ tip.placement ?? 'top' }
				offset={ PADDING + 8 }
				onClose={ onClose }
				shift
				resize={ false }
				focusOnMount
				role="dialog"
				aria-labelledby="cnl-onboarding-title"
				aria-describedby="cnl-onboarding-description"
			>
				<div className="cnl-onboarding__content">
					{ tip.video && (
						<video
							className="cnl-onboarding__video"
							src={ tip.video }
							autoPlay={ ! reduceMotion }
							controls={ reduceMotion }
							muted
							loop
							playsInline
							preload="auto"
							aria-hidden={ ! reduceMotion }
						/>
					) }
					<div className="cnl-onboarding__text">
						<h2
							id="cnl-onboarding-title"
							className="cnl-onboarding__title"
						>
							{ tip.title }
						</h2>
						<p
							id="cnl-onboarding-description"
							className="cnl-onboarding__description"
						>
							{ tip.description }
						</p>
					</div>
					<div className="cnl-onboarding__actions">
						<CheckboxControl
							__nextHasNoMarginBottom
							className="cnl-onboarding__opt-out"
							label={ __(
								'Don’t show hints like these',
								'create-not-learn-editor'
							) }
							checked={ isOptedOut }
							onChange={ ( isChecked ) => {
								// Saved straight away, so it holds even if the
								// page is left with the tip open.
								setIsOptedOut( isChecked );
								setShowsHints( ! isChecked );
							} }
						/>
						<Button
							ref={ gotItRef }
							__next40pxDefaultSize
							variant="primary"
							onClick={ onClose }
						>
							{ __( 'Got it', 'create-not-learn-editor' ) }
						</Button>
					</div>
				</div>
			</Popover>
		</>
	);
}
