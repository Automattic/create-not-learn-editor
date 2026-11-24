/**
 * Unsaved changes in the preview.
 *
 * Browse shows the real site in an iframe, which only knows what is saved.
 * So the editor sends its unsaved changes to the site
 * (`includes/preview-changes.php`), kept for this editor session alone, and
 * the preview's addresses name the session (`CHANGES_PARAM` in `urls.js`).
 * The preview then shows the site as it would be once saved, and Browse
 * needn't ask to save or discard first.
 *
 * Only changes the site can put in place are sent, and only those count as
 * shown: see `isShownByPreviewChanges`. Anything else still asks.
 */

/**
 * Internal dependencies
 */
import { namespace, settings } from '../settings';
import { request } from '../records';
import {
	coreDataStore,
	useCallback,
	useEffect,
	useRef,
	useRegistry,
	useSelect,
} from '../wordpress-packages';

// What of a post the preview can show unsaved, by post type.
const TEMPLATE_TYPES = [ 'wp_template', 'wp_template_part' ];
const TEMPLATE_FIELDS = [ 'title', 'content' ];
const POST_FIELDS = [ 'title', 'content', 'template' ];
const STYLE_FIELDS = [ 'styles', 'settings' ];

// The site settings the preview can show unsaved.
const SITE_SETTINGS = [
	'title',
	'description',
	'site_logo',
	'site_icon',
	'show_on_front',
	'page_on_front',
	'page_for_posts',
	'posts_per_page',
];

// How long the changes settle, while browsing, before they are sent.
const SEND_DELAY_MS = 300;

/*
 * Results of sending. `changed` when the preview now shows something new and
 * needs loading again.
 */
export const SEND_CHANGED = 'changed';
export const SEND_UNCHANGED = 'unchanged';
export const SEND_FAILED = 'failed';

function getFields( name ) {
	return TEMPLATE_TYPES.includes( name ) ? TEMPLATE_FIELDS : POST_FIELDS;
}

/*
 * Core adds a post's footnotes to its meta as its blocks change. They are
 * drawn from the blocks, so they don't stop the rest being shown.
 */
function isFootnotesOnly( meta ) {
	return Object.keys( meta || {} ).every( ( key ) => key === 'footnotes' );
}

function getText( value ) {
	if ( typeof value === 'string' ) {
		return value;
	}

	return value?.raw ?? '';
}

// Core keeps edited blocks' markup as a function of the record, run on save.
function getContent( record ) {
	return typeof record.content === 'function'
		? record.content( record )
		: getText( record.content );
}

/**
 * Whether the preview shows an unsaved change.
 *
 * @param {Object}   change A change, from `useChanges`.
 * @param {Function} select Registry `select`.
 * @return {boolean} Whether it is shown.
 */
export function isShownByPreviewChanges( change, select ) {
	const { kind, name, key, property } = change;

	if ( ! settings.previewSession ) {
		return false;
	}

	if ( kind === 'root' && name === 'site' ) {
		return SITE_SETTINGS.includes( property );
	}

	let fields;

	if ( kind === 'postType' ) {
		fields = getFields( name );
	} else if ( kind === 'root' && name === 'globalStyles' ) {
		fields = STYLE_FIELDS;
	} else {
		return false;
	}

	const edits =
		select( coreDataStore ).getEntityRecordNonTransientEdits(
			kind,
			name,
			key
		) || {};

	return Object.entries( edits ).every(
		( [ field, value ] ) =>
			fields.includes( field ) ||
			( field === 'meta' && isFootnotesOnly( value ) )
	);
}

/**
 * The unsaved changes the preview can show, as the site takes them.
 *
 * @param {Function} select Registry `select`.
 * @return {Object} `{ posts, templates, styles, site }`.
 */
