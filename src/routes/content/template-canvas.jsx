/**
 * The canvas beside a Layouts tab: the layout picked there, as a site canvas.
 *
 * Browse shows the layout on the site, on a post or page that would use it,
 * or at the site's address for a layout of lists like Posts Listing. Edit
 * changes the layout itself, in place, with plain blocks: no sections and no
 * Compose.
 *
 * A layout is shared by every post or page that uses it, so the canvas is in
 * the purple of what more than one page shares, the blocks in the editor too,
 * as the header and footer's are. See `src/global-scope`.
 */

/**
 * Internal dependencies
 */
import { GLOBAL_CANVAS_CSS, GlobalScope } from '../../global-scope';
import { settings } from '../../settings';
import { DocumentTitle, SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { useCanvasStyles } from '../../site-canvas/use-canvas-styles';
import { getTemplateIcon, getTemplateTitle } from './helpers';
import { getTemplatePreviewUrl } from './template-preview-url';
import { __, Icon, useMemo, useRef } from '../../wordpress-packages';

const GLOBAL_STYLE_ID = 'cnl-template-canvas-global';

/**
 * @param {Object} props
 * @param {Object} props.template Template record.
 * @return {Element} The layout's name, for the canvas toolbar.
 */
function TemplateDocument( { template } ) {
	return (
		<div className="cnl-editor-homepage-document is-global">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ getTemplateIcon( template ) }
					/>
					<DocumentTitle title={ getTemplateTitle( template ) } />
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ __( 'Layout · Changes everywhere it is used' ) }
				</p>
			</div>
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {Object[]} props.records  Posts or pages of the screen's type, to
 *                                  show a layout for one of them on.
 * @param {Object}   props.template Template record.
 * @return {Element} The canvas.
 */
export default function TemplateCanvas( { records, template } ) {
	const templateId = template.id;
	const editorRef = useRef();
	const pinnedEntity = useMemo(
		() => ( { postId: templateId, postType: 'wp_template' } ),
		[ templateId ]
	);
	const canvas = useSiteCanvas( {
		pinnedEntity,
		url: getTemplatePreviewUrl( {
			homeUrl: settings.homeUrl,
			records,
			template,
		} ),
	} );

	useCanvasStyles( true, editorRef, GLOBAL_STYLE_ID, GLOBAL_CANVAS_CSS );

	return (
		<GlobalScope>
			<SiteCanvas
				canvas={ canvas }
				className="cnl-template-canvas"
				document={ <TemplateDocument template={ template } /> }
				editorRef={ editorRef }
				// A layout is edited block by block, with core's own tools,
				// rather than as a page's sections: it is the more advanced
				// job, and it is mostly the title, image and content that
				// each page fills in.
				hasSections={ false }
			/>
		</GlobalScope>
	);
}
