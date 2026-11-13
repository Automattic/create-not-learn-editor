/**
 * Upload media: a modal with one big area to drop files on, or click to
 * choose them, and a row for each file as it uploads.
 *
 * Built from the design system's parts: the drop area is an empty state
 * (icon, title, description and a Choose files button) with core's
 * DropZone over it, each upload shows a Progress bar and then an Added
 * badge, and a file that fails becomes an error Notice in the modal, as
 * the error message pattern asks, with the reason WordPress gave.
 *
 * The Media screen's Upload button and the admin bar's New > Media both open
 * it, and files dropped on the Media screen open it with those files
 * already uploading. Once every file is in, it closes itself and a snackbar
 * says how many were added. A file that fails keeps it open, so the person
 * can see which one and why. Closing it early doesn't stop the uploads;
 * snackbars report on them instead.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because app init imports it through the save controls.
 */

/**
 * WordPress dependencies
 */
import { speak } from '@wordpress/a11y';
import { DropZone, FormFileUpload, Modal } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { upload } from '@wordpress/icons';
import { uploadMedia } from '@wordpress/media-utils';
import { store as noticesStore } from '@wordpress/notices';
import {
	Badge,
	Button,
	EmptyState,
	Notice,
	Progress,
	Stack,
	Text,
} from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { settings } from '../settings';

const NOTICE_ID = 'cnl-upload-media';

let nextKey = 0;

function isOnMediaScreen() {
	const path = new URL( window.location.href ).searchParams.get( 'p' );

	return !! path && /^\/media(?:[/?]|$)/.test( path );
}

/**
 * @param {number} bytes A size in bytes.
 * @return {string} The size in megabytes, as people read it.
 */
function formatMegabytes( bytes ) {
	return sprintf(
		/* translators: %s: a number of megabytes. */
		__( '%s MB' ),
		Math.floor( bytes / ( 1024 * 1024 ) ).toLocaleString()
	);
}

/**
 * Upload one file to the media library.
 *
 * @param {File}     file    The file.
 * @param {Function} onDone  Called with the attachment once it's saved.
 * @param {Function} onError Called with the error if it couldn't be.
 */
function uploadFile( file, onDone, onError ) {
	let isSettled = false;

	uploadMedia( {
		filesList: [ file ],
		maxUploadFileSize: settings.maxUploadFileSize || undefined,
		onFileChange( [ attachment ] ) {
			// It calls this first with a preview, which has no ID yet.
			if ( isSettled || ! attachment?.id ) {
				return;
			}
			isSettled = true;
			onDone( attachment );
		},
		onError( error ) {
			if ( isSettled ) {
				return;
			}
			isSettled = true;
			onError( error );
		},
	} );
}

/**
 * Say how many files were added, with a way to the Media screen from any
 * other screen.
 *
 * @param {number} count Files added.
 */
function announceAdded( count ) {
	dispatch( noticesStore ).createSuccessNotice(
		sprintf(
			/* translators: %d: number of files. */
			_n(
				'%d file added to your media.',
				'%d files added to your media.',
				count
			),
			count
		),
		{
			actions: isOnMediaScreen()
				? []
				: [
						{
							label: __( 'View media' ),
							onClick: () => openRoute( '/media' ),
						},
					],
			id: NOTICE_ID,
			type: 'snackbar',
		}
	);
}

/**
 * @param {Object} props      Component props.
 * @param {Object} props.file The file's row: its name and status.
 * @return {Element} One file's row in the list, while it uploads and once
 *                  it's in. Failures show as notices instead.
 */
function FileRow( { file } ) {
	return (
		<Stack direction="column" gap="xs" render={ <li /> }>
			<Stack align="center" gap="md" justify="space-between">
				<Text className="cnl-upload-media__file-name" variant="body-md">
					{ file.name }
				</Text>
				{ file.status === 'done' && (
					<Badge intent="stable">{ __( 'Added' ) }</Badge>
				) }
			</Stack>
			{ file.status === 'uploading' && (
				<Progress.Root
					className="cnl-upload-media__progress"
					aria-label={ sprintf(
						/* translators: %s: file name. */
						__( 'Uploading %s' ),
						file.name
					) }
					value={ null }
				>
					<Progress.Track>
						<Progress.Indicator />
					</Progress.Track>
				</Progress.Root>
			) }
		</Stack>
	);
}

/**
 * @param {Object}   props              Component props.
 * @param {File[]}   props.initialFiles Files to start uploading as it opens.
 * @param {Function} props.onClose      Called when the modal closes.
 * @return {Element} The upload modal.
 */
