/**
 * Site history: what each Publish site saved together, and putting it back.
 *
 * The log is kept by PHP (`includes/site-history.php`). Each entry has the
 * time, the person and its changes. A change points at the core revision the
 * save made, or, for site settings that have none, holds the values saved.
 * Pages and posts keep core's own revisions and aren't in it.
 *
 * Restore doesn't save anything. It loads an entry's versions back in as
 * unsaved edits, so they wait for Publish site like any other change.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { store as coreStore } from '@wordpress/core-data';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { namespace } from '../settings';

const PATH = `/${ namespace }/site-history`;
const CHANGED_EVENT = 'create-not-learn-editor-site-history-changed';

// What a revision brings back, by the kind of record.
const GLOBAL_STYLES_FIELDS = [ 'styles', 'settings' ];

// The three settings that decide what the homepage shows go together, as
// the list of changes treats them (see `use-changes.js`).
const HOMEPAGE_SETTINGS = [
	'show_on_front',
	'page_on_front',
	'page_for_posts',
];

export function getSiteHistory() {
	return apiFetch( { path: PATH } );
}

/**
 * Run `callback` whenever an entry is added, so an open history panel
 * stays current.
 *
 * @param {Function} callback Called with no arguments.
 * @return {Function} Stops listening.
 */
export function onSiteHistoryChanged( callback ) {
	window.addEventListener( CHANGED_EVENT, callback );

	return () => window.removeEventListener( CHANGED_EVENT, callback );
}

/**
 * The changes of one Publish site, in the log's terms.
 *
 * @param {Object[]} records `{ kind, name, key, property, label }` for each
 *                           record that was saved, with `summary`,
 *                           `details` and `more` from `describeChangeDetails`.
 * @param {Object}   site    The site's settings as they were saved.
 * @return {Object[]} `{ kind, name, key, label }`, or with `values` for the
 *                    site's settings, one change for each.
 */
export function buildHistoryChanges( records, site ) {
	const changes = [];
	const hasHomepage = records.some(
		( { kind, name, property } ) =>
			kind === 'root' && name === 'site' && property === 'show_on_front'
	);

	records.forEach( ( record ) => {
		const { kind, name, key, property, label } = record;
		// From `describeChangeDetails`, when the change was described.
		const description = record.details
			? {
					summary: record.summary,
					details: record.details,
					...( record.more ? { more: record.more } : {} ),
				}
			: {};

		if ( kind === 'root' && name === 'site' ) {
			if (
				hasHomepage &&
				property !== 'show_on_front' &&
				HOMEPAGE_SETTINGS.includes( property )
			) {
				return;
			}

			const properties =
				property === 'show_on_front' ? HOMEPAGE_SETTINGS : [ property ];

			changes.push( {
				kind,
				name,
				label,
				values: Object.fromEntries(
					properties.map( ( setting ) => [
						setting,
						site?.[ setting ] ?? null,
					] )
				),
				...description,
			} );
		} else {
			changes.push( { kind, name, key, label, ...description } );
		}
	} );

	return changes;
}

/**
 * Add what was just published to the log. A failure to log is only
 * reported to the console: the site is published either way.
 *
 * @param {Object[]} changes From `buildHistoryChanges`.
 */
export async function recordSitePublish( changes ) {
	if ( ! changes.length ) {
		return;
	}

	try {
		await apiFetch( { path: PATH, method: 'POST', data: { changes } } );
		window.dispatchEvent( new window.Event( CHANGED_EVENT ) );
	} catch ( error ) {
		// eslint-disable-next-line no-console
		console.error(
			'Could not log the publish in the site history.',
			error
		);
	}
}

/**
 * What a revision puts back, as edits to its record.
 *
 * @param {Object} change   A change of an entry.
 * @param {Object} revision The revision, as REST gives it for editing.
 * @return {Object} The edits.
 */
function getEdits( change, revision ) {
	if ( change.kind === 'root' && change.name === 'globalStyles' ) {
		return Object.fromEntries(
			GLOBAL_STYLES_FIELDS.filter(
				( field ) => revision[ field ] !== undefined
			).map( ( field ) => [ field, revision[ field ] ] )
		);
	}

	const edits = {};
	const content = revision.content?.raw ?? revision.content;
	const title = revision.title?.raw ?? revision.title;

	if ( typeof content === 'string' ) {
		edits.content = content;
	}

	if ( typeof title === 'string' ) {
		edits.title = title;
	}

	return edits;
}

async function restoreChange( change, registry ) {
	const { editEntityRecord } = registry.dispatch( coreStore );

	if ( change.values ) {
		editEntityRecord( 'root', 'site', undefined, change.values );
		return;
	}

	const { kind, name, key, revision } = change;
	const baseURL = registry
		.select( coreStore )
		.getEntityConfig( kind, name )?.baseURL;

	if ( ! revision || ! baseURL ) {
		throw new Error( 'No revision to restore.' );
	}

	// The record has to be in the store for its edits to count against it.
	const saved = await registry
		.resolveSelect( coreStore )
		.getEntityRecord( kind, name, key );

	if ( ! saved ) {
		throw new Error( 'The record is gone.' );
	}

	// A template's ID is `theme//slug`, and its route wants the slash.
	const id = String( key ).split( '/' ).map( encodeURIComponent ).join( '/' );
	const revisionRecord = await apiFetch( {
		path: `${ baseURL }/${ id }/revisions/${ revision }?context=edit`,
	} );

	editEntityRecord( kind, name, key, getEdits( change, revisionRecord ) );
}

/**
 * Load an entry's versions back in as unsaved edits.
 *
 * @param {Object} entry    An entry of the log.
 * @param {Object} registry Data registry.
 * @return {Promise<{restored: number, failed: number}>} How many changes came
 *                                                       back, and how many
 *                                                       couldn't, a revision
 *                                                       core has since
 *                                                       pruned say.
 */
export async function restoreEntry( entry, registry ) {
	const results = await Promise.allSettled(
		entry.changes.map( ( change ) => restoreChange( change, registry ) )
	);
	const restored = results.filter(
		( { status } ) => status === 'fulfilled'
	).length;

	return { restored, failed: results.length - restored };
}

export const RESTORE_FAILED_MESSAGE = __(
	'That version couldn’t be put back. Core may have cleared it.'
);
