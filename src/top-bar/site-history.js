/**
 * Site history: what each Publish site saved together, and putting it back.
 *
 * The log is kept by PHP (`includes/site-history.php`). Each entry has the
 * time, the person and its changes. A change points at the core revision the
 * save made, or, for site settings that have none, holds the values saved.
 * Pages and posts keep core's own revisions and aren't in it.
 *
 * Restore doesn't save anything. It loads the site as it was just after an
 * entry back in as unsaved edits, so they wait for Publish site like any
 * other change. A revision holds a record as a save left it, so an entry's
 * own revisions are what the site already shows unless a later publish
 * changed the same thing again. Going back to an entry is therefore undoing
 * every publish after it: each record those changed goes back to how it was
 * before the oldest of them, its `previous_revision`, or for site settings
 * its `previous` values.
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
 * @param {Object}   before  The site's settings as they were before.
 * @return {Object[]} `{ kind, name, key, label }`, or with `values` and
 *                    `previous` for the site's settings, one change for
 *                    each.
 */
export function buildHistoryChanges( records, site, before ) {
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
				previous: Object.fromEntries(
					properties.map( ( setting ) => [
						setting,
						before?.[ setting ] ?? null,
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

function getRecordId( { kind, name, key } ) {
	return [ kind, name, key ?? '' ].join( '|' );
}

/**
 * What going back to an entry puts back: every record a later publish
 * changed, as it was before the oldest of those publishes.
 *
 * @param {Object[]} entries The log, newest first.
 * @param {number}   index   The entry to go back to.
 * @return {Object[]} `{ kind, name, key, label, revision }` for a record,
 *                    where `revision` is null when there is none to go
 *                    back to, as for a record the publish made, or
 *                    `{ kind: 'root', name: 'site', label, values,
 *                    missing }` for the site's settings, `missing` naming
 *                    any with no value to go back to.
 */
export function planRestore( entries, index ) {
	const records = new Map();
	const settings = new Map();

	// Newest first, so the oldest later publish is the one that stays.
	entries.slice( 0, Math.max( 0, index ) ).forEach( ( entry ) =>
		( entry.changes || [] ).forEach( ( change ) => {
			if ( change.values ) {
				Object.keys( change.values ).forEach( ( setting ) =>
					settings.set( setting, {
						label: change.label,
						hasValue:
							!! change.previous &&
							Object.hasOwn( change.previous, setting ),
						value: change.previous?.[ setting ],
					} )
				);
				return;
			}

			records.set( getRecordId( change ), {
				kind: change.kind,
				name: change.name,
				key: change.key,
				label: change.label,
				revision: change.previous_revision ?? null,
			} );
		} )
	);

	const plan = [ ...records.values() ];

	if ( settings.size ) {
		const known = [ ...settings ].filter(
			( [ , { hasValue } ] ) => hasValue
		);
		const labels = [
			...new Set(
				[ ...settings.values() ].map( ( { label } ) => label )
			),
		].filter( Boolean );

		plan.push( {
			kind: 'root',
			name: 'site',
			label: labels.join( ', ' ),
			values: Object.fromEntries(
				known.map( ( [ setting, { value } ] ) => [ setting, value ] )
			),
			missing: [ ...settings.keys() ].filter(
				( setting ) => ! settings.get( setting ).hasValue
			),
		} );
	}

	return plan;
}

/**
 * How many of the records Restore would put back have unpublished changes
 * of their own, which it would replace.
 *
 * @param {Object[]} plan        From `planRestore`.
 * @param {Object[]} siteChanges The site's changes waiting, from `useChanges`.
 * @return {number} How many.
 */
export function countReplaced( plan, siteChanges ) {
	return plan.filter( ( change ) =>
		siteChanges.some(
			( waiting ) =>
				waiting.kind === change.kind &&
				waiting.name === change.name &&
				( change.values
					? Object.keys( change.values ).includes( waiting.property )
					: String( waiting.key ) === String( change.key ) )
		)
	).length;
}

/**
 * Whether the store now holds edits for a record, or for any of the site's
 * settings named, so a restore that matched what is saved isn't counted.
 *
 * @param {Object} target   From `planRestore`.
 * @param {Object} registry Data registry.
 * @return {boolean} Whether it does.
 */
function hasRestoredEdits( target, registry ) {
	const store = registry.select( coreStore );

	if ( target.values ) {
		const edits = store.getEntityRecordEdits( 'root', 'site' ) || {};

		return Object.keys( target.values ).some( ( setting ) =>
			Object.hasOwn( edits, setting )
		);
	}

	return store.hasEditsForEntityRecord(
		target.kind,
		target.name,
		target.key
	);
}

async function restoreTarget( target, registry ) {
	const { editEntityRecord } = registry.dispatch( coreStore );

	if ( target.values ) {
		if ( target.missing.length ) {
			throw new Error( 'No earlier value to restore.' );
		}

		// Loaded first, so the values count as edits to it.
		await registry
			.resolveSelect( coreStore )
			.getEntityRecord( 'root', 'site' );
		editEntityRecord( 'root', 'site', undefined, target.values );
		return;
	}

	const { kind, name, key, revision } = target;
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

	editEntityRecord( kind, name, key, getEdits( target, revisionRecord ) );
}

/**
 * Load the site as it was just after an entry back in as unsaved edits.
 *
 * @param {Object[]} entries  The log, newest first.
 * @param {number}   index    The entry to go back to.
 * @param {Object}   registry Data registry.
 * @return {Promise<{restored: number, failed: number}>} How many records
 *                                                       changed back, and
 *                                                       how many couldn't,
 *                                                       a revision core has
 *                                                       since pruned say.
 *                                                       Ones already as
 *                                                       they were count as
 *                                                       neither.
 */
export async function restoreEntry( entries, index, registry ) {
	const plan = planRestore( entries, index );
	const results = await Promise.allSettled(
		plan.map( ( target ) => restoreTarget( target, registry ) )
	);
	const restored = plan.filter(
		( target, i ) =>
			results[ i ].status === 'fulfilled' &&
			hasRestoredEdits( target, registry )
	).length;
	const failed = results.filter(
		( { status } ) => status === 'rejected'
	).length;

	return { restored, failed };
}

export const RESTORE_FAILED_MESSAGE = __(
	'That version couldn’t be put back. Core may have cleared it.'
);
