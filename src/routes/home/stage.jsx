/**
 * Internal dependencies
 */
import ScreenLinks from '../../screen-links';
import { getStartPlaces } from '../../start-places';
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';
import { FROM_SITE_SEARCH } from '../../site-trail';
import { requestDistractionFreeEntry } from '../../editor-layer/distraction-free';
import { getActiveWorkspace } from '../../workspaces/presets';
import { isAskingPostKind } from '../../post-kinds-base';
import PostKindPicker from '../../pickers/post-kinds';
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
 * steps, and nothing is marked done. Each screen's breadcrumbs lead back here.
 */
const START_ROUTES = {
	home: {
		// The homepage opened up on the Pages screen, where what it shows,
		// its sections and its layout all live. `home` stands for it there
		// (`HOMEPAGE` in the Pages screen), whatever it shows.
		onSelect: () => setCanvasMode( MODE_EDIT ),
		search: { postId: 'home', previewId: 'home', ...FROM_SITE_SEARCH },
		to: '/types/page/list/all',
	},
	pages: { to: '/types/page/list/default' },
	identity: { to: '/design/identity' },
	style: { to: '/design' },
	siteParts: { to: '/design/header-footer' },
	write: { to: '/types/post/new' },
	posts: { to: '/types/post/list/all' },
};

function getStartLinks( workspace, { isAskingKind, onPickPostKind } ) {
	return getStartPlaces( workspace.home ).map( ( place ) => {
		const link = {
			...place,
			search: FROM_SITE_SEARCH,
			...START_ROUTES[ place.id ],
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
			link.onSelect = requestDistractionFreeEntry;
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
				<Text className="cnl-site-hub__hint" variant="body-sm">
					{ workspace.home.hint }
				</Text>
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
