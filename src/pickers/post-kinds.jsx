/**
 * "What are you posting?": the kinds of post a writer picks from before
 * they write, each opening a new post with that kind's blocks ready to fill
 * in. See `src/post-kinds.js`.
 *
 * Opened from "Write a post", wherever it is offered. Imported package by
 * package, like the other pickers, so the chat could offer it too.
 */

/**
 * WordPress dependencies
 */
import { Modal } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { requestDistractionFreeEntry } from '../editor-layer/distraction-free';
import { PLAIN_POST, getPostKinds } from '../post-kinds';
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
	const kinds = useSelect(
		( select ) =>
			getPostKinds( select( coreDataStore ).getBlockPatterns() || [] ),
		[]
	);

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
		</Modal>
	);
}
