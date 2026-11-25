/**
 * The homepage setup plan, with what the person chose in the dialog.
 */

/**
 * An old homepage or posts page, with what the person chose for it.
 *
 * @param {?Object} old    `{ page, isInMenu, leaveMenu, toTrash }`.
 * @param {Object}  chosen `{ leaveMenu, toTrash }`, as changed.
 * @return {?Object} The page's plan.
 */
function withOldPageChoices( old, chosen = {} ) {
	if ( ! old ) {
		return old;
	}

	const toTrash = chosen.toTrash ?? old.toTrash;

	return {
		...old,
		// A page in the trash can't stay in the menu.
		leaveMenu: toTrash || ( chosen.leaveMenu ?? old.leaveMenu ),
		toTrash,
	};
}

/**
 * Every page but the one offered as the homepage, for anyone who wants
 * another.
 *
 * @param {Object} plan  Result of `getHomepageSetupPlan`.
 * @param {Array}  pages Every page.
 * @return {Object[]} The pages.
 */
export function getOtherPages( plan, pages ) {
	const offered = plan.homepage.page?.id;
	const others = pages.filter(
		( page ) => ! offered || Number( page.id ) !== Number( offered )
	);
	const isPublished = ( page ) => page.status === 'publish';

	// Published pages first, as one of those is the likely choice.
	return [
		...others.filter( isPublished ),
		...others.filter( ( page ) => ! isPublished( page ) ),
	];
}

/**
 * The page chosen as the homepage from the other pages: the one picked, or
 * else the first.
 *
 * @param {Object}  plan  Result of `getHomepageSetupPlan`.
 * @param {Array}   pages Every page.
 * @param {?string} id    The page picked, if any.
 * @return {?Object} The page.
 */
function getOtherHomepage( plan, pages, id ) {
	const others = getOtherPages( plan, pages );

	return (
		others.find( ( page ) => String( page.id ) === String( id ) ) ||
		others[ 0 ] ||
		null
	);
}

/**
 * The plan, with whatever the person changed along the way.
 *
 * @param {Object} plan    Result of `getHomepageSetupPlan`.
 * @param {Object} choices What was changed.
 * @param {Array}  pages   Every page.
 * @return {Object} The plan to carry out.
 */
export function withChoices( plan, choices, pages ) {
	if ( plan.to === 'posts' ) {
		return {
			...plan,
			oldHomepage: withOldPageChoices(
				plan.oldHomepage,
				choices.oldHomepage
			),
			oldPostsPage: withOldPageChoices(
				plan.oldPostsPage,
				choices.oldPostsPage
			),
		};
	}

	const homepage = choices.isOtherHomepage
		? getOtherHomepage( plan, pages, choices.homepageId )
		: plan.homepage.page;
	const postsPage =
		plan.posts.page && plan.posts.page.id === homepage?.id
			? null
			: plan.posts.page;
	const typedTitle = ( choices.postsTitle ?? '' ).trim();

	return {
		...plan,
		homepage: { ...plan.homepage, page: homepage },
		posts: {
			...plan.posts,
			isOn: choices.postsOn ?? plan.posts.isOn,
			newTitle: typedTitle || plan.posts.newTitle,
			page: postsPage,
		},
		useMenu: choices.useMenu ?? plan.useMenu,
	};
}
