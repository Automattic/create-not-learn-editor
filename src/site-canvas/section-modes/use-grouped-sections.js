/**
 * The page's sections, each run of plain blocks between containers grouped
 * into one section of text.
 */

/**
 * WordPress dependencies
 */

/**
 * Internal dependencies
 */
import { blockEditorStore, useMemo, useSelect } from '../../wordpress-packages';
import { getWritingSections } from '../writing-mode';
import { EMPTY_ARRAY } from './layer-constants';

// Takes the layer's state and actions it needs, by name.
export function useGroupedSections( { focusId, hasSections, structure } ) {
	// A canvas about one section, like the Header screen's, has nothing to
	// group.
	const groupsText = hasSections && ! focusId;
	/*
	 * The sections with their runs of text grouped, each known by its first
	 * block. Kept to a string, so the selector returns the same value until
	 * they change.
	 */
	const groupedKey = useSelect(
		( select ) =>
			groupsText
				? getWritingSections(
						structure.sectionIds,
						select( blockEditorStore ).getBlockName
					)
						.map(
							( { clientIds, isText } ) =>
								`${ isText ? 'text' : 'block' }:${ clientIds.join(
									','
								) }`
						)
						.join( ' ' )
				: '',
		[ groupsText, structure.sectionIds ]
	);
	const groupedSections = useMemo(
		() =>
			groupedKey
				? groupedKey.split( ' ' ).map( ( entry ) => {
						const [ kind, ids ] = entry.split( ':' );

						return {
							clientIds: ids.split( ',' ),
							isText: kind === 'text',
						};
					} )
				: null,
		[ groupedKey ]
	);
	const sectionIds = useMemo(
		() =>
			groupedSections
				? groupedSections.map( ( section ) => section.clientIds[ 0 ] )
				: structure.sectionIds,
		[ structure.sectionIds, groupedSections ]
	);
	const groupedById = useMemo(
		() =>
			Object.fromEntries(
				( groupedSections || EMPTY_ARRAY ).map( ( section ) => [
					section.clientIds[ 0 ],
					section,
				] )
			),
		[ groupedSections ]
	);
	// The blocks a section is made of: one, but for a run of text.
	const getMembers = ( clientId ) =>
		groupedById[ clientId ]?.clientIds || [ clientId ];
	const isTextSection = ( clientId ) =>
		Boolean( groupedById[ clientId ]?.isText );

	return {
		groupedSections,
		sectionIds,
		groupedById,
		getMembers,
		isTextSection,
	};
}
