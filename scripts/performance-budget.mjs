#!/usr/bin/env node
/**
 * Checks the build against the performance budget in
 * `tests/performance/budgets.json`, and compares it with another build when
 * given one. Prints a Markdown report and exits 1 when anything is over its
 * budget. See docs/performance-budget.md.
 *
 *     node scripts/performance-budget.mjs [--build build] [--base ../base/build]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);

// A size has to move this much, and by this many bytes, before the report
// points at it. The build is the same on every run, so this only keeps
// rounding noise out of the list.
const SIZE_CHANGE_RATIO = 0.01;
const SIZE_CHANGE_BYTES = 500;

function walk( dir ) {
	return fs
		.readdirSync( dir, { withFileTypes: true } )
		.flatMap( ( entry ) => {
			const full = path.join( dir, entry.name );
			return entry.isDirectory() ? walk( full ) : [ full ];
		} );
}

function readDependencies( source ) {
	const scripts = source.match( /'dependencies'\s*=>\s*array\(([^)]*)\)/ );
	const modules = source.match(
		/'module_dependencies'\s*=>\s*array\(((?:[^()]|\([^)]*\))*)\)/
	);
	return [
		...( scripts
			? [ ...scripts[ 1 ].matchAll( /'([^']+)'/g ) ].map(
					( m ) => m[ 1 ]
				)
			: [] ),
		...( modules
			? [ ...modules[ 1 ].matchAll( /'id'\s*=>\s*'([^']+)'/g ) ].map(
					( m ) => m[ 1 ]
				)
			: [] ),
	];
}

/**
 * Measures what WordPress serves with SCRIPT_DEBUG off: every minified script
 * and style sheet, as it is and gzipped, and the scripts and modules each
 * entry asks WordPress for.
 *
 * @param {string} buildDir Build folder.
 * @return {Map<string, Object>} Indicators by name.
 */
export function measure( buildDir ) {
	const indicators = new Map();
	const totals = { js: 0, css: 0 };

	for ( const full of walk( buildDir ).sort() ) {
		const file = path
			.relative( buildDir, full )
			.split( path.sep )
			.join( '/' );

		// Right-to-left sheets are the same size as their counterparts.
		const asset = file.match( /^(.*)\.min\.(js|css)$/ );
		if ( asset && ! file.includes( '-rtl.' ) ) {
			const content = fs.readFileSync( full );
			const gzip = zlib.gzipSync( content, { level: 9 } ).length;
			const name = `${ asset[ 1 ] }.${ asset[ 2 ] }`;
			indicators.set( name, {
				name,
				kind: 'size',
				value: gzip,
				raw: content.length,
			} );
			totals[ asset[ 2 ] ] += gzip;
		}

		const meta = file.match( /^(.*)\.min\.asset\.php$/ );
		if ( meta ) {
			const list = readDependencies( fs.readFileSync( full, 'utf8' ) );
			const name = `${ meta[ 1 ] }.dependencies`;
			indicators.set( name, {
				name,
				kind: 'count',
				value: list.length,
				list,
			} );
		}
	}

	for ( const [ type, value ] of Object.entries( totals ) ) {
		const name = `total.${ type }`;
		indicators.set( name, { name, kind: 'size', value } );
	}

	return indicators;
}

/**
 * Checks head against the budgets, and against base when there is one.
 *
 * @param {Object}        options
 * @param {Map}           options.head    Head's indicators.
 * @param {Map|undefined} options.base    Base's indicators.
 * @param {Object}        options.budgets Most each budgeted indicator may be.
 * @return {Object} What is over budget, unmeasured, changed and unbudgeted.
 */
export function compare( { head, base, budgets } ) {
	const over = [];
	const missing = [];
	for ( const [ name, budget ] of Object.entries( budgets ) ) {
		const indicator = head.get( name );
		if ( ! indicator ) {
			missing.push( name );
		} else if ( indicator.value > budget ) {
			over.push( { ...indicator, budget } );
		}
	}

	const unbudgeted = [ ...head.keys() ].filter(
		( name ) => ! ( name in budgets )
	);

	const changes = [];
	if ( base ) {
		for ( const [ name, now ] of head ) {
			const before = base.get( name );
			if ( ! before ) {
				changes.push( { name, note: 'new' } );
				continue;
			}
			if ( now.kind === 'count' ) {
				const added = now.list.filter(
					( d ) => ! before.list.includes( d )
				);
				const removed = before.list.filter(
					( d ) => ! now.list.includes( d )
				);
				if ( added.length || removed.length ) {
					changes.push( { name, before, now, added, removed } );
				}
				continue;
			}
			const delta = now.value - before.value;
			if (
				Math.abs( delta ) >= SIZE_CHANGE_BYTES &&
				Math.abs( delta ) >= before.value * SIZE_CHANGE_RATIO
			) {
				changes.push( { name, before, now } );
			}
		}
		for ( const name of base.keys() ) {
			if ( ! head.has( name ) ) {
				changes.push( { name, note: 'removed' } );
			}
		}
	}

	return { over, missing, unbudgeted, changes };
}

const kb = ( bytes ) => `${ ( bytes / 1000 ).toFixed( 1 ) } kB`;

