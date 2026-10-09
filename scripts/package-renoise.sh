#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
source_dir="$root/integrations/renoise/com.mxjxn.GenerantOsc.xrnx"
output="$root/dist/Generant-Osc-Renoise-1.0.xrnx"
mkdir -p "$(dirname "$output")"
cd "$source_dir"
zip -q -r "$output" manifest.xml main.lua README.md
echo "$output"
