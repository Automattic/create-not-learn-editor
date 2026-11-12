/**
 * The canvas beside a Layouts tab: the layout picked there, as a site canvas.
 *
 * Browse shows the layout on the site, on a post or page that would use it,
 * or at the site's address for a layout of lists like Posts Listing. Edit
 * changes the layout itself, in place. A layout isn't built from sections
 * unless the site says so (`src/sections.js`), so by default it is edited
 * with plain blocks: no sections and no Compose.
 *
 * A layout is edited with core's full block tools. Core treats the blocks a
 * pattern adds as a content-only section, whether the theme's layout places
 * the pattern or a section was added from one, which would leave only their
 * words to change. So patterns are opened up while a layout is edited, with
 * core's own setting, as its "Enable editing all patterns" command does.
 * Headers and footers keep core's lock: they are on every layout, and are
 * opened on purpose.
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
import { getSystemPage } from './pages/system-pages';
import { getTemplatePreviewUrl } from './template-preview-url';
import { __, Icon, useMemo, useRef } from '../../wordpress-packages';

const GLOBAL_STYLE_ID = 'cnl-template-canvas-global';

const EDITOR_SETTINGS = { disableContentOnlyForUnsyncedPatterns: true };

/**
 * @param {Object}  props
 * @param {boolean} props.isSystemPage Whether the layout makes one of the
 *                                     system pages, listed by Pages.
 * @param {Object}  props.template     Template record.
 * @return {Element} The layout's name, for the canvas toolbar.
 */
function TemplateDocument( { isSystemPage, template } ) {
	const systemPage = isSystemPage ? getSystemPage( template ) : null;

	return (
		<div className="cnl-editor-homepage-document is-global">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ systemPage?.icon || getTemplateIcon( template ) }
					/>
					<DocumentTitle
						title={
							systemPage?.title || getTemplateTitle( template )
						}
					/>
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ systemPage
						? __( 'System page · Your site makes this one' )
						: __( 'Layout · Changes everywhere it is used' ) }
				</p>
			</div>
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {boolean}  props.isSystemPage Whether the layout makes one of the
 *                                      system pages, listed by Pages.
 * @param {Object[]} props.records      Posts or pages of the screen's type,
 *                                      to show a layout for one of them on.
 * @param {Object}   props.template     Template record.
 * @return {Element} The canvas.
 */
export default function TemplateCanvas( { isSystemPage, records, template } ) {
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

	useCanvasStyles( GLOBAL_STYLE_ID, GLOBAL_CANVAS_CSS );

	return (
		<GlobalScope>
			<SiteCanvas
				canvas={ canvas }
				className="cnl-template-canvas"
				document={
					<TemplateDocument
						isSystemPage={ isSystemPage }
						template={ template }
					/>
				}
				editorRef={ editorRef }
				editorSettings={ EDITOR_SETTINGS }
			/>
		</GlobalScope>
	);
}
