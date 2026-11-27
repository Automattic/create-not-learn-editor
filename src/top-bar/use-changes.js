/**
 * The changes waiting to be saved, in the user's terms, with ways to save or
 * discard them.
 *
 * Changes are listed the way core's review lists them: each edited site
 * setting is a change of its own, and every other edited record is one.
 */

/**
 * WordPress dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { useEntitiesSavedStatesIsDirty } from '@wordpress/editor';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getRecordId, useUnsavedBeforeEditSession } from '../edit-session';
import { discardPostBackups } from '../editor-layer/post-backups';
import { unlock } from '../lock-unlock';

/*
 * Named as the editor names them, so a change reads as the place it was made.
 */
const SITE_SETTING_LABELS = {
	title: __( 'Site name', 'create-not-learn-editor' ),
	description: __( 'Tagline', 'create-not-learn-editor' ),
	site_logo: __( 'Logo', 'create-not-learn-editor' ),
	site_icon: __( 'Browser icon', 'create-not-learn-editor' ),
	show_on_front: __( 'Your homepage', 'create-not-learn-editor' ),
	page_on_front: __( 'Your homepage', 'create-not-learn-editor' ),
	page_for_posts: __( 'Blog page', 'create-not-learn-editor' ),
	posts_per_page: __( 'Posts shown at once', 'create-not-learn-editor' ),
};

/*
 * What the homepage shows is kept in three settings. Changed together, they
 * are one change: listed once, and discarded together.
 */
const HOMEPAGE_SETTINGS = [
	'show_on_front',
	'page_on_front',
	'page_for_posts',
];

const HOMEPAGE_CHANGE = {
	kind: 'root',
	name: 'site',
	property: 'show_on_front',
};

const TYPE_LABELS = {
	'postType/page': __( 'Page', 'create-not-learn-editor' ),
	'postType/post': __( 'Post', 'create-not-learn-editor' ),
	'postType/wp_navigation': __( 'Menu', 'create-not-learn-editor' ),
	'postType/wp_template': __( 'Layout', 'create-not-learn-editor' ),
	'postType/wp_template_part': __( 'Site part', 'create-not-learn-editor' ),
	'postType/wp_block': __( 'Section', 'create-not-learn-editor' ),
};

/*
 * Changes that show on every page of the site rather than one: its look, its
 * header, footer and menus, and the name, tagline and images they show.
 */
const SITE_WIDE_SETTINGS = [ 'title', 'description', 'site_logo', 'site_icon' ];

const SITE_WIDE_TYPES = [
	'root/globalStyles',
	'postType/wp_navigation',
	'postType/wp_template_part',
];

export function isSiteWideChange( { kind, name, property } ) {
	if ( kind === 'root' && name === 'site' ) {
		return SITE_WIDE_SETTINGS.includes( property );
	}

	return SITE_WIDE_TYPES.includes( `${ kind }/${ name }` );
}

function describeHomepage( site, getPageTitle ) {
	if ( site?.show_on_front !== 'page' ) {
		return __( 'Shows your latest posts', 'create-not-learn-editor' );
	}

	const title = getPageTitle( site?.page_on_front );

	return title
		? sprintf(
				/* translators: %s: page title. */
				__( 'Shows “%s”', 'create-not-learn-editor' ),
				title
			)
		: __( 'Shows a page', 'create-not-learn-editor' );
}

function describeSiteSetting( property, value, { site, getPageTitle } ) {
	let detail = __( 'Site setting', 'create-not-learn-editor' );

	if ( property === 'title' || property === 'description' ) {
		detail = value
			? sprintf(
					/* translators: %s: The new value of a site setting. */
					__( 'Changed to “%s”', 'create-not-learn-editor' ),
					value
				)
			: __( 'Left empty', 'create-not-learn-editor' );
	} else if ( property === 'site_logo' || property === 'site_icon' ) {
		detail = value
			? __( 'New image', 'create-not-learn-editor' )
			: __( 'Image removed', 'create-not-learn-editor' );
	} else if ( property === 'show_on_front' || property === 'page_on_front' ) {
		detail = describeHomepage( site, getPageTitle );
	} else if ( property === 'page_for_posts' ) {
		detail =
			getPageTitle( value ) || __( 'None', 'create-not-learn-editor' );
	} else if ( property === 'posts_per_page' ) {
		detail = sprintf(
			/* translators: %d: How many posts a listing shows at once. */
			__( '%d at a time', 'create-not-learn-editor' ),
			Number( value ) || 0
		);
	}

	return {
		label: SITE_SETTING_LABELS[ property ] || property,
		detail,
	};
}

