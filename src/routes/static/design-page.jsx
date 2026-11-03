/**
 * Internal dependencies
 */
import { useSiteTrail, useTrailSearch } from '../../site-trail';
import { Breadcrumbs, Page, __ } from '../../wordpress-packages';

/**
 * A screen under Design. Screens linked from Design lead with a breadcrumb
 * back to it, as there is no sidebar item to return by. Opened from the
 * "Home" screen, they lead back there instead, and so does Design
 * itself. Screens only Design links to, like Colors, keep Design in the trail
 * after "Home", as that is the way they were reached.
 *
 * @param {Object}  props             Component props.
 * @param {Node}    props.children    The screen's contents.
 * @param {string}  props.description Sentence under the title.
 * @param {boolean} props.isTopLevel  Whether this is the Design screen itself.
 * @param {boolean} props.isInDesign  Whether the screen is reached only from
 *                                    Design.
 * @param {string}  props.title       Screen title.
 * @return {Node} The screen.
 */
export function DesignPage( {
	children,
	description,
	isInDesign,
	isTopLevel,
	title,
} ) {
	const trail = useSiteTrail();
	const trailSearch = useTrailSearch();
	let breadcrumbs;

	if ( isTopLevel && trail.length ) {
		breadcrumbs = <Breadcrumbs items={ [ ...trail, { label: title } ] } />;
	} else if ( ! isTopLevel ) {
		breadcrumbs = (
			<Breadcrumbs
				items={ [
					...trail,
					...( ! trail.length || isInDesign
						? [
								{
									label: __( 'Design' ),
									to: trailSearch
										? `/design?${ new URLSearchParams(
												trailSearch
											) }`
										: '/design',
								},
							]
						: [] ),
					{ label: title },
				] }
			/>
		);
	}

	return (
		<Page
			breadcrumbs={ breadcrumbs }
			className="cnl-editor-stage cnl-editor-content-page"
			hasPadding={ false }
			headingLevel={ 1 }
			subTitle={ description }
			title={ breadcrumbs ? undefined : title }
		>
			<div className="cnl-editor-stage routes-styles">{ children }</div>
		</Page>
	);
}
