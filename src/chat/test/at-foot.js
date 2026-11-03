/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { isAtFoot } from '../at-foot';

function makeStage( ...names ) {
	const stage = document.createElement( 'div' );
	const children = names.map( ( name ) => {
		const child = document.createElement( 'div' );
		child.className = name;
		stage.append( child );
		return child;
	} );

	return { stage, children };
}

describe( 'isAtFoot', () => {
	test( 'is at the foot when nothing comes after it', () => {
		const {
			children: [ , help ],
		} = makeStage( 'screen', 'help' );

		expect( isAtFoot( help ) ).toBe( true );
	} );

	test( 'is not when a screen was added after it', () => {
		const {
			children: [ help ],
		} = makeStage( 'help', 'chat', 'screen' );

		expect( isAtFoot( help, [] ) ).toBe( false );
	} );

	test( 'ignores what may follow it, like the chat', () => {
		const {
			children: [ , help, chat ],
		} = makeStage( 'screen', 'help', 'chat' );

		expect( isAtFoot( help, [ chat ] ) ).toBe( true );
	} );

	test( 'is not when only some of what follows is ignored', () => {
		const {
			children: [ help, chat ],
		} = makeStage( 'help', 'chat', 'screen' );

		expect( isAtFoot( help, [ chat ] ) ).toBe( false );
	} );
} );