function describeChange( record, { site, getEntityConfig, getPageTitle } ) {
	const { kind, name, property, title } = record;

	if ( kind === 'root' && name === 'site' ) {
		return describeSiteSetting( property, site?.[ property ], {
			getPageTitle,
			site,
		} );
	}

	if ( kind === 'root' && name === 'globalStyles' ) {
		return {
			label: __( 'Site look', 'create-not-learn-editor' ),
			detail: __(
				'The colors, fonts, and spacing of your whole site',
				'create-not-learn-editor'
			),
		};
	}

	const type =
		TYPE_LABELS[ `${ kind }/${ name }` ] ||
		getEntityConfig( kind, name )?.label ||
		name;

	return { label: title || type, detail: type };
}

function getChangeId( { kind, name, key, property } ) {
	return [ kind, name, key ?? '', property ?? '' ].join( '|' );
}

/**
 * The changes waiting to be saved, in the user's terms.
 *
 * @param {Object[]} dirtyEntityRecords      Edited records, with each edited site
 *                                           setting a record of its own, as core's
 *                                           `useEntitiesSavedStatesIsDirty` and
 *                                           `getDirtyRecords` give them.
 * @param {Object}   context
 * @param {Object}   context.site            The site's settings, edited.
 * @param {Function} context.getEntityConfig Core's selector.
 * @param {Function} context.getPageTitle    A page's title, from its ID.
 * @return {Object[]} The records, each with `id`, `isSiteWide`, `label`
 *                    and `detail`.
 */
export function describeChanges( dirtyEntityRecords, context ) {
	const isHomepageSwitched = dirtyEntityRecords.some(
		( { kind, name, property } ) =>
			kind === 'root' && name === 'site' && property === 'show_on_front'
	);

	return dirtyEntityRecords
		.filter(
			( { kind, name, property } ) =>
				! isHomepageSwitched ||
				kind !== 'root' ||
				name !== 'site' ||
				property === 'show_on_front' ||
				! HOMEPAGE_SETTINGS.includes( property )
		)
		.map( ( record ) => ( {
			...record,
			id: getChangeId( record ),
			isSiteWide: isSiteWideChange( record ),
			...describeChange( record, context ),
		} ) );
}

/**
 * The edited records, read now, for code outside a component: as core's
 * `useEntitiesSavedStatesIsDirty` lists them, with each edited site setting
 * a record of its own.
 *
 * @param {Function} select Registry `select`.
 * @return {Object[]} `{ kind, name, key, title, property }` for each.
 */
export function getDirtyRecords( select ) {
	const store = select( coreStore );
	const labels = store.getEntityConfig( 'root', 'site' )?.meta?.labels ?? {};
	const siteEdits = store.getEntityRecordEdits( 'root', 'site' ) ?? {};
	const firsts = [ 'title', 'description', 'site_logo', 'site_icon' ];
	const properties = [
		...firsts.filter( ( property ) => siteEdits[ property ] !== undefined ),
		...Object.keys( siteEdits ).filter(
			( property ) => ! firsts.includes( property )
		),
	];

	return [
		...store
			.__experimentalGetDirtyEntityRecords()
			.filter(
				( record ) =>
					! ( record.kind === 'root' && record.name === 'site' )
			),
		...properties.map( ( property ) => ( {
			kind: 'root',
			name: 'site',
			title: labels[ property ] || property,
			property,
		} ) ),
	];
}

// Long enough for the editor to load a discarded layout's parts and menus.
const DISCARD_SETTLE_MS = 1500;

/**
 * Put back what the editor changes by itself just after a discard.
 *
 * Discarding a layout's changes hands the editor its saved blocks again, and
 * the site parts and menus inside it load afresh. Some write themselves back
 * as they do, a menu tidying its links say, which core counts as a change
 * nobody made. For a moment after a discard, a post that wasn't changed
 * before it is put back as saved whenever the editor changes it. Its blocks
 * are kept, so the editor doesn't load it, and change it, again.
 *
 * @param {Object}      registry Data registry.
 * @param {Set<string>} kept     Records still changed after the discard, by
 *                               `getRecordId`.
 */
function putBackWhileSettling( registry, kept ) {
	let isPuttingBack = false;
	const unsubscribe = registry.subscribe( () => {
		if ( isPuttingBack ) {
			return;
		}

		const store = registry.select( coreStore );

		isPuttingBack = true;
		store
			.__experimentalGetDirtyEntityRecords()
			.filter(
				( record ) =>
					record.kind === 'postType' &&
					! kept.has( getRecordId( record ) )
			)
			.forEach( ( { kind, name, key } ) => {
				const saved = store.getRawEntityRecord( kind, name, key ) || {};
				const edits = store.getEntityRecordNonTransientEdits(
					kind,
					name,
					key
				);

				registry
					.dispatch( coreStore )
					.editEntityRecord(
						kind,
						name,
						key,
						Object.fromEntries(
							Object.keys( edits ).map( ( edit ) => [
								edit,
								saved[ edit ],
							] )
						),
						{ undoIgnore: true }
					);
			} );
		isPuttingBack = false;
	}, coreStore );

	window.setTimeout( unsubscribe, DISCARD_SETTLE_MS );
}

