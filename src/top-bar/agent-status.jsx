/**
 * The agent working in the editor through WebMCP, before the save controls
 * in the canvas toolbar. Shows only in the Agent
 * workspace, once an agent is connected. See `src/webmcp/connection.js`.
 *
 * It says an agent is connected, and its dot pulses while the agent is at
 * work. Opened, it lists what the agent has changed since the editor loaded,
 * under its name if it has given one, as a batch for each request it worked
 * on, newest first, so a long session stays short to read. Picking a batch
 * scrolls to its changes and flashes them all at once.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { chevronDown } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { useAgentConnection } from '../webmcp/connection';
import { showChanges } from '../webmcp/flash';
import { getActiveWorkspace } from '../workspaces';

const AGENT_WORKSPACE = 'agent';
// How long after its last tool call an agent still counts as at work.
const ACTIVE_MS = 15000;
const TICK_MS = 5000;

/**
 * How long ago something happened, in a few words.
 *
 * @param {number} time When, in milliseconds.
 * @param {number} now  Now, in milliseconds.
 * @return {string} The words.
 */
export function getTimeAgo( time, now ) {
	const minutes = Math.floor( ( now - time ) / 60000 );

	if ( minutes < 1 ) {
		return __( 'just now' );
	}

	if ( minutes < 60 ) {
		return sprintf(
			/* translators: %d: A number of minutes. */
			_n( '%d min ago', '%d mins ago', minutes ),
			minutes
		);
	}

	const hours = Math.floor( minutes / 60 );

	return sprintf(
		/* translators: %d: A number of hours. */
		_n( '%d hour ago', '%d hours ago', hours ),
		hours
	);
}

function useNow() {
	const [ now, setNow ] = useState( Date.now );

	useEffect( () => {
		const timer = window.setInterval( () => setNow( Date.now() ), TICK_MS );

		return () => window.clearInterval( timer );
	}, [] );

	return now;
}

function getBatchCount( batch ) {
	return sprintf(
		/* translators: %d: A number of changes. */
		_n( '%d change', '%d changes', batch.changes.length ),
		batch.changes.length
	);
}

function BatchList( { batches, isActive, name, now, onClose } ) {
	// A batch can only be played while one of its blocks is still there.
	const canShow = useSelect(
		( select ) =>
			batches.map( ( batch ) =>
				batch.changes.some(
					( change ) =>
						change.clientId &&
						select( blockEditorStore ).getBlock( change.clientId )
				)
			),
		[ batches ]
	);

	return (
		<>
			<MenuGroup
				label={
					name
						? sprintf(
								/* translators: %s: The name of an AI agent, like Claude. */
								__( 'Changes by %s' ),
								name
							)
						: __( 'Changes by the agent' )
				}
			>
				{ batches.map( ( batch, index ) => {
					let info = sprintf(
						/* translators: 1: A number of changes, like 3 changes. 2: How long ago, like 2 mins ago. */
						__( '%1$s · %2$s' ),
						getBatchCount( batch ),
						getTimeAgo( batch.updatedAt, now )
					);

					if ( ! batch.changes.length ) {
						info =
							index === 0 && isActive
								? __( 'Working on it' )
								: __( 'No changes' );
					}

					return (
						<MenuItem
							key={ batch.id }
							disabled={ ! canShow[ index ] }
							info={
								batch.title
									? info
									: getTimeAgo( batch.updatedAt, now )
							}
							onClick={ () => {
								onClose();
								showChanges(
									batch.changes.map(
										( change ) => change.clientId
									)
								);
							} }
						>
							{ batch.title || getBatchCount( batch ) }
						</MenuItem>
					);
				} ) }
				{ ! batches.length && (
					<p className="cnl-agent-status__empty">
						{ __( 'No changes yet.' ) }
					</p>
				) }
			</MenuGroup>
			<p className="cnl-agent-status__note">
				{ __( 'Nothing goes live until you save.' ) }
			</p>
		</>
	);
}

function AgentStatusMenu( { batches, lastCallAt, name } ) {
	const now = useNow();
	const isActive = now - lastCallAt < ACTIVE_MS;

	return (
		<Dropdown
			className="cnl-agent-status"
			popoverProps={ { placement: 'bottom-start' } }
			contentClassName="cnl-agent-status__menu"
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					aria-expanded={ isOpen }
					className="cnl-agent-status__toggle"
					icon={ chevronDown }
					iconPosition="right"
					iconSize={ 20 }
					onClick={ onToggle }
				>
					<span
						aria-hidden
						className={ `cnl-agent-status__indicator${
							isActive ? ' is-active' : ''
						}` }
					/>
					<span role="status">{ __( 'Agent: connected' ) }</span>
				</Button>
			) }
			renderContent={ ( { onClose } ) => (
				<BatchList
					batches={ batches }
					isActive={ isActive }
					name={ name }
					now={ now }
					onClose={ onClose }
				/>
			) }
		/>
	);
}

export function AgentStatus() {
	const { batches, isConnected, lastCallAt, name } = useAgentConnection();
	const isAgentWorkspace = useSelect(
		( select ) => getActiveWorkspace( select ).id === AGENT_WORKSPACE,
		[]
	);

	if ( ! isConnected || ! isAgentWorkspace ) {
		return null;
	}

	return (
		<AgentStatusMenu
			batches={ batches }
			lastCallAt={ lastCallAt }
			name={ name }
		/>
	);
}
