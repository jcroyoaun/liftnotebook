#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-${KUBECONFIG:-}}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-ghcr.io}"
IMAGE_NAMESPACE="${IMAGE_NAMESPACE:-${DOCKER_REPO:-jcroyoaun}}"
IMAGE_TAG_PROVIDED="false"
if [[ -n "${IMAGE_TAG:-}" ]]; then
  IMAGE_TAG_PROVIDED="true"
else
  IMAGE_TAG=""
fi
APP_HOST="${APP_HOST:-liftnotebook.totalcomp.mx}"
EXERCISELIB_HOST="${EXERCISELIB_HOST:-exerciselib.totalcomp.mx}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"
# Fresh environments only: creates schemas and loads the exercise catalog
# seed data. Routine deploys skip this — workouttracker applies its own
# schema migrations at startup.
RUN_DB_BOOTSTRAP="${RUN_DB_BOOTSTRAP:-false}"

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
  local invite_code="${LIFTNOTEBOOK_INVITE_CODE:-}"
  local admin_emails="${LIFTNOTEBOOK_ADMIN_EMAILS:-}"

  # Reuse values from an existing secret for anything not supplied explicitly,
  # so redeploys never rotate credentials by accident.
  if kubectl --kubeconfig "${KUBECONFIG_PATH}" get secret liftnotebook-app-secrets -n liftnotebook >/dev/null 2>&1; then
    if [[ -z "${jwt_secret}" ]]; then
      jwt_secret="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook get secret liftnotebook-app-secrets -o jsonpath='{.data.jwt-secret}' | base64 -d)"
    fi
    if [[ -z "${invite_code}" ]]; then
      invite_code="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook get secret liftnotebook-app-secrets -o jsonpath='{.data.invite-code}' | base64 -d || true)"
    fi
    if [[ -z "${admin_emails}" ]]; then
      admin_emails="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook get secret liftnotebook-app-secrets -o jsonpath='{.data.admin-emails}' | base64 -d || true)"
    fi
  fi

  if [[ -z "${jwt_secret}" ]]; then
    jwt_secret="$(openssl rand -hex 32)"
    echo "generated new JWT secret for liftnotebook-app-secrets" >&2
  fi

  if [[ -z "${invite_code}" ]]; then
    invite_code="$(openssl rand -hex 8)"
    echo "generated new invite code for liftnotebook-app-secrets" >&2
    echo "retrieve it with: kubectl -n liftnotebook get secret liftnotebook-app-secrets -o jsonpath='{.data.invite-code}' | base64 -d" >&2
  fi

  if [[ -z "${admin_emails}" ]]; then
    echo "no admin emails configured; set LIFTNOTEBOOK_ADMIN_EMAILS (comma-separated) to grant the admin role for exercise-console writes" >&2
  fi

  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook create secret generic liftnotebook-app-secrets \
    --from-literal=jwt-secret="${jwt_secret}" \
    --from-literal=invite-code="${invite_code}" \
    --from-literal=admin-emails="${admin_emails}" \
    --dry-run=client -o yaml | kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -f -
}

ensure_exerciselib_secret() {
  local admin_api_key="${EXERCISELIB_ADMIN_API_KEY:-}"

  if [[ -z "${admin_api_key}" ]] && kubectl --kubeconfig "${KUBECONFIG_PATH}" get secret exerciselib-app-secrets -n exerciselib >/dev/null 2>&1; then
    admin_api_key="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n exerciselib get secret exerciselib-app-secrets -o jsonpath='{.data.admin-api-key}' | base64 -d || true)"
  fi

  if [[ -z "${admin_api_key}" ]]; then
    admin_api_key="$(openssl rand -hex 32)"
    echo "generated new admin API key for exerciselib-app-secrets" >&2
    echo "retrieve it later with: kubectl -n exerciselib get secret exerciselib-app-secrets -o jsonpath='{.data.admin-api-key}' | base64 -d" >&2
  fi

  # Console admins sign in with workouttracker-issued JWTs, so exerciselib
  # needs the same signing secret; namespaces don't share secrets, so mirror
  # the value (requires ensure_liftnotebook_secret to have run first).
  local jwt_secret
  jwt_secret="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" -n liftnotebook get secret liftnotebook-app-secrets -o jsonpath='{.data.jwt-secret}' | base64 -d)"

  kubectl --kubeconfig "${KUBECONFIG_PATH}" -n exerciselib create secret generic exerciselib-app-secrets \
    --from-literal=admin-api-key="${admin_api_key}" \
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
  if [[ -z "${IMAGE_TAG}" ]]; then
    IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
  fi

  docker buildx build --platform linux/amd64 --push \
    -t "${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/exerciselib:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/exerciselib"

  docker buildx build --platform linux/amd64 --push \
    -t "${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/libconsole:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/frontend"

  docker buildx build --platform linux/amd64 --push \
    -t "${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/workouttracker:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/workouttracker"

  docker buildx build --platform linux/amd64 --push \
    -t "${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/liftnotebook-webapp:${IMAGE_TAG}" \
    "${ROOT_DIR}/microservices/webapp"
}

