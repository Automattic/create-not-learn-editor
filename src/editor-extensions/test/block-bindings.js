/**
 * External dependencies
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const editor = vi.hoisted( () => ( {
	registerCoreBlockBindingsSources: undefined,
	privateApis: {},
} ) );
const privateRegister = vi.hoisted( () => vi.fn() );

vi.mock( '@wordpress/editor', () => editor );
vi.mock( '@wordpress/blocks', () => ( {
	getBlockBindingsSources: () => ( {} ),
	store: {},
} ) );
vi.mock( '@wordpress/data', () => ( { subscribe: () => {} } ) );
vi.mock( '../../lock-unlock', () => ( {
	unlock: ( object ) => {
		if ( object !== editor.privateApis ) {
			throw new Error( 'Cannot unlock an object that was not locked' );
		}
		return object.locked
			? { registerCoreBlockBindingsSources: privateRegister }
			: {};
	},
} ) );

/**
 * Internal dependencies
 */
import { registerCoreSources } from '../block-bindings';

describe( 'registerCoreSources', () => {
	beforeEach( () => {
		editor.registerCoreBlockBindingsSources = undefined;
		editor.privateApis = {};
		privateRegister.mockReset();
	} );

	it( 'uses the editor’s public export, as Gutenberg’s trunk has it', () => {
		const register = vi.fn();
		editor.registerCoreBlockBindingsSources = register;

		registerCoreSources();

		expect( register ).toHaveBeenCalledTimes( 1 );
		expect( privateRegister ).not.toHaveBeenCalled();
	} );

	it( 'falls back to the private API, as Gutenberg 24.0 has it', () => {
		editor.privateApis = { locked: true };

		registerCoreSources();

		expect( privateRegister ).toHaveBeenCalledTimes( 1 );
	} );
} );
