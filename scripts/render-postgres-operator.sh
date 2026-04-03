#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART_REPO="https://opensource.zalando.com/postgres-operator/charts/postgres-operator"
CHART_VERSION="1.14.0"

helm show crds postgres-operator \
  --repo "${CHART_REPO}" \
  --version "${CHART_VERSION}" \
  > "${ROOT_DIR}/k8s/platform/postgres-operator/crds/rendered/crds.yaml"

helm template postgres-operator postgres-operator \
  --repo "${CHART_REPO}" \
  --version "${CHART_VERSION}" \
  --namespace postgres-operator \
  -f "${ROOT_DIR}/k8s/platform/postgres-operator/operator/values.yaml" \
  > "${ROOT_DIR}/k8s/platform/postgres-operator/operator/rendered/operator.yaml"
