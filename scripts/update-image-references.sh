#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <image-tag> [image-prefix]" >&2
  exit 1
fi

IMAGE_TAG="$1"
IMAGE_PREFIX="${2:-ghcr.io/jcroyoaun}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

update_image() {
  local file="$1"
  local image_name="$2"

  IMAGE_PREFIX="${IMAGE_PREFIX}" IMAGE_TAG="${IMAGE_TAG}" IMAGE_NAME="${image_name}" \
    perl -0pi -e 's#(image:\s*)[^\s]+/\Q$ENV{IMAGE_NAME}\E:[^\s]+#${1}$ENV{IMAGE_PREFIX}/$ENV{IMAGE_NAME}:$ENV{IMAGE_TAG}#g' "${file}"
}

update_image "${ROOT_DIR}/k8s/environments/linode/apps/exerciselib-deployment.yaml" "exerciselib"
update_image "${ROOT_DIR}/k8s/environments/linode/apps/libconsole-deployment.yaml" "libconsole"
update_image "${ROOT_DIR}/k8s/environments/linode/apps/workouttracker-deployment.yaml" "workouttracker"
update_image "${ROOT_DIR}/k8s/environments/linode/apps/webapp-deployment.yaml" "liftnotebook-webapp"
