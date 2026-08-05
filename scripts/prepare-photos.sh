#!/bin/bash
# Prepare wedding photos and (optionally) upload them to Cloudflare R2.
#
# Usage:
#   scripts/prepare-photos.sh "<source folder>"                              # resize + manifest only
#   scripts/prepare-photos.sh "<source folder>" <r2-bucket> <public-base-url># ...then upload to R2
#
# Reads every "N. Section Name" subfolder of the source (empty ones are
# skipped), and for each JPG makes:
#   thumb/  ~640px  (gallery grid)
#   web/    ~2048px (lightbox)
#   full/   original (share / download)
# into photo-staging/, then writes photos-manifest.json at the repo root.
# With a bucket + base URL it also uploads staging via wrangler.
#
# Uses macOS's built-in `sips` — no dependencies. Re-runs skip already-staged
# files, so it's safe to re-run when the photographer delivers more folders.
set -euo pipefail

SRC="${1:?usage: prepare-photos.sh <source-dir> [r2-bucket] [public-base-url]}"
BUCKET="${2:-}"
BASE_URL="${3:-PLACEHOLDER}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$REPO/photo-staging"
MANIFEST="$REPO/photos-manifest.json"

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

mkdir -p "$STAGE"
sections_json=""

while IFS= read -r dir; do
  name="$(basename "$dir")"
  title="$(echo "$name" | sed -E 's/^[0-9]+\.? *//')"   # "1. Getting Ready" -> "Getting Ready"
  slug="$(slugify "$name")"

  count=0
  photos_json=""
  while IFS= read -r f; do
    if [ "$count" -eq 0 ]; then
      mkdir -p "$STAGE/thumb/$slug" "$STAGE/web/$slug" "$STAGE/full/$slug"
      echo "== $title"
    fi
    base="$(slugify "$(basename "${f%.*}")").jpg"
    thumb="$STAGE/thumb/$slug/$base"
    web="$STAGE/web/$slug/$base"
    full="$STAGE/full/$slug/$base"
    [ -f "$thumb" ] || sips --resampleHeightWidthMax 640 -s format jpeg -s formatOptions 72 "$f" --out "$thumb" >/dev/null
    [ -f "$web" ]   || sips --resampleHeightWidthMax 2048 -s format jpeg -s formatOptions 82 "$f" --out "$web" >/dev/null
    [ -f "$full" ]  || ln -sf "$f" "$full"   # symlink: originals stay in the source folder, no disk copy

    w="$(sips -g pixelWidth "$web" | awk '/pixelWidth/{print $2}')"
    h="$(sips -g pixelHeight "$web" | awk '/pixelHeight/{print $2}')"
    photos_json+="{\"f\":\"$slug/$base\",\"w\":$w,\"h\":$h},"
    count=$((count + 1))
  done < <(find "$dir" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) | sort -V)

  if [ "$count" -gt 0 ]; then
    echo "   $count photos staged"
    sections_json+="{\"title\":\"$title\",\"slug\":\"$slug\",\"photos\":[${photos_json%,}]},"
  else
    echo "== $title — empty, skipped"
  fi
done < <(find "$SRC" -mindepth 1 -maxdepth 1 -type d | sort)

printf '{\n  "baseUrl": "%s",\n  "sections": [%s]\n}\n' "$BASE_URL" "${sections_json%,}" > "$MANIFEST"
echo "Wrote $MANIFEST"

if [ -n "$BUCKET" ]; then
  echo "Uploading to R2 bucket '$BUCKET' ..."
  cd "$STAGE"
  find . -type f | sed 's|^\./||' | \
    xargs -P 6 -I{} npx wrangler r2 object put "$BUCKET/{}" --file "{}" --remote --content-type image/jpeg
  echo "Done. Commit photos-manifest.json and push to publish the gallery."
else
  echo "No bucket given — staged only. Re-run with bucket + base URL to upload."
fi
