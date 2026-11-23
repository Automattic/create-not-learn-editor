/**
 * Internal dependencies
 */
import {
	getItemCountLabel,
	getNodeIcon,
	getNodeKindLabel,
	hasNotableStatus,
	isDynamicNode,
} from './data';
import {
	CARD_WIDTH,
	THUMBNAIL_VIEWPORT_HEIGHT,
	THUMBNAIL_VIEWPORT_WIDTH,
} from './layout';
import { useIsNear, useThumbnailTurn } from './hooks';
import {
	freezeThumbnail,
	getSnapshot,
	subscribeToSnapshots,
} from './snapshots';
import { getPreviewFrameUrl } from '../../site-canvas/urls';
import {
	Icon,
	__,
	memo,
	useEffect,
	useRef,
	useState,
} from '../../wordpress-packages';

const THUMBNAIL_SCALE = CARD_WIDTH / THUMBNAIL_VIEWPORT_WIDTH;

function getPlaceholderText( node ) {
	if ( node.kind === 'single' && ! node.count ) {
		return __( 'Nothing to show yet' );
	}

	if ( ! node.previewUrl ) {
		return __( 'Not on your site yet' );
	}

	return '';
}

/**
 * A small picture of the page: the real front end, unsaved changes and all,
 * scaled down.
 *
 * It loads once it comes near the screen, a few at a time, and is then
 * frozen: the running page is swapped for a copy without its scripts
 * (`snapshots.js`). Far from the screen it shows nothing at all.
 *
 * @param {Object}  props         Component props.
 * @param {boolean} props.isReady Whether the site has the unsaved changes.
 * @param {Object}  props.node    Site Overview node.
 * @param {Object}  props.rootRef The canvas's viewport.
 * @return {Element} Thumbnail.
 */
function Thumbnail( { isReady, node, rootRef } ) {
	const ref = useRef();
	const src = node.previewUrl ? getPreviewFrameUrl( node.previewUrl ) : '';
	const isNear = useIsNear( ref, rootRef );
	const [ snapshot, setSnapshot ] = useState( () =>
		getSnapshot( node.id, src )
	);
	const [ isLoaded, setIsLoaded ] = useState( Boolean( snapshot ) );
	const hasTurn = useThumbnailTurn(
		Boolean( src ) && isReady && isNear && ! snapshot,
		isLoaded
	);
	const placeholderText = getPlaceholderText( node );

	useEffect(
		() =>
			subscribeToSnapshots( () => {
				setSnapshot( getSnapshot( node.id, src ) );
				setIsLoaded( false );
			} ),
		[ node.id, src ]
	);

	async function onLiveLoad( event ) {
		const iframe = event.currentTarget;

		// Web fonts may still be on their way once the page has loaded.
		try {
			await iframe.contentDocument?.fonts?.ready;
		} catch {}

		setSnapshot( freezeThumbnail( node.id, src, iframe ) );
		setIsLoaded( true );
	}

	const frameStyle = {
		height: THUMBNAIL_VIEWPORT_HEIGHT,
		transform: `scale(${ THUMBNAIL_SCALE })`,
		width: THUMBNAIL_VIEWPORT_WIDTH,
	};

	let frame = null;

	if ( isNear && snapshot ) {
		frame = (
			<iframe
				className="cnl-site-overview-card__frame"
				data-tier="snapshot"
				// No scripts: it is only a picture.
				sandbox="allow-same-origin"
				srcDoc={ snapshot }
				style={ frameStyle }
				tabIndex={ -1 }
				title={ node.title }
			/>
		);
	} else if ( isNear && src && hasTurn ) {
		frame = (
			<iframe
				className="cnl-site-overview-card__frame"
				data-tier="live"
				onLoad={ onLiveLoad }
				src={ src }
				style={ frameStyle }
				tabIndex={ -1 }
				title={ node.title }
			/>
		);
	}

	return (
		<div
			aria-hidden
			className={ `cnl-site-overview-card__thumbnail${
				isLoaded && frame ? ' is-loaded' : ''
			}` }
			ref={ ref }
		>
			<div className="cnl-site-overview-card__placeholder">
				<Icon icon={ getNodeIcon( node ) } size={ 32 } />
				{ placeholderText && (
					<span className="cnl-site-overview-card__placeholder-text">
						{ placeholderText }
					</span>
				) }
			</div>
			{ frame }
		</div>
	);
}

function SiteOverviewCard( {
	dropPosition,
	group,
	isActive,
	isDragged,
	isRelated,
	isSelected,
	isThumbnailReady,
	node,
	onDragStart,
	onFocusCard,
	onHover,
	onOpen,
	onSelect,
	rootRef,
} ) {
	const kindLabel = getNodeKindLabel( node );
	const className = [
		'cnl-site-overview-card',
		`is-${ node.kind }`,
		isDynamicNode( node ) && 'is-dynamic',
		hasNotableStatus( node ) && 'is-unpublished',
		isSelected && 'is-selected',
		isActive && 'is-active',
		isRelated && 'is-related',
		node.kind === 'page' && 'is-draggable',
		isDragged && 'is-dragged',
		dropPosition && `is-drop-${ dropPosition }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div
			className={ className }
			data-node-id={ node.id }
			onDoubleClick={ () => onOpen( node ) }
			onMouseEnter={ () => onHover( node.id ) }
			onMouseLeave={ () => onHover( '' ) }
			onPointerDown={ ( event ) => onDragStart( event, node ) }
			style={ {
				height: node.height,
				left: node.x,
				top: node.y,
				width: node.width,
			} }
		>
			<Thumbnail
				isReady={ isThumbnailReady }
				node={ node }
				rootRef={ rootRef }
			/>
			<div className="cnl-site-overview-card__caption">
				<button
					aria-current={ isSelected ? 'true' : undefined }
					className="cnl-site-overview-card__select"
					onClick={ () => onSelect( node.id ) }
					onFocus={ () => onFocusCard( node ) }
					type="button"
				>
					<span className="cnl-site-overview-card__title">
						{ node.title }
					</span>
					<span className="screen-reader-text">{ `, ${ kindLabel }` }</span>
				</button>
				<div aria-hidden className="cnl-site-overview-card__meta">
					<Icon icon={ getNodeIcon( node ) } size={ 16 } />
					<span>{ kindLabel }</span>
					{ node.kind === 'single' && (
						<span className="cnl-site-overview-card__count">
							{ getItemCountLabel( node.count, group ) }
						</span>
					) }
					{ hasNotableStatus( node ) && (
						<span className="cnl-site-overview-card__status">
							{ node.statusLabel }
						</span>
					) }
				</div>
			</div>
		</div>
	);
}

/*
 * The map's contents only change with the layout, the selection and hover.
 * Memoised so that panning and zooming, which re-render the map on every
 * wheel or pointer event, only move the world rather than redraw it.
 */
export const MemoizedSiteOverviewCard = memo( SiteOverviewCard );