export function UploadMediaModal( { initialFiles, onClose } ) {
	const [ files, setFiles ] = useState( [] );
	const isOpen = useRef( true );
	// The files still uploading, and how the batch has gone so far.
	const pending = useRef( { added: 0, failures: [], left: 0 } );
	// Whether a file has just finished, so dismissing a failure doesn't
	// count as every file being in.
	const hasJustFinished = useRef( false );

	// Set again on mount, as React's strict mode unmounts once first.
	useEffect( () => {
		isOpen.current = true;
		return () => {
			isOpen.current = false;
		};
	}, [] );

	// Close once every file is in. A failure keeps it open to show why.
	useEffect( () => {
		if ( ! hasJustFinished.current ) {
			return;
		}
		hasJustFinished.current = false;

		if (
			files.length &&
			files.every( ( file ) => file.status === 'done' )
		) {
			onClose();
		}
	}, [ files, onClose ] );

	const setStatus = ( key, changes ) => {
		hasJustFinished.current = true;
		setFiles( ( current ) =>
			current.map( ( file ) =>
				file.key === key ? { ...file, ...changes } : file
			)
		);
	};

	const dismiss = ( key ) =>
		setFiles( ( current ) =>
			current.filter( ( file ) => file.key !== key )
		);

	/**
	 * @param {string|null} failure Why the file wasn't added, or `null` if it
	 *                              was.
	 */
	const finishOne = ( failure ) => {
		const tally = pending.current;

		tally.left--;
		if ( failure ) {
			tally.failures.push( failure );
		} else {
			tally.added++;
		}

		if ( tally.left > 0 ) {
			return;
		}

		// Every list of media shows the new ones.
		dispatch( coreDataStore ).invalidateResolutionForStoreSelector(
			'getEntityRecords'
		);

		/*
		 * With a failure in the open modal, its badges and notices show how
		 * the batch went, and one message says it all. Each new message
		 * clears the last, so a snackbar's would cut off the failure's.
		 */
		if ( isOpen.current && tally.failures.length ) {
			speak(
				[
					tally.added &&
						sprintf(
							/* translators: %d: number of files. */
							_n(
								'%d file added to your media.',
								'%d files added to your media.',
								tally.added
							),
							tally.added
						),
					...tally.failures,
				]
					.filter( Boolean )
					.join( ' ' ),
				'assertive'
			);
		} else if ( tally.added ) {
			announceAdded( tally.added );
		}

		tally.added = 0;
		tally.failures = [];
	};

	const addFiles = ( fileList ) => {
		const picked = Array.from( fileList || [] ).map( ( file ) => ( {
			file,
			key: nextKey++,
			name: file.name,
			status: 'uploading',
		} ) );

		if ( ! picked.length ) {
			return;
		}

		pending.current.left += picked.length;
		setFiles( ( current ) => [
			// A fresh pick clears the files that are already in.
			...current.filter( ( file ) => file.status !== 'done' ),
			...picked,
		] );

		picked.forEach( ( { file, key } ) =>
			uploadFile(
				file,
				() => {
					if ( isOpen.current ) {
						setStatus( key, { status: 'done' } );
					}
					finishOne( null );
				},
				( error ) => {
					const message =
						error?.message ||
						__( 'Something went wrong. Please try again.' );
					const failure = sprintf(
						/* translators: 1: file name, 2: the reason it wasn't added. */
						__( '%1$s wasn’t added. %2$s' ),
						file.name,
						message
					);

					if ( isOpen.current ) {
						setStatus( key, { error: message, status: 'failed' } );
					} else {
						dispatch( noticesStore ).createErrorNotice( failure, {
							type: 'snackbar',
						} );
					}
					finishOne( failure );
				}
			)
		);
	};

	// Once, even when React runs effects twice.
	const hasStarted = useRef( false );
	useEffect( () => {
		if ( ! hasStarted.current ) {
			hasStarted.current = true;
			addFiles( initialFiles );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const maxSize = settings.maxUploadFileSize;
	const rows = files.filter( ( file ) => file.status !== 'failed' );
	const failures = files.filter( ( file ) => file.status === 'failed' );

	return (
		<Modal
			className="cnl-upload-media"
			focusOnMount="firstContentElement"
			onRequestClose={ onClose }
			size="medium"
			title={ __( 'Upload media' ) }
		>
			<Stack direction="column" gap="lg">
				<FormFileUpload
					multiple
					onChange={ ( event ) => {
						addFiles( event.currentTarget.files );
						// Let the same file be picked again.
						event.currentTarget.value = '';
					} }
					render={ ( { openFileDialog } ) => (
						/*
						 * The whole area opens the file picker for a mouse,
						 * as people expect of a drop area. Its Choose files
						 * button is the way in from the keyboard.
						 */
						// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
						<div
							className="cnl-upload-media__area"
							onClick={ ( event ) => {
								if ( ! event.target.closest( 'button' ) ) {
									openFileDialog();
								}
							} }
						>
							<EmptyState.Root>
								<EmptyState.Icon icon={ upload } />
								<EmptyState.Title>
									{ __( 'Drag and drop files here' ) }
								</EmptyState.Title>
								<EmptyState.Description>
									{ maxSize
										? sprintf(
												/* translators: %s: largest file size, like "64 MB". */
												__(
													'Or choose them from your device. Photos, videos, audio, and documents, up to %s each.'
												),
												formatMegabytes( maxSize )
											)
										: __(
												'Or choose them from your device. Photos, videos, audio, and documents.'
											) }
								</EmptyState.Description>
								<EmptyState.Actions>
									<Button onClick={ openFileDialog }>
										{ __( 'Choose files' ) }
									</Button>
								</EmptyState.Actions>
							</EmptyState.Root>
							<DropZone
								label={ __( 'Drop to upload' ) }
								onFilesDrop={ addFiles }
							/>
						</div>
					) }
				/>
				{ !! failures.length && (
					<Stack direction="column" gap="sm">
						{ failures.map( ( file ) => (
							<Notice.Root intent="error" key={ file.key }>
								<Notice.Title>
									{ sprintf(
										/* translators: %s: file name. */
										__( '%s wasn’t added' ),
										file.name
									) }
								</Notice.Title>
								<Notice.Description>
									{ file.error }
								</Notice.Description>
								<Notice.CloseIconButton
									onClick={ () => dismiss( file.key ) }
								/>
							</Notice.Root>
						) ) }
					</Stack>
				) }
				{ !! rows.length && (
					<Stack
						aria-label={ __( 'Files' ) }
						className="cnl-upload-media__files"
						direction="column"
						gap="md"
						render={ <ul /> }
					>
						{ rows.map( ( file ) => (
							<FileRow file={ file } key={ file.key } />
						) ) }
					</Stack>
				) }
			</Stack>
		</Modal>
	);
}
