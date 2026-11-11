/**
 * "What are you posting?": the kinds of post a writer picks from before
 * they write, each opening a new post with that kind's blocks ready to fill
 * in. See `src/post-kinds.js`.
 *
 * Opened from "Write a post", wherever it is offered. Imported package by
 * package, like the other pickers, so it can be used from app init without
 * loading the editor.
 */

/**
 * WordPress dependencies
 */
import { CheckboxControl, Modal } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { requestDistractionFreeEntry } from '../editor-layer/distraction-free';
import { PLAIN_POST, getPostKinds } from '../post-kinds';
import { setAskingPostKind, wantsPostKindQuestion } from '../post-kinds-base';
import PostKindSketch from './post-kind-sketches';

/**
 * @param {Object}   props               Component props.
 * @param {Function} props.onClose       Called when the picker closes.
 * @param {boolean}  props.isFocusedOpen Whether the post opens with
 *                                       everything but the writing out of
 *                                       the way.
 * @return {Element} The picker.
 */
export default function PostKindPicker( { onClose, isFocusedOpen } ) {
	const navigate = useNavigate();
	// Sent with the page, so they're here as soon as the picker opens.
	const kinds = getPostKinds();
	const isAsking = useSelect( wantsPostKindQuestion, [] );

	const pick = ( kind ) => {
		if ( isFocusedOpen ) {
			requestDistractionFreeEntry();
		}

		onClose();
		navigate( {
			search: kind.name === PLAIN_POST ? undefined : { kind: kind.name },
			to: '/types/post/new',
		} );
	};

	return (
		<Modal
			className="cnl-post-kinds"
			focusOnMount="firstContentElement"
			onRequestClose={ onClose }
			title={ __( 'What are you posting?' ) }
		>
			<div className="cnl-post-kinds__grid" role="list">
				{ kinds.map( ( kind, index ) => {
					// The plain post leads, a tall tile of its own, as the
					// one most posts are.
					const isLead = index === 0;

					return (
						<div
							className={ `cnl-post-kinds__item${
								isLead ? ' is-lead' : ''
							}` }
							key={ kind.name }
							role="listitem"
						>
							<button
								className="cnl-post-kinds__kind"
								onClick={ () => pick( kind ) }
								type="button"
							>
								<span className="cnl-post-kinds__panel">
									<PostKindSketch
										isTall={ isLead }
										name={ kind.sketch }
									/>
								</span>
								<span className="cnl-post-kinds__title">
									{ kind.title }
								</span>
								<span className="cnl-post-kinds__description">
									{ kind.description }
								</span>
							</button>
						</div>
					);
				} ) }
			</div>
			<CheckboxControl
				checked={ ! isAsking }
				className="cnl-post-kinds__skip"
				help={ __(
					'Start every post as a plain post. You can turn this back on in Preferences, in the ⋮ menu at the top right.'
				) }
				label={ __( 'Don’t ask me again' ) }
				onChange={ ( isSkipping ) => setAskingPostKind( ! isSkipping ) }
			/>
		</Modal>
	);
}
