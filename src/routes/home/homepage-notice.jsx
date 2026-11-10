/**
 * A word on Home when the homepage isn't what the workspace expects.
 *
 * New WordPress sites open on the latest posts, while many people want a
 * website that opens on a page of its own. Changing WordPress's default
 * would upset bloggers, so instead each workspace says which it expects
 * (`home.expectsHomepage`), and Home offers to set the site up that way when
 * it differs. The button opens a guided dialog (`src/pickers/homepage-setup/`)
 * that saves as it finishes.
 *
 * Only for people who can change the site's settings. Not shown when the
 * theme designs the homepage itself, when the homepage has a problem of its
 * own, which the Pages screen already flags, or, for writers, when the
 * homepage is a page but the posts have a page of their own. Dismissing it hides it in
 * this workspace for good, for this person; another workspace can still say
 * its piece.
 */

/**
 * WordPress dependencies
 */
import { store as preferencesStore } from '@wordpress/preferences';
import { Notice } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import HomepageSetup from '../../pickers/homepage-setup';
import { isHomepageMismatched } from '../../pickers/homepage-setup/plan';
import useOnHomepageSetupDone from '../../pickers/homepage-setup/use-on-done';
import { useHomepageState } from '../content/pages/homepage';
import useMainMenu from '../content/use-main-menu';
import {
	PREFERENCES_SCOPE,
	getActiveWorkspace,
} from '../../workspaces/presets';
import {
	__,
	coreDataStore,
	dispatch,
	select,
	useSelect,
	useState,
} from '../../wordpress-packages';

// The workspaces this person has dismissed the notice in, by id.
const DISMISSED_PREFERENCE = 'dismissedHomepageNotices';
const EMPTY_ARRAY = [];

const COPY = {
	page: {
		action: __( 'Set up a homepage' ),
		description: __(
			'Your homepage lists your latest posts. Many websites open on a page of their own instead, with posts on their own pages (e.g. /blog).'
		),
		title: __( 'Visitors land on your latest posts' ),
	},
	posts: {
		action: __( 'Show my posts first' ),
		description: __(
			'Your homepage is a page, so visitors don’t see what you’ve just written when they arrive. Most blogs open on the latest posts.'
		),
		title: __( 'Visitors land on a page, not your posts' ),
	},
};

export default function HomepageNotice() {
	const workspace = useSelect( getActiveWorkspace, [] );
	const expects = workspace.home.expectsHomepage;
	const homepage = useHomepageState();
	const { menuId } = useMainMenu();
	// Whether the posts have a page of their own, unsaved changes included.
	const hasPostsPage = useSelect(
		( selectStore ) =>
			!! Number(
				selectStore( coreDataStore ).getEditedEntityRecord(
					'root',
					'site'
				)?.page_for_posts
			),
		[]
	);
	const isMismatched = isHomepageMismatched( homepage, expects, {
		hasPostsPage,
	} );
	const isDismissed = useSelect(
		( selectStore ) =>
			(
				selectStore( preferencesStore ).get(
					PREFERENCES_SCOPE,
					DISMISSED_PREFERENCE
				) || EMPTY_ARRAY
			).includes( workspace.id ),
		[ workspace.id ]
	);
	const [ isSettingUp, setIsSettingUp ] = useState( false );
	const onDone = useOnHomepageSetupDone( () => setIsSettingUp( false ) );

	if (
		! isSettingUp &&
		( isDismissed ||
			homepage.isLoading ||
			! homepage.canSwitch ||
			! isMismatched )
	) {
		return null;
	}

	const copy = COPY[ expects ] || COPY.page;

	const dismiss = () => {
		const dismissed =
			select( preferencesStore ).get(
				PREFERENCES_SCOPE,
				DISMISSED_PREFERENCE
			) || EMPTY_ARRAY;

		dispatch( preferencesStore ).set(
			PREFERENCES_SCOPE,
			DISMISSED_PREFERENCE,
			[ ...new Set( [ ...dismissed, workspace.id ] ) ]
		);
	};

	return (
		<>
			{ isDismissed || ! isMismatched ? null : (
				<Notice.Root className="cnl-homepage-notice" intent="info">
					<Notice.Title>{ copy.title }</Notice.Title>
					<Notice.Description>
						{ copy.description }
					</Notice.Description>
					<Notice.Actions>
						<Notice.ActionButton
							onClick={ () => setIsSettingUp( true ) }
						>
							{ copy.action }
						</Notice.ActionButton>
					</Notice.Actions>
					<Notice.CloseIconButton
						label={ __( 'Don’t show this again here' ) }
						onClick={ dismiss }
					/>
				</Notice.Root>
			) }
			{ isSettingUp && (
				<HomepageSetup
					expects={ expects }
					menuId={ menuId }
					onClose={ () => setIsSettingUp( false ) }
					onDone={ onDone }
				/>
			) }
		</>
	);
}
