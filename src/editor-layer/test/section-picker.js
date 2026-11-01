/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { EditorPreview } from '../section-picker';

vi.mock( '@wordpress/block-editor', () => {
	const BlockPreview = () => null;

	BlockPreview.Async = ( { children } ) => children;

	return { BlockPreview, store: 'core/block-editor' };
} );
// Only the preview is tested, so the picker and what it adds are left out.
vi.mock( '../../section-picker', () => ( {} ) );
vi.mock( '../../routes/content/page-layouts', () => ( {} ) );
vi.mock( '../../routes/content/pages/page-sections', () => ( {} ) );
vi.mock( '@wordpress/notices', () => ( { store: 'core/notices' } ) );
// Markup parses to nothing here, as no markup is what a card passes.
vi.mock( '../../pickers/preview-blocks', () => ( {
	usePreviewBlocks: () => [],
} ) );

describe( 'EditorPreview', () => {
	// Section design cards hand their preview the blocks they have already
	// prepared, not the pattern's markup. A preview that looked for markup
	// drew nothing, and the cards showed their loading outline for good.
	it( 'previews the blocks the card passes', () => {
		const blocks = [ { name: 'core/paragraph', attributes: {} } ];
		const preview = EditorPreview( { blocks, description: 'Hero' } );

		expect( preview.props.children.props.blocks ).toBe( blocks );
	} );
} );
