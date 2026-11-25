/**
 * WordPress dependencies
 */
import { check as checkIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	__,
	chevronLeftIcon,
	chevronRightIcon,
	ColorIndicator,
	Icon,
	isRTL,
	MenuItem,
	NavigableMenu,
	Navigator,
	useNavigator,
} from '../../wordpress-packages';
import { CUSTOM_COLOR } from '../compose/section-colors';

const CUSTOM_PATH = '/custom';
const CUSTOM_ROW = 'cnl-section-modes__color-custom';

/**
 * Overlapping colour circles, as core's block Color panel draws them
 * (`LabeledColorIndicators` in block-editor's global styles).
 *
 * @param {Object}   props
 * @param {string[]} props.colors CSS colours.
 * @return {Element} The circles.
 */
function ColorStack( { colors } ) {
	return (
		<span aria-hidden className="cnl-section-modes__color-stack">
			{ colors.map( ( color, index ) => (
				<ColorIndicator colorValue={ color } key={ index } />
			) ) }
		</span>
	);
}

/**
 * The colours to choose from, the one in use ticked and the menu's one tab
 * stop, so the popover opens on it and Tab leaves the menu; arrow keys
 * reach the rest. Custom colours, last, drills into its own screen.
 *
 * @param {Object}  props
 * @param {Object}  props.colors    See `ColorList`.
 * @param {boolean} props.hasCustom Whether custom colours are offered.
 * @return {Element} The menu.
 */
function ColorMenu( { colors, hasCustom } ) {
	const { goTo } = useNavigator();
	const isCustom = colors.current === CUSTOM_COLOR;
	const hasCurrent =
		isCustom ||
		colors.options.some( ( option ) => option.name === colors.current );
	const openCustom = () =>
		goTo( CUSTOM_PATH, { focusTargetSelector: `.${ CUSTOM_ROW }` } );

	return (
		<NavigableMenu
			aria-label={ __( 'Colour', 'create-not-learn-editor' ) }
			className="cnl-section-modes__color-list"
		>
			{ colors.options.map( ( option, index ) => {
				const isSelected = option.name === colors.current;
				const isTabStop = hasCurrent ? isSelected : index === 0;

				return (
					<MenuItem
						className="cnl-section-modes__color-row"
						icon={ isSelected ? checkIcon : null }
						isSelected={ isSelected }
						key={ option.name ?? 'none' }
						onClick={ () =>
							! isSelected && colors.onSelect( option.name )
						}
						role="menuitemradio"
						tabIndex={ isTabStop ? 0 : -1 }
					>
						<ColorStack colors={ option.swatch ?? [] } />
						{ option.label }
					</MenuItem>
				);
			} ) }
			{ hasCustom && (
				<>
					<hr className="cnl-section-modes__color-divider" />
					<MenuItem
						className={ `cnl-section-modes__color-row ${ CUSTOM_ROW }` }
						isSelected={ isCustom }
						onClick={ openCustom }
						// The arrow pointing forward drills in. In capture,
						// as NavigableMenu stops arrow keys at the menu.
						onKeyDownCapture={ ( event ) => {
							if (
								event.key ===
								( isRTL() ? 'ArrowLeft' : 'ArrowRight' )
							) {
								event.preventDefault();
								event.stopPropagation();
								openCustom();
							}
						} }
						role="menuitemradio"
						suffix={
							<>
								{ isCustom && <Icon icon={ checkIcon } /> }
								<Icon
									icon={
										isRTL()
											? chevronLeftIcon
											: chevronRightIcon
									}
								/>
							</>
						}
						tabIndex={ isCustom ? 0 : -1 }
					>
						{ isCustom ? (
							<ColorStack colors={ colors.swatch } />
						) : (
							<span
								aria-hidden
								className="cnl-section-modes__color-wheel"
							/>
						) }
						{ __( 'Custom colours', 'create-not-learn-editor' ) }
					</MenuItem>
				</>
			) }
		</NavigableMenu>
	);
}

/**
 * The custom colours' screen: Back and its title, then the colours. Escape,
 * or the arrow pointing back, returns to the list, on Custom colours.
 *
 * @param {Object}  props
 * @param {Element} props.children The custom colours.
 * @return {Element} The screen.
 */
function CustomScreen( { children } ) {
	const { goBack } = useNavigator();

	return (
		// eslint-disable-next-line jsx-a11y/no-static-element-interactions
		<div
			onKeyDown={ ( event ) => {
				// Keys from the screen itself, not a palette it opened,
				// which closes itself first.
				if (
					event.defaultPrevented ||
					! event.currentTarget.contains( event.target )
				) {
					return;
				}

				if (
					event.key === 'Escape' ||
					event.key === ( isRTL() ? 'ArrowRight' : 'ArrowLeft' )
				) {
					event.preventDefault();
					goBack();
				}
			} }
		>
			<div className="cnl-section-modes__color-header">
				<Navigator.BackButton
					icon={ isRTL() ? chevronRightIcon : chevronLeftIcon }
					label={ __( 'Back', 'create-not-learn-editor' ) }
					size="small"
				/>
				<h2 className="cnl-section-modes__color-title">
					{ __( 'Custom colours', 'create-not-learn-editor' ) }
				</h2>
			</div>
			{ children }
		</div>
	);
}

/**
 * A section's colours under its toolbar's Colour button: a menu of the
 * choices, each its colours and name, and Custom colours, which drills
 * into a screen of the section's own colours in the same popover, as
 * Global Styles moves between its screens.
 *
 * @param {Object}   props
 * @param {Object}   props.colors `{ current, options, onSelect, swatch }`,
 *                                as `ColorOptions` takes.
 * @param {?Element} props.custom The custom colours, when offered.
 * @return {Element} The colours.
 */
export default function ColorList( { colors, custom } ) {
	return (
		<Navigator
			className="cnl-section-modes__color-navigator"
			initialPath="/"
		>
			<Navigator.Screen path="/">
				<ColorMenu colors={ colors } hasCustom={ !! custom } />
			</Navigator.Screen>
			{ custom && (
				<Navigator.Screen path={ CUSTOM_PATH }>
					<CustomScreen>{ custom }</CustomScreen>
				</Navigator.Screen>
			) }
		</Navigator>
	);
}
