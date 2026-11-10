/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { memo, useEffect, useMemo, useRef } from '@wordpress/element';

const upstreamModuleUrl =
	window.createNotLearnEditor?.lazyEditorModuleUrl || '';

if ( ! upstreamModuleUrl ) {
	throw new Error( 'The Gutenberg lazy editor module URL is unavailable.' );
}

const upstream = await import( /* webpackIgnore: true */ upstreamModuleUrl );

const UpstreamEditor = upstream.Editor;

/**
 * Preserve lazy-editor's resolved theme and global styles when boot supplies
 * route-specific editor settings.
 *
 * Gutenberg PR #79581 fixes this in the package by merging both style arrays.
 * Released Gutenberg 23.5.1 replaces the resolved styles instead, so remove
 * boot's style override until the upstream fix is available in the dependency.
 *
 * @param {Object} props          Editor props, passed on to the lazy editor.
 * @param {number} props.postId   ID of the post being edited.
 * @param {string} props.postType Type of the post being edited.
 * @param {Object} props.settings Route-specific editor settings.
 * @return {Element} The released lazy editor with compatible settings.
 */
function CompatibleEditor( {
	postId: givenPostId,
	postType: givenPostType,
	settings,
	...props
} ) {
	/*
	 * Given no post, as Gutenberg's own Styles screen leaves it, the editor
	 * shows the homepage. When that is a page, it is resolved here as well,
	 * so its blocks are loaded like any other page's below. Otherwise the
	 * editor is left to resolve it, to a template, which needs nothing here.
	 */
	const { homePageId, isResolvingHomePage } = useSelect(
		( select ) => {
			if ( givenPostId || givenPostType ) {
				return { homePageId: null, isResolvingHomePage: false };
			}

			const { getEntityRecord, hasFinishedResolution } =
				select( coreDataStore );
			const site = getEntityRecord( 'root', 'site' );
			return {
				homePageId:
					site?.show_on_front === 'page' && site.page_on_front
						? site.page_on_front
						: null,
				isResolvingHomePage: ! hasFinishedResolution(
					'getEntityRecord',
					[ 'root', 'site' ]
				),
			};
		},
		[ givenPostId, givenPostType ]
	);
	const postId = givenPostId || homePageId || undefined;
	const postType = givenPostType || ( homePageId ? 'page' : undefined );
	const initializedEntities = useRef( new Set() );
	const entityKey = `${ postType || '' }:${ postId || '' }`;
	/*
	 * Whether there are blocks, not the blocks themselves. The editor writes
	 * them back on every keystroke, and this wraps the whole editor, which
	 * would re-render with it each time.
	 */
	const { hasBlocks, hasUndefinedContentEdit, rawContent } = useSelect(
		( select ) => {
			if ( ! postId || ! postType ) {
				return {};
			}

			const store = select( coreDataStore );
			const edits =
				store.getEntityRecordNonTransientEdits(
					'postType',
					postType,
					postId
				) || {};
			return {
				hasBlocks: !! store.getEditedEntityRecord(
					'postType',
					postType,
					postId
				)?.blocks?.length,
				rawContent: store.getEntityRecord(
					'postType',
					postType,
					postId,
					{ context: 'edit' }
				)?.content?.raw,
				hasUndefinedContentEdit:
					Object.hasOwn( edits, 'content' ) &&
					edits.content === undefined,
			};
		},
		[ postId, postType ]
	);
	const { editEntityRecord } = useDispatch( coreDataStore );
	const compatibleSettings = useMemo( () => {
		if ( ! settings || ! Object.hasOwn( settings, 'styles' ) ) {
			return settings;
		}

		const { styles: _routeStyles, ...restSettings } = settings;
		return restSettings;
	}, [ settings ] );

	useEffect( () => {
		if ( ! postId || ! postType || typeof rawContent !== 'string' ) {
			return;
		}

		if ( initializedEntities.current.has( entityKey ) ) {
			if ( ! hasUndefinedContentEdit ) {
				return;
			}

			const timeout = window.setTimeout( () => {
				editEntityRecord(
					'postType',
					postType,
					postId,
					{ content: rawContent },
					{ undoIgnore: true }
				);
			} );
			return () => window.clearTimeout( timeout );
		}

		if ( hasBlocks ) {
			const timeout = window.setTimeout( () => {
				initializedEntities.current.add( entityKey );
				if ( hasUndefinedContentEdit ) {
					editEntityRecord(
						'postType',
						postType,
						postId,
						{ content: rawContent },
						{ undoIgnore: true }
					);
				}
			}, 500 );
			return () => window.clearTimeout( timeout );
		}

		/*
		 * No blocks in the record is how core starts: the editor parses the
		 * content itself and only stores blocks once they are changed
		 * (`useEntityBlockEditor`). Writing a parse of our own here gave every
		 * block new client IDs while the editor was still mounting the first
		 * ones, so their block list settings landed on blocks that had gone.
		 */
		initializedEntities.current.add( entityKey );
	}, [
		editEntityRecord,
		entityKey,
		hasBlocks,
		hasUndefinedContentEdit,
		postId,
		postType,
		rawContent,
	] );

	// Waits for the homepage, so the editor doesn't start on one entity and
	// remount on another.
	if ( isResolvingHomePage ) {
		return null;
	}

	return (
		<UpstreamEditor
			{ ...props }
			key={ entityKey }
			postId={ postId }
			postType={ postType }
			settings={ compatibleSettings }
		/>
	);
}

/*
 * Memoised because nothing below it is. A host re-rendering for reasons of its
 * own, such as a hover in the panel beside the canvas, would otherwise render
 * the whole editor again with it.
 */
export const Editor = memo( CompatibleEditor );

export const Preview = upstream.Preview;
export const loadEditorAssets = upstream.loadEditorAssets;
export const useEditorAssets = upstream.useEditorAssets;
export const useEditorSettings = upstream.useEditorSettings;
