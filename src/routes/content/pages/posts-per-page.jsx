/**
 * How many posts the homepage lists at once, when it lists the latest posts.
 *
 * WordPress's "Blog pages show at most" Reading setting, offered as a few
 * plain choices. The change is an edit, saved with the rest, and the canvas
 * shows it straight away (`preview-url.js`).
 */

/**
 * Internal dependencies
 */
import {
	ToggleGroupControl,
	ToggleGroupControlOption,
	__,
	coreDataStore,
	useDispatch,
	useSelect,
} from '../../../wordpress-packages';

const CHOICES = [ 3, 5, 10, 20 ];

/**
 * @return {?Element} The control, once the setting has loaded.
 */
export default function PostsPerPage() {
	const perPage = useSelect(
		( select ) =>
			Number(
				select( coreDataStore ).getEditedEntityRecord( 'root', 'site' )
					?.posts_per_page
			) || 0,
		[]
	);
	const { editEntityRecord } = useDispatch( coreDataStore );

	if ( ! perPage ) {
		return null;
	}

	// A number set elsewhere, like in WP Admin, is offered too.
	const choices = CHOICES.includes( perPage )
		? CHOICES
		: [ ...CHOICES, perPage ].sort( ( a, b ) => a - b );

	return (
		<ToggleGroupControl
			__next40pxDefaultSize
			className="cnl-posts-per-page"
			help={ __( 'Older posts are a click away, on the next page.' ) }
			isBlock
			label={ __( 'Posts to show at once' ) }
			onChange={ ( value ) =>
				editEntityRecord( 'root', 'site', undefined, {
					posts_per_page: Number( value ),
				} )
			}
			value={ String( perPage ) }
		>
			{ choices.map( ( choice ) => (
				<ToggleGroupControlOption
					key={ choice }
					label={ String( choice ) }
					value={ String( choice ) }
				/>
			) ) }
		</ToggleGroupControl>
	);
}