/**
 * @param {Object}  [options]
 * @param {boolean} [options.inEditSession] Only what changed while editing
 *                                          the page, from Edit, during a
 *                                          session (`src/edit-session.js`).
 * @return {Object} `changes`, each with an `id`, a `label`, a `detail` and
 *                  `isSiteWide`, whether they are saving, and `save`,
 *                  `discard` and `discardAll` actions.
 */
export function useChanges( { inEditSession = false } = {} ) {
	const { dirtyEntityRecords: allDirtyEntityRecords } =
		useEntitiesSavedStatesIsDirty();
	// While editing a page, its Save and Exit only reach what changed since
	// Edit (`src/edit-session.js`).
	const unsavedBefore = useUnsavedBeforeEditSession();
	const dirtyEntityRecords =
		inEditSession && unsavedBefore
			? allDirtyEntityRecords.filter(
					( record ) => ! unsavedBefore.has( getRecordId( record ) )
				)
			: allDirtyEntityRecords;
	const {
		editedSite,
		savedSite,
		getEditedEntityRecord,
		getEntityConfig,
		isSaving,
	} = useSelect( ( select ) => {
		const store = select( coreStore );

		return {
			getEditedEntityRecord: store.getEditedEntityRecord,
			editedSite: store.getEditedEntityRecord( 'root', 'site' ),
			savedSite: store.getRawEntityRecord( 'root', 'site' ),
			getEntityConfig: store.getEntityConfig,
			isSaving: store
				.__experimentalGetDirtyEntityRecords()
				.some( ( { kind, name, key } ) =>
					store.isSavingEntityRecord( kind, name, key )
				),
		};
	}, [] );
	const { clearEntityRecordEdits, editEntityRecord } =
		useDispatch( coreStore );
	const getPageTitle = ( id ) =>
		( Number( id ) &&
			getEditedEntityRecord( 'postType', 'page', Number( id ) )
				?.title ) ||
		'';
	const { saveDirtyEntities } = unlock( useDispatch( coreStore ) );
	const registry = useRegistry();

	const changes = describeChanges( dirtyEntityRecords, {
		getEntityConfig,
		getPageTitle,
		site: editedSite,
	} );

	/*
	 * A site setting is put back to its saved value, which core counts as no
	 * edit at all, so the site's other settings keep their edits. Anything
	 * else is one record, and loses all of its edits.
	 */
	const discardOne = ( { kind, name, key, property } ) => {
		if ( kind === 'root' && name === 'site' ) {
			const properties =
				property === 'show_on_front' ? HOMEPAGE_SETTINGS : [ property ];

			editEntityRecord(
				'root',
				'site',
				undefined,
				Object.fromEntries(
					properties.map( ( setting ) => [
						setting,
						savedSite?.[ setting ],
					] )
				)
			);
		} else {
			if ( kind === 'postType' ) {
				discardPostBackups( {
					postId: key,
					postType: name,
					status: registry
						.select( coreStore )
						.getEntityRecord( kind, name, key )?.status,
				} );
			}

			clearEntityRecordEdits( kind, name, key );
		}
	};

	const discardRecords = ( records ) => {
		const discarded = new Set( records.map( getRecordId ) );
		const kept = new Set(
			allDirtyEntityRecords
				.map( getRecordId )
				.filter( ( id ) => ! discarded.has( id ) )
		);

		records.forEach( discardOne );
		putBackWhileSettling( registry, kept );
	};

	const discard = ( change ) => discardRecords( [ change ] );

	const discardAll = () => discardRecords( changes );

	/*
	 * Core's own save, as its review uses: it saves site settings together
	 * and publishes menus, and reports success or failure in a snackbar.
	 * Changes left out are skipped as core's review skips unticked ones, and
	 * stay unsaved. Leaving out the homepage leaves out all three of its
	 * settings, as it is listed and discarded as one.
	 */
	const save = ( leftOut = [] ) => {
		const skipped = new Set( leftOut.map( getChangeId ) );

		if ( skipped.has( getChangeId( HOMEPAGE_CHANGE ) ) ) {
			HOMEPAGE_SETTINGS.forEach( ( property ) =>
				skipped.add( getChangeId( { ...HOMEPAGE_CHANGE, property } ) )
			);
		}

		saveDirtyEntities( {
			dirtyEntityRecords,
			entitiesToSkip: dirtyEntityRecords.filter( ( record ) =>
				skipped.has( getChangeId( record ) )
			),
		} );
	};

	return { changes, isSaving, save, discard, discardAll };
}
