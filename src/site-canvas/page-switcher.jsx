/**
 * The page on show, named in the middle of the canvas toolbar, as a button
 * that opens the page finder (see `src/page-finder`) beneath it, to go to
 * another page. It took over from the Go to page field the top bar had, so
 * finding a page starts from the name of the one you're on, as the document
 * bar does in core's editor.
 */

/**
 * WordPress dependencies
 */
import { Dropdown } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { chevronDownSmall } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { PageFinder } from '../page-finder';

/**
 * @param {Object}  props
 * @param {Object}  props.icon  The page's icon.
 * @param {string}  props.title The page's name.
 * @param {string}  props.meta  What it is and its status, under the name.
 * @param {?string} props.hint  More about the page, like its address, for
 *                              the button's tooltip.
 * @return {Element} The switcher.
 */
export function PageSwitcher( { icon, title, meta, hint = '' } ) {
	return (
		<Dropdown
			className="cnl-page-switcher"
			contentClassName="cnl-page-switcher__popover"
			popoverProps={ { placement: 'bottom', offset: 6 } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<button
					aria-expanded={ isOpen }
					aria-haspopup="dialog"
					aria-label={ sprintf(
						/* translators: %s: The name of the page on show. */
						__( '%s. Go to another page' ),
						title
					) }
					className="cnl-page-switcher__toggle cnl-editor-homepage-document__text"
					onClick={ onToggle }
					title={ hint || undefined }
					type="button"
				>
					<span className="cnl-editor-homepage-document__heading">
						{ icon && (
							<Icon
								className="cnl-editor-homepage-document__icon"
								icon={ icon }
							/>
						) }
						<span className="cnl-editor-homepage-document__title">
							{ title }
						</span>
						<Icon
							className="cnl-page-switcher__chevron"
							icon={ chevronDownSmall }
						/>
					</span>
					{ meta && (
						<span className="cnl-editor-homepage-document__meta">
							{ meta }
						</span>
					) }
				</button>
			) }
			renderContent={ ( { onClose } ) => (
				<PageFinder
					className="cnl-page-switcher__finder"
					isInPopover
					onDone={ onClose }
					placeholder={ __( 'Go to page…' ) }
				/>
			) }
		/>
	);
}