apply_workloads() {
  local overlay_dir=""
  local exerciselib_image_name=""
  local libconsole_image_name=""
  local workouttracker_image_name=""
  local webapp_image_name=""
  overlay_dir="$(mktemp -d "${ROOT_DIR}/k8s/.deploy-overlay.XXXXXX")"
  trap 'rm -rf "${overlay_dir:-}"' EXIT
  exerciselib_image_name="$(awk '/image:/{print $2; exit}' "${ROOT_DIR}/k8s/environments/linode/apps/exerciselib-deployment.yaml")"
  libconsole_image_name="$(awk '/image:/{print $2; exit}' "${ROOT_DIR}/k8s/environments/linode/apps/libconsole-deployment.yaml")"
  workouttracker_image_name="$(awk '/image:/{print $2; exit}' "${ROOT_DIR}/k8s/environments/linode/apps/workouttracker-deployment.yaml")"
  webapp_image_name="$(awk '/image:/{print $2; exit}' "${ROOT_DIR}/k8s/environments/linode/apps/webapp-deployment.yaml")"
  exerciselib_image_name="${exerciselib_image_name%:*}"
  libconsole_image_name="${libconsole_image_name%:*}"
  workouttracker_image_name="${workouttracker_image_name%:*}"
  webapp_image_name="${webapp_image_name%:*}"

  cat > "${overlay_dir}/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../environments/linode/apps
  - ../environments/linode/ingress
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

  if [[ "${BUILD_IMAGES}" == "true" || "${IMAGE_TAG_PROVIDED}" == "true" ]]; then
    cat > "${overlay_dir}/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../environments/linode/apps
  - ../environments/linode/ingress
images:
  - name: ${exerciselib_image_name}
    newName: ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/exerciselib
    newTag: ${IMAGE_TAG}
  - name: ${libconsole_image_name}
    newName: ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/libconsole
    newTag: ${IMAGE_TAG}
  - name: ${workouttracker_image_name}
    newName: ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/workouttracker
    newTag: ${IMAGE_TAG}
  - name: ${webapp_image_name}
    newName: ${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/liftnotebook-webapp
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
  fi

  kubectl --kubeconfig "${KUBECONFIG_PATH}" apply -k "${overlay_dir}"
}

smoke_test() {
  local ingress_host
  ingress_host="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get svc istio-ingress -n istio-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  if [[ -z "${ingress_host}" ]]; then
    ingress_host="$(kubectl --kubeconfig "${KUBECONFIG_PATH}" get svc istio-ingress -n istio-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"
  fi

  curl --fail --silent --show-error -H "Host: ${EXERCISELIB_HOST}" "http://${ingress_host}/v1/healthcheck" >/dev/null
  curl --fail --silent --show-error -H "Host: ${EXERCISELIB_HOST}" "http://${ingress_host}/" >/dev/null
  curl --fail --silent --show-error -H "Host: ${APP_HOST}" "http://${ingress_host}/v1/healthcheck" >/dev/null
  curl --fail --silent --show-error -H "Host: ${APP_HOST}" "http://${ingress_host}/" >/dev/null

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

ensure_liftnotebook_secret
ensure_exerciselib_secret

if [[ "${RUN_DB_BOOTSTRAP}" == "true" ]]; then
  ensure_bootstrap_configmaps
  apply_bootstrap_jobs
fi

apply_workloads

kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/exerciselib -n exerciselib --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/libconsole -n exerciselib --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/workouttracker -n liftnotebook --timeout=300s
kubectl --kubeconfig "${KUBECONFIG_PATH}" rollout status deployment/webapp -n liftnotebook --timeout=300s

smoke_test
