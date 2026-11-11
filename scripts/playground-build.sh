#!/usr/bin/env bash
#
# Puts together the files a Playground demo installs, for
# .github/workflows/plugin-zip.yml to publish. Run it from the repo root after
# `npm run plugin-zip`.
#
# Usage: scripts/playground-build.sh <kind> <name> <ref> <out-dir>
#
#   kind     trunk, branch or release.
#   name     The branch or tag being built, such as getdave/my-change or v0.2.0.
#   ref      The ref the files are published to, such as
#            refs/playground/getdave/my-change. raw.githubusercontent.com takes
#            it as it is, slashes and all.
#   out-dir  Where to put the files. It must not exist yet.
#
# There is a blueprint for each demo in demos/: blueprint.json for the
# Fernhouse demo site, blueprint-shop.json for the same site with WooCommerce
# and a demo shop, blueprint-ai.json for the same site with the AI plugin's
# WebMCP tools, for an agent to drive, blueprint-blank.json for a blank
# site on WordPress's default theme, and blueprint-ipsum.json for a fresh site
# on the Ipsum theme with only its demo posts. Trunk uses them as they are. A
# branch or release gets copies of its own, rewritten to install from <ref>. A
# release also pins WordPress to the version wp-env runs, so it stays the same
# while WordPress moves on, except for the Ipsum demo, which needs the beta.

set -euo pipefail

if [ $# -ne 4 ]; then
	echo "Usage: $0 <trunk|branch|release> <name> <ref> <out-dir>" >&2
	exit 1
fi

kind=$1
name=$2
ref=$3
out=$4
repo=${GITHUB_REPOSITORY:-Automattic/create-not-learn-editor}
sha=${GITHUB_SHA:-$(git rev-parse HEAD)}

case $kind in
	trunk | branch | release) ;;
	*)
		echo "Unknown kind \"$kind\", expected trunk, branch or release." >&2
		exit 1
		;;
esac

mkdir "$out"
out=$(cd "$out" && pwd)
cp "${ZIP_NAME:-create-not-learn-editor.zip}" "$out/create-not-learn-editor.zip"
cp scripts/demo-site/seed.php scripts/demo-site/seed-shop.php demos/playground-canvas-fix.php "$out/"
(cd themes && zip -qr "$out/mainstay.zip" mainstay)

wp=''
case $kind in
	trunk)
		about="Do not edit or commit to this branch, it is replaced on every push to trunk."
		files="[\`demos/blueprint.json\`](https://github.com/$repo/blob/trunk/demos/blueprint.json), [\`demos/blueprint-shop.json\`](https://github.com/$repo/blob/trunk/demos/blueprint-shop.json), [\`demos/blueprint-ai.json\`](https://github.com/$repo/blob/trunk/demos/blueprint-ai.json), [\`demos/blueprint-blank.json\`](https://github.com/$repo/blob/trunk/demos/blueprint-blank.json) and [\`demos/blueprint-ipsum.json\`](https://github.com/$repo/blob/trunk/demos/blueprint-ipsum.json)"
		;;
	branch)
		# Replaces the start of each blueprint's description, "The latest
		# Create Not Learn Editor from trunk".
		version="Create Not Learn Editor from the $name branch"
		about="It is the Playground build of the [\`$name\`](https://github.com/$repo/tree/$name) branch, replaced on every push to it and deleted with it. Do not edit or commit to this ref."
		files="[\`blueprint.json\`](blueprint.json), [\`blueprint-shop.json\`](blueprint-shop.json), [\`blueprint-ai.json\`](blueprint-ai.json), [\`blueprint-blank.json\`](blueprint-blank.json) and [\`blueprint-ipsum.json\`](blueprint-ipsum.json)"
		;;
	release)
		# Playground takes major versions, such as 7.1, not patch releases.
		wp=$(grep -oE "wordpress\.org/wordpress-[0-9]+\.[0-9]+" scripts/wp-env.mjs | head -n1 | sed 's#.*wordpress-##')
		if [ -z "$wp" ]; then
			echo "Could not find the WordPress version in scripts/wp-env.mjs" >&2
			exit 1
		fi
		version="Create Not Learn Editor $name, on WordPress $wp"
		beta_version="Create Not Learn Editor $name"
		about="It is the Playground build of the \`$name\` release. Do not edit or move this tag."
		files="[\`blueprint.json\`](blueprint.json), [\`blueprint-shop.json\`](blueprint-shop.json), [\`blueprint-ai.json\`](blueprint-ai.json), [\`blueprint-blank.json\`](blueprint-blank.json) and [\`blueprint-ipsum.json\`](blueprint-ipsum.json)"
		;;
esac

if [ "$kind" != trunk ]; then
	for blueprint in demos/blueprint.json demos/blueprint-shop.json demos/blueprint-ai.json demos/blueprint-blank.json demos/blueprint-ipsum.json; do
		target="$out/$(basename "$blueprint")"
		blueprint_version=$version
		blueprint_wp=$wp
		# The Ipsum demo needs the WordPress beta, so a release leaves it there.
		if [ "$(jq -r .preferredVersions.wp "$blueprint")" = beta ]; then
			blueprint_version=${beta_version:-$version}
			blueprint_wp=''
		fi
		jq --tab \
			--arg ref "$ref" \
			--arg name "$name" \
			--arg version "$blueprint_version" \
			--arg wp "$blueprint_wp" '
				walk(if type == "string" then sub("/playground-build/"; "/\($ref)/") else . end)
				| .meta.title = "\(.meta.title) (\($name))"
				| .meta.description |= sub("^The latest Create Not Learn Editor from trunk"; $version)
				| if $wp != "" then .preferredVersions.wp = $wp else . end
			' "$blueprint" > "$target"

		if grep -q "/playground-build/" "$target"; then
			echo "$target still installs from the playground-build branch." >&2
			exit 1
		fi
		if ! jq -e --arg version "$blueprint_version" '.meta.description | startswith($version)' "$target" > /dev/null; then
			echo "The description in $blueprint must start \"The latest Create Not Learn Editor from trunk\"." >&2
			exit 1
		fi
	done
fi

cat > "$out/README.md" <<EOF
# Playground build

Generated from [\`${sha:0:7}\`](https://github.com/$repo/commit/$sha) by \`.github/workflows/plugin-zip.yml\`. $about

These are the files $files install.
EOF
