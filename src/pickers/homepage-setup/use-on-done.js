/**
 * What happens once the homepage is set up: say so, and show the homepage.
 *
 * Shared by everywhere the homepage setup dialog opens from, so finishing it
 * ends the same way wherever it started.
 */

/**
 * WordPress dependencies
 */
import { dispatch } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';

/**
 * The words to say once the homepage is set up.
 *
 * @param {Object}  result           What the dialog did.
 * @param {Object}  result.plan      The plan it carried out.
 * @param {?Object} result.homepage  The page that's now the homepage.
 * @param {?Object} result.postsPage The page that now lists the posts.
 * @return {string} The message.
 */
export function getDoneMessage( { plan, homepage, postsPage } ) {
	if ( plan.to === 'posts' ) {
		return __( 'Your homepage now lists your latest posts.' );
	}

	const homeTitle = homepage?.title?.raw || plan.homepage.newTitle;

	if ( postsPage ) {
		return sprintf(
			/* translators: 1: homepage title. 2: posts page title. */
			__( 'Your homepage is now “%1$s”. Your posts are on “%2$s”.' ),
			homeTitle,
			postsPage.title?.raw || plan.posts.newTitle
		);
	}

	return sprintf(
		/* translators: %s: homepage title. */
		__( 'Your homepage is now “%s”.' ),
		homeTitle
	);
}

/**
 * Ends the homepage setup: a snackbar saying what changed, then the new
 * homepage page, in Edit when it was just made, to add to straight away.
 *
 * @param {Function} [onClose] Closes the dialog.
 * @return {Function} The dialog's `onDone`.
 */
export default function useOnHomepageSetupDone( onClose ) {
	const navigate = useNavigate();

	return ( result ) => {
		onClose?.();
		dispatch( noticesStore ).createSuccessNotice(
			getDoneMessage( result ),
			{ type: 'snackbar' }
		);

		if ( result.plan.to !== 'page' ) {
			return;
		}

		navigate( {
			search: { postId: 'home', previewId: 'home' },
			to: '/types/page/list/all',
		} );

		if ( ! result.plan.homepage.page ) {
			setCanvasMode( MODE_EDIT );
		}
	};
}
