#!/bin/bash

# This script is used to generate fixtures (data) for the website.
# There are 2 ways to generate fixtures:
# 1. generate using the `data` branch (requires an internal monorepo).
# 2. download fixtures from production.
# If the `FETCH_FIXTURES_FROM` environment variable or the --fetch-from
# arg is specified, then fixtures will be downloaded instead of generated
# from the `data` branch.

set -o errexit -o nounset -o pipefail

usage() {
	echo "Usage: $0 [--fetch-from https://...]"
}

to_pascale_case() {
    echo "$1" | sed -E 's/(^|_|-)([a-z])/\U\2/g'
}

# Parse command line arguments
# Derived from https://stackoverflow.com/a/14203146/4527337
__fetch_from=${FETCH_FIXTURES_FROM:-}
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
  case $1 in
    --fetch-from)
      __fetch_from="$2"
      shift # past argument
      shift # past value
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      POSITIONAL_ARGS+=("$1") # save positional arg
      shift # past argument
      ;;
  esac
done
if [ ${#POSITIONAL_ARGS[@]} -ne 0 ]; then
    set -- "${POSITIONAL_ARGS[@]}" # restore positional parameters
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Preparing workspace..."
# Clean up any previous fixtures
git worktree remove "$PROJECT_DIR/build/data" 2>/dev/null || true
rm -rf "$PROJECT_DIR/build/data"
rm -rf "$PROJECT_DIR/build/fixtures"

# Create the fixture directory
mkdir -p "$PROJECT_DIR/build/fixtures"

if [ -n "$__fetch_from" ]; then
    echo "Fetching fixtures from $__fetch_from..."
    wget --quiet -O "$PROJECT_DIR/build/fixtures/machine-info.json" "$__fetch_from/machine-info.json"
    wget --quiet -O "$PROJECT_DIR/build/fixtures/website-config.json" "$__fetch_from/website-config.json"
    wget --quiet -O "$PROJECT_DIR/build/fixtures/affiliation.schema.json" "$__fetch_from/affiliation.schema.json"
else
    echo "Generating fixtures..."
    # Create a new worktree
    git worktree add "$PROJECT_DIR/build/data" origin/data
    # Generate fixtures
    python3 "$SCRIPT_DIR/generate-machine-info.py" "$PROJECT_DIR/build/data" "$PROJECT_DIR/build/fixtures"
    python3 "$SCRIPT_DIR/generate-website-config.py" "$PROJECT_DIR/../outputs" "$PROJECT_DIR/build/fixtures"
    cp "$PROJECT_DIR/../directory/affiliations/affiliation.schema.json" "$PROJECT_DIR/build/fixtures"
    cp "$PROJECT_DIR/../outputs/directory/users/user.schema.json" "$PROJECT_DIR/build/fixtures"
fi

# Add typescript types
echo "Generating fixture types..."
./node_modules/.bin/quicktype -o "$PROJECT_DIR"/build/fixtures/machine-info.{ts,json}
./node_modules/.bin/quicktype -o "$PROJECT_DIR"/build/fixtures/website-config.{ts,json}

echo "Compiling JSON schema validators..."
node "$PROJECT_DIR/scripts/compile-json-schema-validators.js" "$PROJECT_DIR/build/fixtures"

echo "Processing images..."
# Convert AVIF images to WebP and JPEG for browsers that don't support AVIF
"$PROJECT_DIR"/node_modules/.bin/sharp --format webp --input "$PROJECT_DIR"'/public/assets/*.avif' --output "$PROJECT_DIR"'/public/assets/{name}.generated.webp'
"$PROJECT_DIR"/node_modules/.bin/sharp --format jpg --input "$PROJECT_DIR"'/public/assets/*.avif' --output "$PROJECT_DIR"'/public/assets/{name}.generated.jpg'
# Generate typescript file to facilitate importing images
cat <<EOF > "$PROJECT_DIR"/build/fixtures/images.ts
// This file is automatically generated. Please do not edit.
import { StaticImageData } from "next/image"

export type WATcloudStaticImage = {
    avif: StaticImageData,
    webp: StaticImageData,
    jpg: StaticImageData,
}
EOF
for image in "$PROJECT_DIR"/public/assets/*.avif; do
    name=$(basename "$image" .avif)
    jsname=$(to_pascale_case "$name")
    # echo "export const $name = require('./$name.generated.webp');" >> "$PROJECT_DIR"/public/assets/images.generated.ts
    cat <<EOF >> "$PROJECT_DIR"/build/fixtures/images.ts
        import ${jsname}Avif from '@/public/assets/${name}.avif';
        import ${jsname}Webp from '@/public/assets/${name}.generated.webp';
        import ${jsname}Jpg from '@/public/assets/${name}.generated.jpg';

        export const ${jsname}: WATcloudStaticImage = {
            avif: ${jsname}Avif,
            webp: ${jsname}Webp,
            jpg: ${jsname}Jpg,
        };
EOF
done

