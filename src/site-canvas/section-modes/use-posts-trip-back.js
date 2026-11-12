/**
 * Manage all posts from a posts section, and picking the section again on
 * the way back.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import {
	__,
	coreDataStore,
	useEffect,
	useRef,
	useState,
} from '../../wordpress-packages';
import { getCanvasFrame, scrollCanvasTo } from '../compose/use-block-rects';
import { STORE_NAME as CANVAS_STORE, setPostsTrip } from '../mode';
import { useHasReadPostsNotice } from './posts-notice';
import { LOAD_WAIT_MS, LOAD_POLL_MS } from './layer-constants';
import { getCurrentRoute } from './layer-helpers';

// Takes the layer's state and actions it needs, by name.
export function usePostsTripBack( {
	editorRef,
	entity,
	registry,
	sectionIds,
	setPickedSection,
} ) {
	/*
	 * Manage all posts: off to the screen of the posts the section lists, noting
	 * the way back. The first time, the notice says why first.
	 */
	const navigate = useNavigate();
	const hasReadPostsNotice = useHasReadPostsNotice();
	const [ postsNotice, setPostsNotice ] = useState( null );
	const entityKey = entity ? `${ entity.postType }:${ entity.postId }` : '';
	const goToPosts = ( clientId, posts ) => {
		const record =
			entity &&
			registry
				.select( coreDataStore )
				.getEditedEntityRecord(
					'postType',
					entity.postType,
					entity.postId
				);
		const title =
			typeof record?.title === 'string'
				? record.title
				: record?.title?.raw;

		setPostsNotice( null );
		setPostsTrip( {
			entity: entityKey,
			label: title || __( 'Your page' ),
			postType: posts.name,
			sectionIndex: sectionIds.indexOf( clientId ),
			to: getCurrentRoute(),
		} );
		navigate( { to: `/types/${ posts.name }/list/all` } );
	};
	const editPosts = ( clientId, posts ) => {
		if ( hasReadPostsNotice ) {
			goToPosts( clientId, posts );
		} else {
			setPostsNotice( { clientId, posts } );
		}
	};

	/*
	 * Back from there, the section is picked again, as it was left. Only a
	 * way back noted before this canvas opened counts: one noted on the way
	 * out is for the next time it opens.
	 */
	const tripRef = useRef( registry.select( CANVAS_STORE ).getPostsTrip() );
	const returnedId =
		tripRef.current?.entity === entityKey
			? sectionIds[ tripRef.current.sectionIndex ]
			: null;
	useEffect( () => {
		if ( ! returnedId ) {
			return;
		}

		tripRef.current = null;
		setPostsTrip( null );
		setPickedSection( returnedId );

		// The page has only just opened: the pictures above the section move
		// it down as they load, so it is scrolled to once they have.
		let waited = 0;
		let timer;
		const scrollOnceLoaded = () => {
			const doc = getCanvasFrame( editorRef.current )?.contentDocument;
			const isLoading =
				! doc ||
				Array.from( doc.images ).some(
					( image ) => image.loading !== 'lazy' && ! image.complete
				);

			if ( isLoading && waited < LOAD_WAIT_MS ) {
				waited += LOAD_POLL_MS;
				timer = setTimeout( scrollOnceLoaded, LOAD_POLL_MS );
				return;
			}

			scrollCanvasTo( editorRef, returnedId );
		};

		scrollOnceLoaded();

		return () => clearTimeout( timer );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ returnedId ] );

	return { postsNotice, setPostsNotice, goToPosts, editPosts };
}