function show( indicator, value = indicator.value ) {
	return indicator.kind === 'count' ? String( value ) : kb( value );
}

function signed( indicator, delta ) {
	const sign = delta > 0 ? '+' : '';
	return indicator.kind === 'count'
		? `${ sign }${ delta }`
		: `${ sign }${ kb( delta ) }`;
}

/**
 * @param {Object}        options
 * @param {Map}           options.head    Head's indicators.
 * @param {Map|undefined} options.base    Base's indicators.
 * @param {Object}        options.budgets Budgets.
 * @param {Object}        options.result  What `compare()` returned.
 * @return {string} The report, as Markdown.
 */
export function formatReport( { head, base, budgets, result } ) {
	const { over, missing, unbudgeted, changes } = result;
	const lines = [ '## Performance budget', '' ];

	if ( ! over.length && ! missing.length ) {
		lines.push( 'Everything is within its budget.', '' );
	}

	if ( over.length ) {
		lines.push(
			'### Over budget',
			'',
			'| Indicator | Now | Budget | Over by |',
			'|---|---:|---:|---:|',
			...over.map(
				( i ) =>
					`| \`${ i.name }\` | ${ show( i ) } | ${ show(
						i,
						i.budget
					) } | ${ signed( i, i.value - i.budget ) } |`
			),
			'',
			'Make it smaller, or, if the rise is meant, raise its number in `tests/performance/budgets.json` in this pull request and say why.',
			''
		);
	}

	if ( missing.length ) {
		lines.push(
			'### Budgeted but not built',
			'',
			...missing.map( ( name ) => `- \`${ name }\`` ),
			'',
			'Remove its budget if the file has gone on purpose.',
			''
		);
	}

	if ( base ) {
		lines.push( '### Changes against base', '' );
		if ( ! changes.length ) {
			lines.push( 'Nothing moved.', '' );
		} else {
			lines.push(
				'| Indicator | Base | Head | Change |',
				'|---|---:|---:|---|'
			);
			for ( const c of changes ) {
				if ( c.note ) {
					const i = head.get( c.name ) ?? base.get( c.name );
					lines.push(
						c.note === 'new'
							? `| \`${ c.name }\` | | ${ show( i ) } | new |`
							: `| \`${ c.name }\` | ${ show( i ) } | | removed |`
					);
					continue;
				}
				const delta = c.now.value - c.before.value;
				let change = signed( c.now, delta );
				if ( c.now.kind === 'size' ) {
					change += ` (${ (
						( delta / c.before.value ) *
						100
					).toFixed( 1 ) }%)`;
				}
				if ( c.added?.length ) {
					change += `, adds ${ c.added.join( ', ' ) }`;
				}
				if ( c.removed?.length ) {
					change += `, drops ${ c.removed.join( ', ' ) }`;
				}
				lines.push(
					`| \`${ c.name }\` | ${ show( c.before ) } | ${ show(
						c.now
					) } | ${ change } |`
				);
			}
			lines.push( '' );
		}
	}

	if ( unbudgeted.length ) {
		lines.push(
			'### Without a budget',
			'',
			'Only the totals cover these. Add a budget for any that should have its own.',
			'',
			...unbudgeted.map( ( name ) => `- \`${ name }\`` ),
			''
		);
	}

	lines.push(
		'<details><summary>Every indicator</summary>',
		'',
		'Sizes are gzipped, as served with `SCRIPT_DEBUG` off.',
		'',
		'| Indicator | Head | Budget | Minified |',
		'|---|---:|---:|---:|',
		...[ ...head.values() ].map(
			( i ) =>
				`| \`${ i.name }\` | ${ show( i ) } | ${
					i.name in budgets ? show( i, budgets[ i.name ] ) : ''
				} | ${ i.raw ? kb( i.raw ) : '' } |`
		),
		'',
		'</details>',
		''
	);

	return lines.join( '\n' );
}

function readArgs( argv ) {
	const args = {
		build: path.join( repoRoot, 'build' ),
		budgets: path.join( repoRoot, 'tests/performance/budgets.json' ),
	};
	for ( let i = 0; i < argv.length; i++ ) {
		const key = argv[ i ].replace( /^--/, '' );
		if ( ! [ 'build', 'base', 'budgets' ].includes( key ) ) {
			throw new Error( `Unknown option ${ argv[ i ] }` );
		}
		args[ key ] = path.resolve( argv[ ++i ] );
	}
	return args;
}

function main() {
	const args = readArgs( process.argv.slice( 2 ) );
	for ( const dir of [ args.build, args.base ].filter( Boolean ) ) {
		if ( ! fs.existsSync( dir ) ) {
			process.stderr.write(
				`No build at ${ dir }. Run the build first.\n`
			);
			process.exit( 1 );
		}
	}

	const { budgets } = JSON.parse( fs.readFileSync( args.budgets, 'utf8' ) );
	const head = measure( args.build );
	const base = args.base ? measure( args.base ) : undefined;
	const result = compare( { head, base, budgets } );

	process.stdout.write( formatReport( { head, base, budgets, result } ) );
	process.exit( result.over.length || result.missing.length ? 1 : 0 );
}

if ( process.argv[ 1 ] === fileURLToPath( import.meta.url ) ) {
	main();
}
