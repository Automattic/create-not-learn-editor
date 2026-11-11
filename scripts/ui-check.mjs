#!/usr/bin/env node
/**
 * Open an editor path in a logged-in browser, run a few steps, print a short
 * text summary of the page and optionally save a screenshot to `.context/`.
 *
 * This is the default way for agents to check the UI, so that nobody writes
 * Playwright scripts or login code inline. Run `npm run ui -- --help`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire( import.meta.url );
const { chromium } = require( '@playwright/test' );
const globalSetup = require( '../tests/e2e/global-setup.js' );
const { STORAGE_STATE_PATH } = globalSetup;

const ROOT = path.join(
	path.dirname( fileURLToPath( import.meta.url ) ),
	'..'
);
const EDITOR_PATH = '/wp-admin/admin.php?page=create-not-learn-editor';

const HELP = `Usage: npm run ui -- [path] [options]

  path               Editor path. "/..." opens as is; anything else is added
                     to the editor URL, e.g. "p=/pages" or "workspace=writing".
                     Defaults to the editor.

Steps, run in the order given (repeatable):
  --click <target>   Click a button, link, tab or menu item by its accessible
                     name, or a CSS selector prefixed "css=".
  --fill <t>=<text>  Fill a field found by label/placeholder (or "css=...").
  --press <key>      Press a key, e.g. Escape or Meta+k.
  --hover <target>   Hover a target, as --click.
  --wait <ms|target> Wait milliseconds, or until a target is visible.
  --canvas           Run later steps inside the editor canvas iframe.
  --page             Run later steps on the page again (the default).

Output:
  --shot [name]      Save .context/<name>.jpg (default "ui"), 1x JPEG.
  --clip <css>       Clip the screenshot to this element.
  --size <w>x<h>     Viewport size. Default 1440x900.
  --base <url>       Site URL. Default WP_BASE_URL, else wp-env's development
                     port (--tests for the tests site).
  --headed           Show the browser.
`;

function parseArgs( argv ) {
	const options = {
		steps: [],
		size: [ 1440, 900 ],
		shot: null,
		clip: null,
		base: process.env.WP_BASE_URL || null,
		tests: false,
		headed: false,
		path: null,
	};
	for ( let i = 0; i < argv.length; i++ ) {
		const arg = argv[ i ];
		const next = () => {
			const value = argv[ ++i ];
			if ( value === undefined ) {
				throw new Error( `${ arg } needs a value.` );
			}
			return value;
		};
		switch ( arg ) {
			case '-h':
			case '--help':
				process.stdout.write( HELP );
				process.exit( 0 );
				break;
			case '--click':
			case '--fill':
			case '--press':
			case '--hover':
			case '--wait':
				options.steps.push( { type: arg.slice( 2 ), value: next() } );
				break;
			case '--canvas':
			case '--page':
				options.steps.push( { type: arg.slice( 2 ) } );
				break;
			case '--shot':
				options.shot =
					argv[ i + 1 ] && ! argv[ i + 1 ].startsWith( '--' )
						? next()
						: 'ui';
				break;
			case '--clip':
				options.clip = next();
				break;
			case '--size': {
				const [ w, h ] = next().split( 'x' ).map( Number );
				options.size = [ w, h ];
				break;
			}
			case '--base':
				options.base = next();
				break;
			case '--tests':
				options.tests = true;
				break;
			case '--headed':
				options.headed = true;
				break;
			default:
				if ( arg.startsWith( '--' ) || options.path !== null ) {
					throw new Error(
						`Unknown argument "${ arg }". See --help.`
					);
				}
				options.path = arg;
		}
	}
	return options;
}

function getBaseURL( { base, tests } ) {
	if ( base ) {
		return base.replace( /\/$/, '' );
	}
	const output = execFileSync(
		path.join( ROOT, 'node_modules', '.bin', 'wp-env' ),
		[ 'status', '--json' ],
		{ cwd: ROOT, encoding: 'utf8' }
	);
	const port =
		JSON.parse( output )?.ports?.[ tests ? 'tests' : 'development' ];
	if ( ! port ) {
		throw new Error(
			'No running wp-env found. Run `npm run wp-env start -- --auto-port` or pass --base.'
		);
	}
	return `http://localhost:${ port }`;
}

function getURL( baseURL, target ) {
	if ( ! target ) {
		return baseURL + EDITOR_PATH;
	}
	if ( /^https?:/.test( target ) ) {
		return target;
	}
	if ( target.startsWith( '/' ) ) {
		return baseURL + target;
	}
	return `${ baseURL }${ EDITOR_PATH }&${ target.replace( /^[?&]/, '' ) }`;
}

async function login( baseURL ) {
	mkdirSync( path.dirname( STORAGE_STATE_PATH ), { recursive: true } );
	await globalSetup.logIn( baseURL );
}

/**
 * Find a target by accessible name, trying the roles people click most, or by
 * CSS selector when prefixed "css=".
 *
 * @param {import('@playwright/test').Page|import('@playwright/test').FrameLocator} scope
 * @param {string}                                                                  target
 */
