#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-${KUBECONFIG:-}}"

if [[ -z "${KUBECONFIG_PATH}" ]]; then
  echo "set KUBECONFIG_PATH or KUBECONFIG before running this script" >&2
  exit 1
fi

kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${ROOT_DIR}/k8s/platform/postgres-operator/crds"
kubectl --kubeconfig "${KUBECONFIG_PATH}" wait --for=condition=Established crd/postgresqls.acid.zalan.do --timeout=180s
kubectl --kubeconfig "${KUBECONFIG_PATH}" wait --for=condition=Established crd/operatorconfigurations.acid.zalan.do --timeout=180s
kubectl --kubeconfig "${KUBECONFIG_PATH}" wait --for=condition=Established crd/postgresteams.acid.zalan.do --timeout=180s

kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${ROOT_DIR}/k8s/platform/postgres-operator/operator"
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/postgres-operator -n postgres-operator --timeout=300s
