#!/usr/bin/env bash
#
# Converts the Playwright-recorded .webm demo to an optimized GIF.
# Requires: ffmpeg
#
# Usage: bash scripts/convert-demo-gif.sh
#

set -euo pipefail

VIDEO_DIR="/tmp/primavera-demo"
OUTPUT="assets/demo.gif"

WEBM=$(ls -t "$VIDEO_DIR"/*.webm 2>/dev/null | head -1)

if [ -z "$WEBM" ]; then
  echo "Error: No .webm file found in $VIDEO_DIR"
  echo "Run 'node scripts/record-demo.mjs' first."
  exit 1
fi

echo "Converting $WEBM → $OUTPUT"

ffmpeg -y -i "$WEBM" \
  -vf "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 \
  "$OUTPUT"

echo "Done! $(du -h "$OUTPUT" | cut -f1) → $OUTPUT"
