#!/usr/bin/env sh
set -eu
scratch="$(mktemp -d)"
trap 'rm -f "$scratch"/*.glb; rmdir "$scratch"' EXIT
for model in sofa armchair mattress chair other; do
  npx --yes --package=@gltf-transform/cli@4.5.1 gltf-transform meshopt "public/models/$model.glb" "$scratch/$model.glb" --level medium
done
cp "$scratch"/*.glb public/models/
