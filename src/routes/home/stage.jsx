/**
 * Internal dependencies
 */
import { startHomeTrip } from '../../home-trip';
import ScreenLinks from '../../screen-links';
import { getStartPlaces } from '../../start-places';
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';
import { requestDistractionFreeEntry } from '../../editor-layer/distraction-free';
import { getActiveWorkspace } from '../../workspaces/presets';
import { isAskingPostKind } from '../../post-kinds-base';
import PostKindPicker from '../../pickers/post-kinds';
import BlogAdmin from './blog-admin';
import { SiteAddress, SiteMark, SiteStatus, useSite } from './site-card';
import {
	Page,
	Stack,
	Text,
	__,
	useSelect,
	useState,
} from '../../wordpress-packages';

/*
 * Where each place to start opens. People don't build a site in any set
 * order, so the places are offered as equal choices rather than numbered
 * steps, and nothing is marked done. Each screen's Back leads back here.
 */
const START_ROUTES = {
	home: {
		// The homepage opened up on the Pages screen, where what it shows,
		// its sections and its layout all live. `home` stands for it there
		// (`HOMEPAGE` in the Pages screen), whatever it shows.
		onSelect: () => setCanvasMode( MODE_EDIT ),
		search: { postId: 'home', previewId: 'home' },
		to: '/types/page/list/all',
	},
	pages: { to: '/types/page/list/default' },
	identity: { to: '/design/identity' },
	style: { to: '/design' },
	siteParts: { to: '/design/header-footer' },
	// Starts a post straight away rather than opening a screen.
	write: { isAction: true, to: '/types/post/new' },
	posts: { to: '/types/post/list/all' },
	shop: { to: '/shop' },
	// Gutenberg's own Styles and Templates screens
	// (`includes/gutenberg-routes.php`). Templates goes straight to its
	// list, as Gutenberg's redirect from `/templates` drops the way back.
	globalStyles: { to: '/styles' },
	templates: { to: '/templates/list/all' },
	templateParts: { to: '/template-parts' },
	patterns: { to: '/patterns' },
};

function getStartLinks( workspace, { isAskingKind, onPickPostKind } ) {
	return getStartPlaces( workspace.home ).map( ( place ) => {
		const route = START_ROUTES[ place.id ];
		const link = {
			...place,
			...route,
			// Back on whatever this opens leads straight back here.
			onSelect: () => {
				startHomeTrip();
				route?.onSelect?.();
			},
		};

		if ( place.id !== 'write' ) {
			return link;
		}

		// Asked what kind of post it is first, unless they'd rather not be.
		if ( isAskingKind ) {
			return { ...link, onOpen: onPickPostKind, to: undefined };
		}

		// A new post opens with nothing but the writing on show.
		if ( workspace.writeInFocus ) {
			link.onSelect = () => {
				startHomeTrip();
				requestDistractionFreeEntry();
			};
		}

		return link;
	} );
}

export default function Stage() {
	const site = useSite();
	const workspace = useSelect( getActiveWorkspace, [] );
	const isAskingKind = useSelect(
		( select ) => isAskingPostKind( select, workspace ),
		[ workspace ]
	);
	const [ isPickingPostKind, setIsPickingPostKind ] = useState( false );

	return (
		<Page
			className="cnl-editor-stage cnl-editor-content-page"
			hasPadding={ false }
			headingLevel={ 1 }
			// Above every other screen, so it has no Back.
			isRoot
			badges={ <SiteStatus /> }
			subTitle={
				<SiteAddress fallbackLabel={ workspace.home.viewLabel } />
			}
			title={ site.name || __( 'Untitled site' ) }
			visual={ <SiteMark { ...site } /> }
		>
			<div className="cnl-editor-stage cnl-site-hub">
				<Stack direction="column" gap="sm">
					<ScreenLinks
						label={ __( 'Start working on your site' ) }
						links={ getStartLinks( workspace, {
							isAskingKind,
							onPickPostKind: () => setIsPickingPostKind( true ),
						} ) }
					/>
				</Stack>
				{ !! workspace.home.adminLinks.length && (
					<BlogAdmin ids={ workspace.home.adminLinks } />
				) }
				{ workspace.home.hint && (
					<Text className="cnl-site-hub__hint" variant="body-sm">
						{ workspace.home.hint }
					</Text>
				) }
			</div>
			{ isPickingPostKind && (
				<PostKindPicker
					isFocusedOpen={ workspace.writeInFocus }
					onClose={ () => setIsPickingPostKind( false ) }
				/>
			) }
		</Page>
	);
}
