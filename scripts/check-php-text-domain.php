<?php
/**
 * Fails when a translation call in the plugin's PHP has no text domain, or
 * one other than the editor's. JavaScript is checked by ESLint's
 * `@wordpress/i18n-text-domain` rule; this does the same for PHP.
 *
 * Usage: php scripts/check-php-text-domain.php [file-or-dir ...]
 * Defaults to create-not-learn-editor.php and includes/.
 *
 * @package create-not-learn-editor
 */

const CNL_TEXT_DOMAIN = 'create-not-learn-editor';

// Each translation function, by the position of its text domain argument.
const CNL_DOMAIN_ARG = array(
	'__'                   => 1,
	'_e'                   => 1,
	'esc_html__'           => 1,
	'esc_html_e'           => 1,
	'esc_attr__'           => 1,
	'esc_attr_e'           => 1,
	'translate'               => 1,
	'_x'                   => 2,
	'_ex'                  => 2,
	'esc_html_x'           => 2,
	'esc_attr_x'           => 2,
	'_n'                   => 3,
	'_n_noop'              => 2,
	'_nx'                  => 4,
	'_nx_noop'             => 3,
	'translate_nooped_plural' => 2,
);

/**
 * The problems in one file.
 *
 * @param string $file Path.
 * @return string[] Problems, as `file:line message`.
 */
function cnl_check_file( $file ) {
	$source   = file_get_contents( $file );
	$lines    = explode( "\n", $source );
	$tokens   = token_get_all( $source );
	$problems = array();
	$count    = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		$token = $tokens[ $i ];
		if ( ! is_array( $token ) || T_STRING !== $token[0] || ! isset( CNL_DOMAIN_ARG[ $token[1] ] ) ) {
			continue;
		}

		// Skip method calls, function definitions and namespaced names.
		$prev = $i - 1;
		while ( $prev >= 0 && is_array( $tokens[ $prev ] ) && T_WHITESPACE === $tokens[ $prev ][0] ) {
			--$prev;
		}
		if ( $prev >= 0 && is_array( $tokens[ $prev ] ) && in_array( $tokens[ $prev ][0], array( T_OBJECT_OPERATOR, T_DOUBLE_COLON, T_FUNCTION, T_NS_SEPARATOR ), true ) ) {
			continue;
		}

		$next = $i + 1;
		while ( $next < $count && is_array( $tokens[ $next ] ) && T_WHITESPACE === $tokens[ $next ][0] ) {
			++$next;
		}
		if ( '(' !== ( $tokens[ $next ] ?? null ) ) {
			continue;
		}

		// Collect the top-level arguments.
		$args  = array( array() );
		$depth = 0;
		for ( $j = $next + 1; $j < $count; $j++ ) {
			$t = $tokens[ $j ];
			if ( in_array( $t, array( '(', '[', '{' ), true ) || ( is_array( $t ) && in_array( $t[0], array( T_CURLY_OPEN, T_DOLLAR_OPEN_CURLY_BRACES ), true ) ) ) {
				++$depth;
			} elseif ( in_array( $t, array( ')', ']', '}' ), true ) ) {
				if ( 0 === $depth ) {
					break;
				}
				--$depth;
			} elseif ( ',' === $t && 0 === $depth ) {
				$args[] = array();
				continue;
			}
			if ( ! is_array( $t ) || ! in_array( $t[0], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
				$args[ count( $args ) - 1 ][] = $t;
			}
		}

		// A string that has to be core's says so with the same comment PHPCS
		// takes, on its line.
		if ( false !== strpos( $lines[ $token[2] - 1 ] ?? '', 'phpcs:ignore WordPress.WP.I18n' ) ) {
			continue;
		}

		$position = CNL_DOMAIN_ARG[ $token[1] ];
		$domain   = $args[ $position ] ?? array();
		$where    = $file . ':' . $token[2] . ' ' . $token[1] . '()';

		if ( ! $domain ) {
			$problems[] = $where . ' has no text domain.';
		} elseif ( 1 !== count( $domain ) || ! is_array( $domain[0] ) || T_CONSTANT_ENCAPSED_STRING !== $domain[0][0] ) {
			$problems[] = $where . ' has a text domain that is not a string literal.';
		} elseif ( trim( $domain[0][1], '\'"' ) !== CNL_TEXT_DOMAIN ) {
			$problems[] = $where . ' uses the text domain ' . $domain[0][1] . '.';
		}
	}

	return $problems;
}

$root    = dirname( __DIR__ );
$targets = array_slice( $argv, 1 ) ? array_slice( $argv, 1 ) : array( $root . '/create-not-learn-editor.php', $root . '/includes' );
$files   = array();

foreach ( $targets as $target ) {
	if ( is_dir( $target ) ) {
		$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $target, FilesystemIterator::SKIP_DOTS ) );
		foreach ( $iterator as $file ) {
			if ( 'php' === $file->getExtension() ) {
				$files[] = $file->getPathname();
			}
		}
	} else {
		$files[] = $target;
	}
}

$problems = array();
foreach ( $files as $file ) {
	$problems = array_merge( $problems, cnl_check_file( $file ) );
}

if ( $problems ) {
	fwrite( STDERR, implode( "\n", $problems ) . "\n\nUse the '" . CNL_TEXT_DOMAIN . "' text domain. See \"Translations\" in CONTRIBUTING.md.\n" );
	exit( 1 );
}

echo 'Every PHP translation call uses the ' . CNL_TEXT_DOMAIN . " text domain.\n";
