/**
 * The Classic block, for content written without blocks: posts from the
 * classic editor, and any HTML without block comments.
 *
 * Gutenberg's block editor assets endpoint registers every core block but
 * this one, and leaves out TinyMCE, which it edits with. Without it, such
 * content opens as a missing block. So the block is registered here once
 * those assets have loaded, and made the handler for content without blocks,
 * as `registerCoreBlocks()` does in core's post editor. TinyMCE is heavy and
 * most posts don't need it, so it is only fetched when a Classic block first
 * shows. See docs/editor-workarounds.md.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { useBlockProps } from '@wordpress/block-editor';
import {
	getBlockType,
	getFreeformContentHandlerName,
	registerBlockType,
	setFreeformContentHandlerName,
} from '@wordpress/blocks';
import { RawHTML, useEffect, useState } from '@wordpress/element';

const CLASSIC_BLOCK = 'core/freeform';

let classicEditorPromise;

/**
 * Add HTML core printed to the page, running its scripts in order and
 * skipping any script or stylesheet the page already has.
 *
 * Scripts and their inline parts carry their handle in their ID, as
 * `<handle>-js`, `<handle>-js-before` and so on, both as core prints them and
 * as the editor's assets were loaded.
 *
 * @param {string} html The HTML.
 */
async function addPrintedHtml( html ) {
	const template = document.createElement( 'template' );

	template.innerHTML = html;

	for ( const node of Array.from( template.content.children ) ) {
		const handleId = node.id?.match(
			/^(.+-js)-(before|after|extra|translations)$/
		)?.[ 1 ];

		if (
			( node.id && document.getElementById( node.id ) ) ||
			( handleId && document.getElementById( handleId ) )
		) {
			continue;
		}

		if ( node.tagName !== 'SCRIPT' ) {
			const isStyle = node.tagName === 'LINK' || node.tagName === 'STYLE';

			( isStyle ? document.head : document.body ).appendChild( node );
			continue;
		}

		// Scripts parsed from a template don't run, so each is made again.
		const script = document.createElement( 'script' );

		for ( const { name, value } of Array.from( node.attributes ) ) {
			script.setAttribute( name, value );
		}

		script.textContent = node.textContent;

		if ( script.src ) {
			await new Promise( ( resolve ) => {
				script.onload = resolve;
				script.onerror = () => {
					// eslint-disable-next-line no-console
					console.error( `Failed to load script: ${ script.src }` );
					resolve();
				};
				document.body.appendChild( script );
			} );
		} else {
			document.body.appendChild( script );
		}
	}
}

/**
 * Load TinyMCE and the settings core's post editor gives the Classic block,
 * once.
 *
 * @return {Promise<void>} Resolves when the block can be edited.
 */
export function loadClassicEditor() {
	if ( ! classicEditorPromise ) {
		classicEditorPromise = apiFetch( {
			path: '/create-not-learn-editor/v1/classic-block-assets',
		} )
			.then( ( { html } ) => addPrintedHtml( html ) )
			.catch( ( error ) => {
				classicEditorPromise = undefined;
				throw error;
			} );
	}

	return classicEditorPromise;
}

function isClassicEditorLoaded() {
	return !! (
		window.tinymce &&
		window.wpEditorL10n &&
		window.wp?.editor?.getDefaultSettings
	);
}

/**
 * Until TinyMCE has loaded, the block shows its content as the block itself
 * does, so nothing moves when it is swapped in, but without the block's
 * controls, which would open TinyMCE.
 *
 * @param {Object} props         Block props.
 * @param {Object} props.content The block's HTML.
 * @return {Element} The content.
 */
function ClassicBlockPreview( { content } ) {
	return (
		<div { ...useBlockProps() }>
			<RawHTML>{ content }</RawHTML>
		</div>
	);
}

/**
 * The block's own edit, once TinyMCE has loaded.
 *
 * @param {Function} Edit The block's edit component.
 * @return {Function} The edit component to register.
 */
function withClassicEditor( Edit ) {
	return function ClassicBlockEdit( props ) {
		const [ isLoaded, setIsLoaded ] = useState( isClassicEditorLoaded );

		useEffect( () => {
			if ( isLoaded ) {
				return;
			}

			let isMounted = true;

			loadClassicEditor()
				.then( () => isMounted && setIsLoaded( true ) )
				.catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'Failed to load the Classic block:', error );
				} );

			return () => {
				isMounted = false;
			};
		}, [ isLoaded ] );

		if ( ! isLoaded ) {
			return <ClassicBlockPreview content={ props.attributes.content } />;
		}

		return <Edit { ...props } />;
	};
}

/**
 * Register the Classic block, from the block library the editor's assets
 * loaded, and make it the handler for content without blocks.
 *
 * Done only where core would: when the old editor's script, which the
 * assets include, is there to edit with, and nothing else has taken the
 * block or the handler.
 */
export function registerClassicBlock() {
	if (
		getBlockType( CLASSIC_BLOCK ) ||
		getFreeformContentHandlerName() ||
		! window.wp?.oldEditor
	) {
		return;
	}

	const classicBlock = window.wp.blockLibrary
		?.__experimentalGetCoreBlocks?.()
		.find( ( { name } ) => name === CLASSIC_BLOCK );

	if ( ! classicBlock ) {
		return;
	}

	/*
	 * As its `init()` registers it, with the edit wrapped. Not through the
	 * `blocks.registerBlockType` filter, since adding one runs every block
	 * type registered so far through the filters again. Left out of the
	 * inserter, where the editor has never offered it: it is for content
	 * that already exists.
	 */
	const { metadata, settings } = classicBlock;

	try {
		// In the settings, which win over the server's copy of the metadata.
		registerBlockType(
			{ name: CLASSIC_BLOCK, ...metadata },
			{
				...settings,
				supports: { ...metadata.supports, inserter: false },
				edit: withClassicEditor( settings.edit ),
			}
		);
		setFreeformContentHandlerName( CLASSIC_BLOCK );
	} catch ( error ) {
		// The editor still opens without it, as it did before.
		// eslint-disable-next-line no-console
		console.error( 'Failed to register the Classic block:', error );
	}
}
