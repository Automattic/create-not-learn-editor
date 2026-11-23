// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
	compare,
	formatReport,
	measure,
} from '../../scripts/performance-budget.mjs';

const dirs = [];

function makeBuild( files ) {
	const dir = fs.mkdtempSync( path.join( os.tmpdir(), 'cnl-budget-' ) );
	dirs.push( dir );
	for ( const [ file, content ] of Object.entries( files ) ) {
		fs.mkdirSync( path.dirname( path.join( dir, file ) ), {
			recursive: true,
		} );
		fs.writeFileSync( path.join( dir, file ), content );
	}
	return dir;
}

const asset = ( scripts, modules = [] ) =>
	`<?php return array('dependencies' => array(${ scripts
		.map( ( s ) => `'${ s }'` )
		.join( ', ' ) }), 'module_dependencies' => array(${ modules
		.map( ( m ) => `array('id' => '${ m }', 'import' => 'static')` )
		.join( ', ' ) }), 'version' => 'abc');`;

afterEach( () => {
	dirs.splice( 0 ).forEach( ( dir ) =>
		fs.rmSync( dir, { recursive: true, force: true } )
	);
} );

describe( 'performance budget', () => {
	it( 'measures minified files and dependencies, skipping unminified and RTL files', () => {
		const head = measure(
			makeBuild( {
				'routes/home/content.js': 'x'.repeat( 5000 ),
				'routes/home/content.min.js': 'x'.repeat( 2000 ),
				'routes/home/content.min.asset.php': asset(
					[ 'react', 'wp-data' ],
					[ '@wordpress/route' ]
				),
				'styles/app-init/style.min.css': 'a{}',
				'styles/app-init/style-rtl.min.css': 'a{}',
			} )
		);

		expect( [ ...head.keys() ] ).toEqual( [
			'routes/home/content.dependencies',
			'routes/home/content.js',
			'styles/app-init/style.css',
			'total.js',
			'total.css',
		] );
		expect( head.get( 'routes/home/content.js' ).raw ).toBe( 2000 );
		expect( head.get( 'routes/home/content.dependencies' ).list ).toEqual( [
			'react',
			'wp-data',
			'@wordpress/route',
		] );
	} );

	it( 'fails what is over budget or missing, and names changed dependencies', () => {
		const random = ( n ) =>
			Array.from( { length: n }, () =>
				Math.random().toString( 36 ).slice( 2 )
			).join( '' );
		const base = measure(
			makeBuild( {
				'routes/home/content.min.js': random( 100 ),
				'routes/home/content.min.asset.php': asset( [ 'react' ] ),
			} )
		);
		const head = measure(
			makeBuild( {
				'routes/home/content.min.js': random( 400 ),
				'routes/home/content.min.asset.php': asset( [
					'react',
					'wp-editor',
				] ),
			} )
		);
		const budgets = {
			'routes/home/content.js': 1000,
			'routes/home/content.dependencies': 1,
			'routes/gone/content.js': 1000,
		};

		const result = compare( { head, base, budgets } );

		expect( result.over.map( ( i ) => i.name ) ).toEqual( [
			'routes/home/content.js',
			'routes/home/content.dependencies',
		] );
		expect( result.missing ).toEqual( [ 'routes/gone/content.js' ] );
		expect(
			result.changes.find(
				( c ) => c.name === 'routes/home/content.dependencies'
			).added
		).toEqual( [ 'wp-editor' ] );

		const report = formatReport( { head, base, budgets, result } );
		expect( report ).toContain( '### Over budget' );
		expect( report ).toContain( 'adds wp-editor' );
	} );
} );
