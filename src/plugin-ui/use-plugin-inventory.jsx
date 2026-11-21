/**
 * What plugins add to the editor, plugin by plugin. See `README.md`.
 *
 * Core keeps no record of which plugin rendered a fill, and Gutenberg 24's
 * `useSlotFills()` only says how many there are, so the fills worth reading
 * are read through `SlotProbe`, a slot of the same name that hands its
 * elements over rather than rendering them. Each is tied back to its plugin
 * by what it carries: a sidebar's identifier, a document panel's name, or
 * else the plugin's own icon, which core's components fall back to.
 */

/**
 * WordPress dependencies
 */
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Counts a slot's fills. Logged in docs/editor-workarounds.md.
	__experimentalUseSlotFills as useSlotFills,
	Slot,
} from '@wordpress/components';
import { addAction, removeAction } from '@wordpress/hooks';
import { getPlugins } from '@wordpress/plugins';
import {
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getText } from './action-items';

export const OWN_PLUGIN = 'create-not-learn-editor-plugin-ui';

// Core's slot names, as `createSlotFill()` and `ActionItem` register them.
export const SLOTS = {
	moreMenu: 'core/plugin-more-menu',
	previewMenu: 'core/plugin-preview-menu',
	documentPanelOption: 'EnablePluginDocumentSettingPanelOption',
	documentPanel: 'PluginDocumentSettingPanel',
	statusInfo: 'PluginPostStatusInfo',
	prePublish: 'PluginPrePublishPanel',
	postPublish: 'PluginPostPublishPanel',
};

let pluginsVersion = 0;
const listeners = new Set();
const NAMESPACE = 'create-not-learn-editor/plugin-ui';

function subscribePlugins( listener ) {
	if ( ! listeners.size ) {
		const bump = () => {
			pluginsVersion++;
			listeners.forEach( ( callback ) => callback() );
		};
		addAction( 'plugins.pluginRegistered', NAMESPACE, bump );
		addAction( 'plugins.pluginUnregistered', NAMESPACE, bump );
	}
	listeners.add( listener );
	return () => {
		listeners.delete( listener );
		if ( ! listeners.size ) {
			removeAction( 'plugins.pluginRegistered', NAMESPACE );
			removeAction( 'plugins.pluginUnregistered', NAMESPACE );
		}
	};
}

function useFillCount( name ) {
	return useSlotFills( name )?.length ?? 0;
}

function ProbeReport( { elements, count, onChange, onLost } ) {
	useEffect( () => {
		// Fills render only in the slot registered last. Another one took
		// over, like core's More menu opening, and has since gone: register
		// again to read them.
		if ( count > 0 && ! elements.length ) {
			const timer = setTimeout( onLost, 300 );
			return () => clearTimeout( timer );
		}
		onChange( elements );
	}, [ elements, count, onChange, onLost ] );
	return null;
}

/**
 * A slot that reads its fills rather than rendering them. It becomes the
 * slot of that name, so only use it for slots CnL shows itself, or core
 * mounts only now and then. See `docs/editor-workarounds.md`.
 *
 * @param {Object}   props
 * @param {string}   props.name     The slot's name.
 * @param {Function} props.onChange Called with the fills' elements.
 * @return {Element} The probe.
 */
export function SlotProbe( { name, onChange } ) {
	const count = useFillCount( name );
	const [ key, setKey ] = useState( 0 );
	const onLost = useMemo( () => () => setKey( ( value ) => value + 1 ), [] );

	return (
		<Slot key={ key } name={ name }>
			{ ( fills ) => (
				<ProbeReport
					elements={ fills.flat( Infinity ).filter( Boolean ) }
					count={ count }
					onChange={ onChange }
					onLost={ onLost }
				/>
			) }
		</Slot>
	);
}

function humanise( name ) {
	return name
		.split( /[-_/]/ )
		.filter( Boolean )
		.map( ( word ) => word[ 0 ].toUpperCase() + word.slice( 1 ) )
		.join( ' ' );
}

