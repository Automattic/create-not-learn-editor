/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import {
	color,
	home,
	layout,
	navigation,
	pages,
	postList,
	siteLogo,
	sites,
	styles,
	symbol,
	symbolFilled,
	typography,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { mountAdminBar } from '../../../src/admin-bar';
import { preloadDeferredWhenIdle } from '../../../src/app-init-deferred';
import { registerBlockToolbar } from '../../../src/block-toolbar';
import { mountChat } from '../../../src/chat';
import { mountCommands } from '../../../src/commands';
import { registerBlockBindings } from '../../../src/editor-extensions/block-bindings';
import { registerPageListExcludedPages } from '../../../src/editor-extensions/page-list-excluded-pages';
import { registerProductBlocks } from '../../../src/editor-extensions/product-blocks';
import { registerSectionMenu } from '../../../src/editor-extensions/section-menu';
import { registerSectionPatterns } from '../../../src/editor-extensions/section-patterns';
import { registerTemplatePartEditing } from '../../../src/editor-extensions/template-part-editing';
import { mountEditorLayer } from '../../../src/editor-layer';
import { registerLayoutWireframes } from '../../../src/layouts';
import { mountTopBar } from '../../../src/top-bar';
import { mountWorkspaces } from '../../../src/workspaces';
import { mountPreferences } from '../../../src/preferences';
import { trackHomeTrip } from '../../../src/home-trip';
import { mountMenuSections } from './menu-sections';
import { enhanceSidebar } from './sidebar';

export async function init() {
	// Back leads straight to Home from anything reached through it.
	trackHomeTrip();
	registerPageListExcludedPages();
	registerBlockBindings();
	registerSectionPatterns();
	registerSectionMenu();
	registerBlockToolbar();
	registerProductBlocks();
	registerTemplatePartEditing();
	registerLayoutWireframes();
	mountEditorLayer();

	// PHP can only hand boot dashicon strings; swap in @wordpress/icons SVGs
	// here, as WordPress 7.2 is doing for its own admin menu.
	const menuIcons = {
		colors: color,
		fonts: typography,
		home,
		identity: siteLogo,
		navigation,
		pages,
		patterns: symbol,
		'content-post': postList,
		'site-overview': sites,
		styles,
		templateParts: symbolFilled,
		templates: layout,
	};

	Object.entries( menuIcons ).forEach( ( [ id, icon ] ) => {
		dispatch( bootStore ).updateMenuItem( id, { icon } );
	} );

	mountWorkspaces();
	mountMenuSections();
	mountPreferences();
	mountAdminBar();
	mountTopBar();
	mountCommands();
	mountChat();
	enhanceSidebar( { userName: window.createNotLearnEditor?.userName } );

	// The chat's panel and the section picker, ready before they're opened.
	preloadDeferredWhenIdle();
}
