/**
 * The homepage, opened up on the Pages screen.
 *
 * It belongs to the homepage rather than to a page, so it is there whatever
 * the homepage shows, even when no page has ever been picked for it. It is
 * the page's own drilldown when it shows a page, or a word about the latest
 * posts when it lists them. "Configure homepage" opens the step-by-step
 * setup to change what it shows.
 */

/**
 * Internal dependencies
 */
import ScreenLinks from '../../../screen-links';
import useMainMenu from '../use-main-menu';
import { getPageTitle } from './data';
import {
	useHomepageState,
	useSwitchHomepage,
	useUseAsHomepage,
} from './homepage';
import { isFrontPageTemplateId } from './homepage-state';
import PostsPerPage from './posts-per-page';
import HomepageSetup from '../../../pickers/homepage-setup';
import useOnHomepageSetupDone from '../../../pickers/homepage-setup/use-on-done';
import { PageDetailStage } from './stage';
import {
	__,
	Breadcrumbs,
	layoutIcon,
	memo,
	Notice,
	Page,
	postIcon,
	settingsIcon,
	sprintf,
	Text,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';

/**
 * Says so when visitors can't see the homepage, with ways to put it right.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.homepage Result of `useHomepageState`.
 * @return {?Element} The notice, if there's a problem.
 */
function HomepageProblem( { homepage } ) {
	const { menuId } = useMainMenu();
	const { showLatestPosts } = useSwitchHomepage( homepage );
	const useAsHomepage = useUseAsHomepage( homepage );

	if ( ! homepage.problem ) {
		return null;
	}

	const actions = [];

	if ( homepage.problem === 'unpublished' && homepage.page ) {
		actions.push( {
			label: sprintf(
				/* translators: %s: page title. */
				__( 'Publish “%s”' ),
				getPageTitle( homepage.page )
			),
			onClick: () => useAsHomepage.request( homepage.page ),
			variant: 'secondary',
		} );
	}

	if ( homepage.canSwitch ) {
		actions.push( {
			label: __( 'Show your latest posts' ),
			onClick: () => showLatestPosts( menuId ),
			variant: 'link',
		} );
	}

	return (
		<>
			<Notice
				actions={ actions }
				className="cnl-homepage-problem"
				isDismissible={ false }
				status="warning"
			>
				{ homepage.problem === 'missing'
					? __(
							'Visitors can’t see your homepage. The page it showed has gone. Pick another page, or show your latest posts.'
						)
					: __(
							'Visitors can’t see your homepage, as its page isn’t published. Publish it, pick another page, or show your latest posts.'
						) }
			</Notice>
			{ useAsHomepage.modal }
		</>
	);
}

function getSentence( homepage ) {
	if ( homepage.shows === 'theme' ) {
		return __(
			'Your theme designs your homepage, so it always looks like this.'
		);
	}

	if ( homepage.canSwitch ) {
		return '';
	}

	return homepage.shows === 'posts'
		? __( 'Your homepage shows your latest posts.' )
		: sprintf(
				/* translators: %s: page title. */
				__( 'Your homepage shows “%s”.' ),
				getPageTitle( homepage.page )
			);
}

/**
 * The top of the homepage: anything wrong with it, and what it shows. What it
 * shows can be changed, but that is tucked away behind "Configure homepage",
 * as most sites never need it.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.homepage Result of `useHomepageState`.
 * @return {Element} The intro.
 */
function HomepageIntro( { homepage } ) {
	const sentence = getSentence( homepage );

	return (
		<>
			<HomepageProblem homepage={ homepage } />
			{ sentence && (
				<Text className="cnl-homepage-intro" variant="body-md">
					{ sentence }
				</Text>
			) }
		</>
	);
}

const MemoizedHomepageIntro = memo( HomepageIntro );

/**
 * Where to change how the latest posts look: the layout listing them, among
 * the posts' layouts or the pages', or every layout when it is `index`.
 *
 * @param {string} templateId The layout's ID.
 * @return {Object} `{ search, to }`.
 */
function getLayoutDestination( templateId ) {
	const search = { content: 'templates', postIds: [ templateId ] };

	if ( String( templateId ).endsWith( '//home' ) ) {
		return { search, to: '/types/post/list/all' };
	}

	if ( isFrontPageTemplateId( templateId ) ) {
		return { search, to: LIST_PATH };
	}

	return { to: '/templates' };
}

/**
 * The homepage when no page is behind it: a word about what it lists, how
 * many it lists at once, and ways on to its layout, the posts and what it
 * shows. The layout is a way on rather than a picker here, as the latest
 * posts always use the one layout, so there is nothing to choose between.
 *
 * @param {Object}    props              Component props.
 * @param {boolean}   props.canConfigure Whether what the homepage shows can
 *                                       be changed.
 * @param {Object}    props.homepage     Result of `useHomepageState`.
 * @param {?Function} props.onConfigure  Opens the homepage setup.
 * @return {Element} The body.
 */
function LatestPostsBody( { canConfigure, homepage, onConfigure } ) {
	const layout = homepage.latestPostsTemplateId
		? getLayoutDestination( homepage.latestPostsTemplateId )
		: null;

	return (
		<>
			{ homepage.shows === 'posts' && (
				<Text className="cnl-homepage-intro" variant="body-md">
					{ __( 'Shows your newest posts, newest first.' ) }
				</Text>
			) }
			{ homepage.shows === 'posts' && canConfigure && <PostsPerPage /> }
			<ScreenLinks
				label={ __( 'More for your homepage' ) }
				links={ [
					layout && {
						description: __(
							'Change how your posts are displayed'
						),
						icon: layoutIcon,
						search: layout.search,
						title: __( 'Change layout' ),
						to: layout.to,
					},
					{
						description: __( 'Write, edit and publish blog posts' ),
						icon: postIcon,
						title: __( 'Edit your posts' ),
						to: '/types/post/list/all',
					},
					onConfigure && {
						description: __( 'Choose what visitors see first' ),
						icon: settingsIcon,
						onOpen: onConfigure,
						title: __( 'Configure homepage' ),
					},
				].filter( Boolean ) }
			/>
		</>
	);
}

/**
 * The homepage, opened up. "Configure homepage" opens the same step-by-step
 * setup as Home's notice (`src/pickers/homepage-setup/`), which asks first
 * what the homepage shows.
 *
 * @return {Element} The homepage stage.
 */
export default function HomepageStage() {
	const homepage = useHomepageState();
	const { menuId } = useMainMenu();
	const [ isConfiguring, setIsConfiguring ] = useState( false );
	const onDone = useOnHomepageSetupDone( () => setIsConfiguring( false ) );
	const canConfigure = homepage.canSwitch && homepage.shows !== 'theme';
	const onConfigure = canConfigure ? () => setIsConfiguring( true ) : null;
	const intro = <MemoizedHomepageIntro homepage={ homepage } />;
	const setup = isConfiguring && (
		<HomepageSetup
			menuId={ menuId }
			onClose={ () => setIsConfiguring( false ) }
			onDone={ onDone }
		/>
	);

	if ( homepage.pageId ) {
		return (
			<>
				<PageDetailStage
					intro={ intro }
					isHomepage
					key={ homepage.pageId }
					onConfigureHomepage={ onConfigure }
					pageId={ homepage.pageId }
				/>
				{ setup }
			</>
		);
	}

	return (
		<Page
			ariaLabel={ __( 'Homepage' ) }
			breadcrumbs={
				<Breadcrumbs
					items={ [
						{ label: __( 'Pages' ), to: LIST_PATH },
						{ label: __( 'Homepage' ) },
					] }
				/>
			}
			className="cnl-editor-stage cnl-pages-detail"
			hasPadding={ false }
			headingLevel={ 2 }
		>
			<div className="cnl-pages-detail__body">
				{ ! homepage.isLoading && intro }
				{ ! homepage.isLoading && (
					<LatestPostsBody
						canConfigure={ canConfigure }
						homepage={ homepage }
						onConfigure={ onConfigure }
					/>
				) }
			</div>
			{ setup }
		</Page>
	);
}
