#!/bin/bash
#
# Starts several wp-env tests sites for CI, each with its own WordPress and
# database on its own port, and prints their addresses as a comma-separated
# list for WP_BASE_URLS. The Playwright config then gives each worker a site
# of its own, so tests that share one site's data can still run side by side.
#
# Only CI runs this. Locally, `npm run wp-env start` and `npx playwright test`
# work on the one site as before.
#
# Usage, from the repository root:
#   scripts/e2e-sites.sh [sites]
#
# After Gutenberg's test/e2e/wp-env-instances.sh.

set -euo pipefail

# One site per two cores.
sites=${1:-$(( $( nproc ) / 2 ))}
if (( sites < 1 )); then
	sites=1
fi

root=$( pwd )
work=${RUNNER_TEMP:-/tmp}/cnl-e2e-sites
rm -rf "$work"
mkdir -p "$work"

# Each site gets a folder with a copy of .wp-env.json: its WordPress and
# Gutenberg under its own .wp-env/sources (scripts/wp-env.mjs fills them from
# the shared cache), this plugin and Mainstay from the checkout, its own ports
# and no demo seed.
write_config() {
	local dir=$1 site=$2
	node -e '
		const path = require( "path" );
		const [ root, site ] = process.argv.slice( 1 );
		const config = require( path.join( root, ".wp-env.json" ) );
		const local = ( source ) =>
			source.startsWith( "./.wp-env/" ) ? source : path.resolve( root, source );
		config.plugins = config.plugins.map( local );
		config.themes = config.themes.map( local );
		delete config.lifecycleScripts;
		config.env = {
			development: { port: 8900 + site * 2 },
			tests: { port: 8901 + site * 2 },
		};
		console.log( JSON.stringify( config, null, "\t" ) );
	' "$root" "$site" > "$dir/.wp-env.json"
}

start_site() {
	local site=$1
	CNL_WP_ENV_ROOT="$work/site-$site" node "$root/scripts/wp-env.mjs" start \
		> "$work/start-$site.log" 2>&1
}

urls=()
for site in $( seq 1 "$sites" ); do
	mkdir -p "$work/site-$site"
	write_config "$work/site-$site" "$site"
	urls+=( "http://localhost:$(( 8901 + site * 2 ))" )
done

# The first site fills the shared download cache; the rest then start
# together from it.
if ! start_site 1; then
	cat "$work/start-1.log" >&2
	exit 1
fi

pids=()
for site in $( seq 2 "$sites" ); do
	start_site "$site" &
	pids+=( "$site:$!" )
done

for entry in "${pids[@]+"${pids[@]}"}"; do
	site=${entry%%:*}
	if ! wait "${entry#*:}"; then
		cat "$work/start-$site.log" >&2
		exit 1
	fi
done

( IFS=,; echo "${urls[*]}" )
