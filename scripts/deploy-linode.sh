#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-${KUBECONFIG:-}}"
DOCKER_REPO="${DOCKER_REPO:-jcroyoaun}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
APP_HOST="${APP_HOST:-liftnotebook.totalcomp.mx}"
EXERCISELIB_HOST="${EXERCISELIB_HOST:-exerciselib.totalcomp.mx}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"

require_tool() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required tool: $1" >&2
    exit 1
  }
}

require_kubeconfig() {
  if [[ -z "${KUBECONFIG_PATH}" ]]; then
    echo "set KUBECONFIG_PATH or KUBECONFIG before running this script" >&2
    exit 1
  fi
}

cleanup_stale_overlays() {
  rm -rf "${ROOT_DIR}"/k8s/.deploy-overlay.*
}

disable_namespace_injection() {
  kubectl --kubeconfig "${KUBECONFIG_PATH}" patch namespace exerciselib --type merge -p '{"metadata":{"labels":{"istio-injection":null}}}' >/dev/null 2>&1 || true
  kubectl --kubeconfig "${KUBECONFIG_PATH}" patch namespace liftnotebook --type merge -p '{"metadata":{"labels":{"istio-injection":null}}}' >/dev/null 2>&1 || true
}

wait_for_postgres() {
  local namespace="$1"
  local cluster="$2"
  kubectl --kubeconfig "${KUBECONFIG_PATH}" wait \
    --namespace "${namespace}" \
    --for=jsonpath='{.status.PostgresClusterStatus}'=Running \
    "postgresql/${cluster}" \
    --timeout=600s
}

wait_for_secret() {
  local namespace="$1"
  local name="$2"
  for _ in $(seq 1 120); do
    if kubectl --kubeconfig "${KUBECONFIG_PATH}" get secret "${name}" -n "${namespace}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "timed out waiting for secret ${namespace}/${name}" >&2
  exit 1
}

ensure_bootstrap_configmaps() {
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n exerciselib create configmap exerciselib-db-bootstrap-sql \
    --from-file=schema.sql="${ROOT_DIR}/k8s/sql/exerciselib-init.sql" \
    --from-file=seed.sql="${ROOT_DIR}/dumps/seed.sql" \
    --dry-run=client -o yaml | kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -

  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook create configmap liftnotebook-db-bootstrap-sql \
    --from-file=schema.sql="${ROOT_DIR}/microservices/workouttracker/migrations/000001_init.up.sql" \
    --from-file=seed.sql="${ROOT_DIR}/dumps/seed.sql" \
    --dry-run=client -o yaml | kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -
}

ensure_liftnotebook_secret() {
  local jwt_secret="${LIFTNOTEBOOK_JWT_SECRET:-}"
  if [[ -z "${jwt_secret}" ]]; then
    if kubectl --kubeconfig "${KUBECONFIG_PATH}" get secret liftnotebook-app-secrets -n liftnotebook >/dev/null 2>&1; then
      echo "reusing existing liftnotebook-app-secrets secret" >&2
      return 0
    fi

    jwt_secret="$(openssl rand -hex 32)"
    echo "generated new JWT secret for liftnotebook-app-secrets" >&2
  fi

  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook create secret generic liftnotebook-app-secrets \
    --from-literal=jwt-secret="${jwt_secret}" \
    --dry-run=client -o yaml | kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -
}

apply_bootstrap_jobs() {
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n exerciselib delete job exerciselib-db-bootstrap --ignore-not-found
  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook delete job liftnotebook-db-bootstrap --ignore-not-found
  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${ROOT_DIR}/k8s/environments/linode/bootstrap"
  kubectl --kubeconfig "${KUBECONFIG_PATH}" wait -n exerciselib --for=condition=complete job/exerciselib-db-bootstrap --timeout=600s
  kubectl --kubeconfig "${KUBECONFIG_PATH}" wait -n liftnotebook --for=condition=complete job/liftnotebook-db-bootstrap --timeout=600s
}