/**
 * @param {Object} probed
 * @param {Array}  probed.moreMenu     Elements of core's More menu fills.
 * @param {Array}  probed.panelOptions Elements of the document panels'
 *                                     Preferences options.
 * @return {Object} Plugins with editor UI, in the order they registered,
 *                  actions that couldn't be tied to one, and what there is.
 */
export function usePluginInventory( { moreMenu, panelOptions } ) {
	const version = useSyncExternalStore(
		subscribePlugins,
		() => pluginsVersion
	);
	const statusInfo = useFillCount( SLOTS.statusInfo );
	const prePublish = useFillCount( SLOTS.prePublish );
	const postPublish = useFillCount( SLOTS.postPublish );
	const documentPanels = useFillCount( SLOTS.documentPanel );

	return useMemo( () => {
		const registered = getPlugins().filter(
			( plugin ) => plugin.name !== OWN_PLUGIN
		);
		const byName = new Map(
			registered.map( ( plugin ) => [
				plugin.name,
				{
					name: plugin.name,
					icon: plugin.icon,
					title: null,
					sidebars: [],
					documentPanels: [],
					actions: [],
				},
			] )
		);
		const unattributedActions = [];
		// Only an icon no other plugin uses says whose a fill is.
		const byIcon = ( icon ) => {
			const matches = icon
				? registered.filter( ( plugin ) => plugin.icon === icon )
				: [];
			return matches.length === 1
				? byName.get( matches[ 0 ].name )
				: null;
		};

		moreMenu.forEach( ( element, index ) => {
			if ( ! element?.props ) {
				return;
			}
			const { icon, onClick, href } = element.props;
			const controls = element.props[ 'aria-controls' ];
			const label = getText( element.props.children );
			if ( controls ) {
				const identifier = controls.replace( ':', '/' );
				const plugin = byName.get( identifier.split( '/' )[ 0 ] );
				if (
					plugin &&
					! plugin.sidebars.some(
						( sidebar ) => sidebar.identifier === identifier
					)
				) {
					plugin.sidebars.push( { identifier, title: label, icon } );
				}
				return;
			}
			const action = { key: index, label, icon, onClick, href };
			( byIcon( icon )?.actions ?? unattributedActions ).push( action );
		} );

		panelOptions.forEach( ( element ) => {
			const panelName = element?.props?.panelName;
			const plugin =
				panelName && byName.get( panelName.split( '/' )[ 0 ] );
			if ( plugin ) {
				plugin.documentPanels.push( {
					panelName,
					title: getText( element.props.label ),
				} );
			}
		} );

		const plugins = [ ...byName.values() ]
			.filter(
				( plugin ) =>
					plugin.sidebars.length ||
					plugin.documentPanels.length ||
					plugin.actions.length
			)
			.map( ( plugin ) => ( {
				...plugin,
				title:
					plugin.sidebars[ 0 ]?.title ||
					plugin.documentPanels[ 0 ]?.title ||
					humanise( plugin.name ),
				adds: describe( plugin ),
			} ) );

		return {
			plugins,
			unattributed: { actions: unattributedActions },
			hasDocumentSettings: documentPanels > 0 || statusInfo > 0,
			hasPrePublish: prePublish > 0,
			hasPostPublish: postPublish > 0,
			hasEditorUi:
				plugins.length > 0 ||
				unattributedActions.length > 0 ||
				documentPanels > 0 ||
				statusInfo > 0,
		};
		// `version` stands for the plugins registered.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		version,
		moreMenu,
		panelOptions,
		statusInfo,
		prePublish,
		postPublish,
		documentPanels,
	] );
}

/**
 * What a plugin adds, in a few words for its row.
 *
 * @param {Object} plugin A plugin from the inventory.
 * @return {string} Like "Panel beside the page · Page settings".
 */
function describe( plugin ) {
	return [
		plugin.sidebars.length && __( 'Panel beside the page' ),
		plugin.documentPanels.length && __( 'Page settings' ),
		plugin.actions.length && __( 'Actions' ),
	]
		.filter( Boolean )
		.join( ' · ' );
}
