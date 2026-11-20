/**
 * Internal dependencies
 */
import { Breadcrumbs, Page, __ } from '../../wordpress-packages';

/**
 * A screen under Design. Screens under Design lead with a breadcrumb back to
 * it, as there is no sidebar item to return by. Back retraces the way the
 * screen was reached, wherever that began.
 *
 * @param {Object}  props             Component props.
 * @param {Node}    props.children    The screen's contents.
 * @param {string}  props.description Sentence under the title.
 * @param {boolean} props.isTopLevel  Whether this is the Design screen itself.
 * @param {string}  props.title       Screen title.
 * @return {Node} The screen.
 */
export function DesignPage( { children, description, isTopLevel, title } ) {
	const breadcrumbs = isTopLevel ? undefined : (
		<Breadcrumbs
			items={ [
				{ label: __( 'Design' ), to: '/design' },
				{ label: title },
			] }
		/>
	);

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
