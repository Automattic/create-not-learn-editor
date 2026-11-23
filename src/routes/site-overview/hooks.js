/**
 * Internal dependencies
 */
import { useEffect, useRef, useState } from '../../wordpress-packages';

export function prefersReducedMotion() {
	return Boolean(
		window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches
	);
}

export function useElementSize( ref ) {
	const [ size, setSize ] = useState( { height: 0, width: 0 } );

	useEffect( () => {
		const element = ref.current;

		if ( ! element ) {
			return;
		}

		const update = () =>
			setSize( ( current ) =>
				current.width === element.clientWidth &&
				current.height === element.clientHeight
					? current
					: {
							height: element.clientHeight,
							width: element.clientWidth,
						}
			);

		update();

		if ( ! window.ResizeObserver ) {
			return;
		}

		const observer = new window.ResizeObserver( update );
		observer.observe( element );

		return () => observer.disconnect();
	}, [ ref ] );

	return size;
}

/*
 * Whether the canvas is being panned or zoomed. Cards wait for it to stop
 * before loading or dropping a thumbnail, as building or tearing down a page
 * mid-gesture is what makes it stutter.
 */
const SETTLE_DELAY_MS = 200;
let isCanvasMoving = false;
let settleTimer;
const settleListeners = new Set();

/**
 * Say the canvas has just moved. It counts as moving until it has been still
 * for a moment.
 */
export function markCanvasMoving() {
	isCanvasMoving = true;
	window.clearTimeout( settleTimer );
	settleTimer = window.setTimeout( () => {
		isCanvasMoving = false;
		settleListeners.forEach( ( listener ) => listener() );
	}, SETTLE_DELAY_MS );
}

/**
 * @param {Function} listener Called when the canvas stops moving.
 * @return {Function} Stops listening.
 */
export function subscribeToCanvasSettle( listener ) {
	settleListeners.add( listener );

	return () => settleListeners.delete( listener );
}

/**
 * Whether an element is near the screen: it comes near within half a
 * screen's width or height of it, and only goes away again beyond a whole
 * one, so a card on the edge doesn't flick in and out. Only changes once the
 * canvas is still.
 *
 * @param {Object} ref     Element.
 * @param {Object} rootRef Scrolling ancestor to watch within.
 * @return {boolean} Whether it is near the screen.
 */
export function useIsNear( ref, rootRef ) {
	const [ isNear, setIsNear ] = useState( false );

	useEffect( () => {
		const element = ref.current;

		if ( ! element ) {
			return;
		}

		if ( ! window.IntersectionObserver ) {
			setIsNear( true );
			return;
		}

		let isInside = false;
		let isWithin = false;
		const apply = () => {
			if ( isCanvasMoving ) {
				return;
			}

			setIsNear( ( wasNear ) => ( wasNear ? isWithin : isInside ) );
		};
		const watch = ( margin, onChange ) => {
			const observer = new window.IntersectionObserver(
				( entries ) => {
					onChange( entries[ entries.length - 1 ].isIntersecting );
					apply();
				},
				{ root: rootRef.current, rootMargin: margin }
			);
			observer.observe( element );

			return observer;
		};
		const inner = watch( '50%', ( value ) => ( isInside = value ) );
		const outer = watch( '100%', ( value ) => ( isWithin = value ) );
		const unsubscribe = subscribeToCanvasSettle( apply );

		return () => {
			inner.disconnect();
			outer.disconnect();
			unsubscribe();
		};
	}, [ ref, rootRef ] );

	return isNear;
}

/*
 * How many thumbnails load at once. Each is the whole front end of a page,
 * and the canvas opens fitted to the whole site, so without a limit every
 * page on it would load in the same moment.
 */
const MAX_LOADING_THUMBNAILS = 4;
// A thumbnail that never says it has loaded gives its turn up after this.
const THUMBNAIL_LOAD_TIMEOUT = 15000;
let loadingThumbnails = 0;
const waitingThumbnails = [];

function startNextThumbnail() {
	while (
		loadingThumbnails < MAX_LOADING_THUMBNAILS &&
		waitingThumbnails.length
	) {
		loadingThumbnails++;
		waitingThumbnails.shift()();
	}
}

function releaseThumbnailTurn( turn ) {
	window.clearTimeout( turn.timer );

	if ( turn.isGranted && ! turn.isReleased ) {
		turn.isReleased = true;
		loadingThumbnails--;
		startNextThumbnail();
	}
}

/**
 * Whether a thumbnail may start loading: thumbnails take turns, a few at a
 * time, in the order they ask unless one goes first. Once it may, it keeps
 * its picture.
 *
 * @param {boolean} isWanted Whether the thumbnail wants to load.
 * @param {boolean} isLoaded Whether it has finished loading.
 * @param {boolean} isFirst  Whether it goes ahead of the others waiting.
 * @return {boolean} Whether to load it.
 */
export function useThumbnailTurn( isWanted, isLoaded, isFirst = false ) {
	const [ hasTurn, setHasTurn ] = useState( false );
	// Given up once loaded, gone, or taking too long, and only once.
	const turnRef = useRef( { isGranted: false, isReleased: false } );

	useEffect( () => {
		if ( ! isWanted || hasTurn ) {
			return undefined;
		}

		const turn = turnRef.current;
		const start = () => {
			turn.isGranted = true;
			turn.timer = window.setTimeout(
				() => releaseThumbnailTurn( turn ),
				THUMBNAIL_LOAD_TIMEOUT
			);
			setHasTurn( true );
		};

		if ( isFirst ) {
			waitingThumbnails.unshift( start );
		} else {
			waitingThumbnails.push( start );
		}
		startNextThumbnail();

		return () => {
			const index = waitingThumbnails.indexOf( start );

			if ( index !== -1 ) {
				waitingThumbnails.splice( index, 1 );
			}
		};
	}, [ hasTurn, isFirst, isWanted ] );

	useEffect( () => {
		if ( isLoaded ) {
			releaseThumbnailTurn( turnRef.current );
		}
	}, [ isLoaded ] );

	useEffect( () => () => releaseThumbnailTurn( turnRef.current ), [] );

	return hasTurn;
}
