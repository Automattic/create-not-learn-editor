/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import {
	PagePreviewLoading,
	useHasPreviewDrawn,
} from '../../pickers/preview-loading';
import { Skeleton, Stack, useRef } from '../../wordpress-packages';

/*
 * The page being named, as it will start. It shows a page in outline until
 * the preview has drawn, and again for each design chosen, as it mounts anew.
 */
export function FormPreview( { blocks, description } ) {
	const ref = useRef();
	const hasDrawn = useHasPreviewDrawn( ref );

	return (
		<div className="cnl-add-page-form__preview">
			<div
				className="cnl-design-picker__preview cnl-add-page-form__preview-page"
				ref={ ref }
			>
				<LazyEditorPreview
					blocks={ blocks }
					description={ description }
				/>
			</div>
			{ ! hasDrawn && <PagePreviewLoading /> }
		</div>
	);
}

export function PageLayoutSidebarPlaceholder() {
	return (
		<Stack
			aria-hidden
			className="cnl-add-page-layout-categories-placeholder"
			direction="column"
			gap="lg"
		>
			{ [ 70, 54, 62, 48, 66, 52 ].map( ( width, index ) => (
				<Skeleton
					key={ index }
					style={ { height: 14, width: `${ width }%` } }
				/>
			) ) }
		</Stack>
	);
}

export function PageLayoutResultsPlaceholder( { columns, rows } ) {
	return (
		<div
			aria-hidden
			className="cnl-add-page-layout-grid"
			style={ {
				'--cnl-add-page-layout-columns': columns,
				'--cnl-add-page-layout-rows': rows,
			} }
		>
			{ Array.from( { length: columns * rows } ).map( ( _, index ) => (
				<Skeleton
					className="cnl-add-page-layout-skeleton"
					key={ index }
				/>
			) ) }
		</div>
	);
}