export function getPreviewChanges( select ) {
	const store = select( coreDataStore );
	const changes = { posts: {}, templates: {}, styles: null, site: {} };

	store
		.__experimentalGetDirtyEntityRecords()
		.forEach( ( { kind, name, key } ) => {
			const edits =
				store.getEntityRecordNonTransientEdits( kind, name, key ) || {};
			const record = store.getEditedEntityRecord( kind, name, key );

			if ( kind === 'root' && name === 'globalStyles' ) {
				changes.styles = {
					styles: record?.styles || {},
					settings: record?.settings || {},
				};
				return;
			}

			if ( kind !== 'postType' || ! record ) {
				return;
			}

			const fields = {};

			getFields( name )
				.filter( ( field ) => field in edits )
				.forEach( ( field ) => {
					fields[ field ] =
						field === 'content'
							? getContent( record )
							: getText( record[ field ] );
				} );

			if ( ! Object.keys( fields ).length ) {
				return;
			}

			if ( TEMPLATE_TYPES.includes( name ) ) {
				changes.templates[ key ] = { postType: name, ...fields };
			} else {
				changes.posts[ key ] = fields;
			}
		} );

	const siteEdits = store.getEntityRecordEdits( 'root', 'site' ) || {};
	const site = store.getEditedEntityRecord( 'root', 'site' ) || {};

	SITE_SETTINGS.filter( ( property ) => property in siteEdits ).forEach(
		( property ) => {
			changes.site[ property ] = site[ property ] ?? null;
		}
	);

	return changes;
}

/**
 * Keep the site's copy of the unsaved changes up to date.
 *
 * `flush` sends them now, for showing the preview, and calls `onChange` if
 * the site has something new. While `isActive`, they are also sent as they
 * settle, for the pages the preview goes to next, without `onChange`: the
 * changes made while browsing either show in the editor or are already
 * passed along in the preview's address, which loads again by itself.
 *
 * @param {Object}   options
 * @param {boolean}  options.isActive Whether the preview is on show.
 * @param {Function} options.onChange Called when the site has changes the
 *                                    preview hasn't loaded.
 * @return {Function} `flush`, resolving to `SEND_CHANGED`, `SEND_UNCHANGED`
 *                    or `SEND_FAILED`.
 */
export function usePreviewChanges( { isActive, onChange } ) {
	const registry = useRegistry();
	// What the site was last sent by this canvas. Unknown to begin with, as
	// another screen's canvas may have sent something else.
	const lastSentRef = useRef( null );
	const queueRef = useRef( Promise.resolve() );
	const onChangeRef = useRef( onChange );
	onChangeRef.current = onChange;

	const send = useCallback( ( body, { notify = true } = {} ) => {
		const run = queueRef.current.then( async () => {
			if ( ! settings.previewSession || body === lastSentRef.current ) {
				return SEND_UNCHANGED;
			}

			try {
				const result = await request( {
					path: `/${ namespace }/preview-changes`,
					method: 'POST',
					data: {
						session: settings.previewSession,
						...JSON.parse( body ),
					},
				} );

				lastSentRef.current = body;

				if ( ! result?.changed ) {
					return SEND_UNCHANGED;
				}

				if ( notify ) {
					onChangeRef.current?.();
				}

				return SEND_CHANGED;
			} catch {
				return SEND_FAILED;
			}
		} );

		queueRef.current = run;

		return run;
	}, [] );

	const flush = useCallback(
		() => send( JSON.stringify( getPreviewChanges( registry.select ) ) ),
		[ registry, send ]
	);

	// Worked out only while browsing: serializing a page's blocks on every
	// keystroke in Edit would be wasted.
	const body = useSelect(
		( select ) =>
			isActive ? JSON.stringify( getPreviewChanges( select ) ) : null,
		[ isActive ]
	);

	useEffect( () => {
		if ( body === null ) {
			return undefined;
		}

		const timer = window.setTimeout(
			() => send( body, { notify: false } ),
			SEND_DELAY_MS
		);

		return () => window.clearTimeout( timer );
	}, [ body, send ] );

	return flush;
}