async function find( scope, target ) {
	if ( target.startsWith( 'css=' ) ) {
		return scope.locator( target.slice( 4 ) ).first();
	}
	const candidates = [
		...[
			'button',
			'link',
			'tab',
			'menuitem',
			'menuitemradio',
			'option',
			'checkbox',
			'switch',
			'radio',
			'treeitem',
			'gridcell',
			'textbox',
		].map( ( role ) =>
			scope.getByRole( role, { name: target, exact: true } )
		),
		scope.getByLabel( target, { exact: true } ),
		scope.getByPlaceholder( target, { exact: true } ),
		scope.getByRole( 'button', { name: target } ),
		scope.getByText( target, { exact: true } ),
		scope.getByText( target ),
	];
	for ( const candidate of candidates ) {
		const visible = candidate.filter( { visible: true } ).first();
		if ( await visible.count() ) {
			return visible;
		}
	}
	throw new Error( `Couldn't find "${ target }".` );
}

async function runStep( page, scope, step ) {
	switch ( step.type ) {
		case 'click':
			await ( await find( scope, step.value ) ).click();
			break;
		case 'hover':
			await ( await find( scope, step.value ) ).hover();
			break;
		case 'fill': {
			const at = step.value.indexOf(
				'=',
				step.value.startsWith( 'css=' ) ? 4 : 0
			);
			if ( at < 0 ) {
				throw new Error( `--fill needs "<target>=<text>".` );
			}
			await (
				await find( scope, step.value.slice( 0, at ) )
			).fill( step.value.slice( at + 1 ) );
			break;
		}
		case 'press':
			await page.keyboard.press( step.value );
			break;
		case 'wait':
			if ( /^\d+$/.test( step.value ) ) {
				await page.waitForTimeout( Number( step.value ) );
			} else {
				const deadline = Date.now() + 15000;
				for (;;) {
					try {
						await find( scope, step.value );
						break;
					} catch ( error ) {
						if ( Date.now() > deadline ) {
							throw error;
						}
						await page.waitForTimeout( 250 );
					}
				}
			}
			break;
	}
	// Let the UI settle after each step.
	await page.waitForTimeout( 400 );
}

async function waitForEditor( page ) {
	await page
		.waitForLoadState( 'networkidle', { timeout: 15000 } )
		.catch( () => {} );
	await page.waitForTimeout( 500 );
}

async function summarise( page ) {
	return page.evaluate( () => {
		const isVisible = ( el ) => {
			const rect = el.getBoundingClientRect();
			const style = window.getComputedStyle( el );
			return (
				rect.width > 0 &&
				rect.height > 0 &&
				style.visibility !== 'hidden' &&
				rect.bottom > 0 &&
				rect.top < window.innerHeight
			);
		};
		const text = ( el ) =>
			(
				el.getAttribute( 'aria-label' ) ||
				el.innerText ||
				el.getAttribute( 'title' ) ||
				''
			)
				.replace( /\s+/g, ' ' )
				.trim()
				.slice( 0, 60 );
		const collect = ( selector, limit ) => {
			const seen = new Set();
			for ( const el of document.querySelectorAll( selector ) ) {
				const value = isVisible( el ) && text( el );
				if ( value ) {
					seen.add( value );
				}
			}
			const all = [ ...seen ];
			return all.length > limit
				? [ ...all.slice( 0, limit ), `… ${ all.length - limit } more` ]
				: all;
		};
		const canvas = document.querySelector( 'iframe[name="editor-canvas"]' );
		let canvasHeadings = [];
		try {
			canvasHeadings = [
				...( canvas?.contentDocument?.querySelectorAll(
					'h1, h2, h3'
				) || [] ),
			]
				.map( ( el ) =>
					el.innerText.replace( /\s+/g, ' ' ).trim().slice( 0, 60 )
				)
				.filter( Boolean )
				.slice( 0, 8 );
		} catch {}
		return {
			title: document.title,
			url: window.location.href,
			headings: collect( 'h1, h2, h3', 12 ),
			dialogs: collect(
				'[role="dialog"], [role="alertdialog"], [role="menu"]:not(#wpadminbar *), [role="listbox"]',
				4
			),
			notices: collect(
				'.components-notice, .components-snackbar, [role="alert"], [role="status"]:not(:empty)',
				6
			),
			pressed: collect(
				'[aria-pressed="true"], [aria-selected="true"], [aria-current="page"], [aria-checked="true"]',
				12
			),
			buttons: collect(
				'button, [role="button"], a[href], [role="tab"], [role="menuitem"]',
				40
			),
			canvas: canvas ? canvasHeadings : null,
		};
	} );
}