build_and_push_images() {
  docker buildx build --platform linux/amd64 --push \
    -t "docker.io/${DOCKER_REPO}/exerciselib:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/exerciselib"

  docker buildx build --platform linux/amd64 --push \
    -t "docker.io/${DOCKER_REPO}/workouttracker:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/workouttracker"

  docker buildx build --platform linux/amd64 --push \
    -t "docker.io/${DOCKER_REPO}/liftnotebook-webapp:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/webapp"
}

apply_workloads() {
  local overlay_dir=""
  overlay_dir="$(mktemp -d "${ROOT_DIR}/k8s/.deploy-overlay.XXXXXX")"
  trap 'rm -rf "${overlay_dir:-}"' EXIT

  cat > "${overlay_dir}/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../environments/linode/apps
  - ../environments/linode/ingress
images:
  - name: docker.io/jcroyoaun/exerciselib
    newName: docker.io/${DOCKER_REPO}/exerciselib
    newTag: ${IMAGE_TAG}
  - name: docker.io/jcroyoaun/workouttracker
    newName: docker.io/${DOCKER_REPO}/workouttracker
    newTag: ${IMAGE_TAG}
  - name: docker.io/jcroyoaun/liftnotebook-webapp
    newName: docker.io/${DOCKER_REPO}/liftnotebook-webapp
    newTag: ${IMAGE_TAG}
patches:
  - target:
      kind: Gateway
      name: exerciselib-gateway
      namespace: exerciselib
    patch: |-
      - op: replace
        path: /spec/servers/0/hosts/0
        value: ${EXERCISELIB_HOST}
  - target:
      kind: VirtualService
      name: exerciselib
      namespace: exerciselib
    patch: |-
      - op: replace
        path: /spec/hosts/0
        value: ${EXERCISELIB_HOST}
  - target:
      kind: Gateway
      name: liftnotebook-gateway
      namespace: liftnotebook
    patch: |-
      - op: replace
        path: /spec/servers/0/hosts/0
        value: ${APP_HOST}
  - target:
      kind: VirtualService
      name: liftnotebook
      namespace: liftnotebook
    patch: |-
      - op: replace
        path: /spec/hosts/0
        value: ${APP_HOST}
EOF

  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${overlay_dir}"
}

smoke_test() {
  local ingress_host
  ingress_host="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get svc istio-ingress -n istio-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  if [[ -z "${ingress_host}" ]]; then
    ingress_host="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get svc istio-ingress -n istio-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
  fi

  curl --fail --silent --show-error -H "Host: ${EXERCISELIB_HOST}" "http://${ingress_host}/v1/healthcheck" >/dev/null
  curl --fail --silent --show-error -H "Host: ${APP_HOST}" "http://${ingress_host}/v1/healthcheck" >/dev/null

  echo "Smoke tests passed through ${ingress_host}" >&2
  echo "Create DNS records for ${APP_HOST} and ${EXERCISELIB_HOST} pointing at ${ingress_host}" >&2
}

require_tool kubectl
require_tool docker
require_tool curl
require_tool openssl
require_kubeconfig
cleanup_stale_overlays

kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${ROOT_DIR}/k8s/environments/linode/namespaces"
disable_namespace_injection

if ! kubectl --kubeconfig "${KUBECONFIG_PATH}" get crd postgresqls.acid.zalan.do >/dev/null 2>&1; then
  "${ROOT_DIR}/scripts/bootstrap-postgres-operator.sh"
fi

if [[ "${BUILD_IMAGES}" == "true" ]]; then
  build_and_push_images
fi

kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${ROOT_DIR}/k8s/environments/linode/databases"

wait_for_postgres exerciselib exerciselib-db
wait_for_postgres liftnotebook liftnotebook-db
wait_for_secret exerciselib exerciselib-app.exerciselib-db.credentials.postgresql.acid.zalan.do
wait_for_secret liftnotebook liftnotebook-app.liftnotebook-db.credentials.postgresql.acid.zalan.do

ensure_bootstrap_configmaps
ensure_liftnotebook_secret
apply_bootstrap_jobs

apply_workloads

kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/exerciselib -n exerciselib --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/workouttracker -n liftnotebook --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/webapp -n liftnotebook --timeout=300s

smoke_test
