/**
 * A "Create not Learn" section of preferences, for the ones that are this
 * editor's own rather than core's. It shows in two places.
 *
 * - In the editor's Preferences. Core's preferences modal takes extra
 *   sections only from whatever renders it, and the editor here renders it
 *   without any. So, as the editor layer does elsewhere, the section is
 *   portalled in from outside: while the modal is open, it is added to the
 *   end of the General tab, where core puts the extra sections it is given.
 * - In Preferences of its own, opened from the workspace menu at the foot of
 *   the sidebar and the command palette on every other screen. Core's modal is the editor's,
 *   with options only the editor has, so it isn't there to open.
 *
 * Both are built from core's own preference controls, so the section looks
 * and works like the sections around it.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as it is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { Modal } from '@wordpress/components';
import { dispatch, useSelect } from '@wordpress/data';
import { createPortal, createRoot, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { privateApis as preferencesPrivateApis } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import {
	ADD_PAGE_PREFERENCES_SCOPE,
	registerAddPagePreferences,
	SHOW_PAGE_DESIGNS_PREFERENCE,
} from '../add-page-preferences';
import { usePortalHost } from '../editor-layer/portal-host';
import { unlock } from '../lock-unlock';
import {
	ASK_POST_KIND_PREFERENCE,
	POST_KINDS_PREFERENCES_SCOPE,
	registerPostKindPreferences,
} from '../post-kinds-base';

const { PreferencesModalSection, PreferenceToggleControl } = unlock(
	preferencesPrivateApis
);

// Core's modal, and the panel of its General tab.
const EDITOR_PREFERENCES_MODAL = 'editor/preferences';
const GENERAL_PANEL =
	'.preferences-modal [role="tabpanel"][id$="-general-view"]';

// Preferences of its own, for every screen but the editor.
const PREFERENCES_MODAL = 'create-not-learn-editor/preferences';

/**
 * Keep a host last in its parent, as the parent's own children may be drawn
 * after it was added.
 *
 * @param {?Element} host The host.
 */
function useKeptLast( host ) {
	useEffect( () => {
		const parent = host?.parentElement;

		if ( ! parent ) {
			return undefined;
		}

		const keepLast = () => {
			if ( host.nextElementSibling ) {
				parent.append( host );
			}
		};
		const observer = new window.MutationObserver( keepLast );

		keepLast();
		observer.observe( parent, { childList: true } );

		return () => observer.disconnect();
	}, [ host ] );
}

/**
 * @return {Element} The section.
 */
function CreateNotLearnSection() {
	return (
		<PreferencesModalSection title={ __( 'Create not Learn' ) }>
			<PreferenceToggleControl
				featureName={ ASK_POST_KIND_PREFERENCE }
				help={ __(
					'Writing a post starts by asking what kind it is, like a note, a photo or a quote.'
				) }
				label={ __( 'Ask what I’m posting' ) }
				scope={ POST_KINDS_PREFERENCES_SCOPE }
			/>
			<PreferenceToggleControl
				featureName={ SHOW_PAGE_DESIGNS_PREFERENCE }
				help={ __(
					'Adding a page starts with designs to choose from. Turned off, it goes straight to naming a blank page.'
				) }
				label={ __( 'Show designs when adding a page' ) }
				scope={ ADD_PAGE_PREFERENCES_SCOPE }
			/>
		</PreferencesModalSection>
	);
}

/**
 * The section, at the end of the editor's General tab once it is on screen.
 *
 * @return {?Element} The section.
 */
function InEditorPreferences() {
	const host = usePortalHost( GENERAL_PANEL, 'cnl-preferences-host' );

	useKeptLast( host );

	if ( ! host ) {
		return null;
	}

	return createPortal( <CreateNotLearnSection />, host );
}

/**
 * Open Preferences: the editor's in the full-screen editor, where it has
 * this section too, and this editor's own everywhere else.
 */
export function openPreferences() {
	const isInEditor = !! document.querySelector(
		'#create-not-learn-editor-app [class*="__has-full-canvas"]'
	);

	dispatch( 'core/interface' ).openModal(
		isInEditor ? EDITOR_PREFERENCES_MODAL : PREFERENCES_MODAL
	);
}

/**
 * Watches for either modal only while it is open.
 *
 * @return {?Element} The section, while a modal is open.
 */
function Preferences() {
	const activeModal = useSelect( ( select ) => {
		const isModalActive = select( 'core/interface' )?.isModalActive;

		return [ EDITOR_PREFERENCES_MODAL, PREFERENCES_MODAL ].find( ( name ) =>
			isModalActive?.( name )
		);
	}, [] );

	if ( activeModal === EDITOR_PREFERENCES_MODAL ) {
		return <InEditorPreferences />;
	}

	if ( activeModal === PREFERENCES_MODAL ) {
		return (
			<Modal
				className="cnl-preferences"
				onRequestClose={ () =>
					dispatch( 'core/interface' ).closeModal()
				}
				size="medium"
				title={ __( 'Preferences' ) }
			>
				<CreateNotLearnSection />
			</Modal>
		);
	}

	return null;
}

/**
 * Set this editor's preferences up, and add their section to Preferences.
 */
export function mountPreferences() {
	registerPostKindPreferences();
	registerAddPagePreferences();

	const container = document.createElement( 'div' );
	container.className = 'cnl-preferences-root';
	document.body.append( container );
	createRoot( container ).render( <Preferences /> );
}