function printSummary( summary, errors ) {
	const lines = [
		`Title:    ${ summary.title }`,
		`URL:      ${ summary.url }`,
	];
	const list = ( label, items ) => {
		if ( items?.length ) {
			lines.push( `${ label }${ items.join( ' | ' ) }` );
		}
	};
	list( 'Headings: ', summary.headings );
	list( 'Open:     ', summary.dialogs );
	list( 'Notices:  ', summary.notices );
	list( 'Selected: ', summary.pressed );
	list( 'Controls: ', summary.buttons );
	if ( summary.canvas ) {
		lines.push(
			`Canvas:   ${ summary.canvas.length ? summary.canvas.join( ' | ' ) : '(no headings)' }`
		);
	}
	list( 'Errors:   ', errors.slice( 0, 5 ) );
	process.stdout.write( lines.join( '\n' ) + '\n' );
}

async function main() {
	const options = parseArgs( process.argv.slice( 2 ) );
	const baseURL = getBaseURL( options );
	const url = getURL( baseURL, options.path );

	if ( ! existsSync( STORAGE_STATE_PATH ) ) {
		await login( baseURL );
	}

	const browser = await chromium.launch( { headless: ! options.headed } );
	const errors = [];
	let exitCode = 0;
	try {
		const open = async () => {
			const context = await browser.newContext( {
				storageState: STORAGE_STATE_PATH,
				viewport: {
					width: options.size[ 0 ],
					height: options.size[ 1 ],
				},
				deviceScaleFactor: 1,
			} );
			const page = await context.newPage();
			await page.goto( url );
			return { context, page };
		};

		let { context, page } = await open();
		// The saved login belongs to whichever site logged in last.
		if ( page.url().includes( 'wp-login.php' ) ) {
			await context.close();
			await login( baseURL );
			( { context, page } = await open() );
		}

		page.on( 'pageerror', ( error ) => errors.push( error.message ) );
		page.on( 'console', ( message ) => {
			if ( message.type() === 'error' ) {
				errors.push( message.text().slice( 0, 200 ) );
			}
		} );

		await waitForEditor( page );

		let scope = page;
		for ( const step of options.steps ) {
			if ( step.type === 'canvas' ) {
				scope = page.frameLocator( 'iframe[name="editor-canvas"]' );
				continue;
			}
			if ( step.type === 'page' ) {
				scope = page;
				continue;
			}
			try {
				await runStep( page, scope, step );
			} catch ( error ) {
				process.stdout.write(
					`Step failed: --${ step.type } ${ step.value }: ${
						error.message.split( '\n' )[ 0 ]
					}\n`
				);
				exitCode = 1;
				break;
			}
		}

		printSummary( await summarise( page ), errors );

		if ( options.shot ) {
			const dir = path.join( ROOT, '.context' );
			mkdirSync( dir, { recursive: true } );
			const file = path.join(
				dir,
				options.shot.replace( /\.jpe?g$/, '' ) + '.jpg'
			);
			const shot = {
				path: file,
				type: 'jpeg',
				quality: 70,
				scale: 'css',
			};
			if ( options.clip ) {
				await page.locator( options.clip ).first().screenshot( shot );
			} else {
				await page.screenshot( shot );
			}
			process.stdout.write( `Shot:     ${ file }\n` );
		}
	} finally {
		await browser.close();
	}
	process.exit( exitCode );
}

main().catch( ( error ) => {
	process.stderr.write( `${ error.message }\n` );
	process.exit( 1 );
} );
