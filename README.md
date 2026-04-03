# LIFTNOTEBOOK

This repo currently deploys through the Linode Kubernetes manifests in `k8s/`
and the rollout script in `scripts/deploy-linode.sh`.

Main services:

1. `exerciselib` API: reference exercise catalog and metadata.
2. `libconsole` UI: admin console for `exerciselib`, sourced from `microservices/frontend`.
3. `workouttracker` API: workout-tracking backend for the notebook app.
4. `webapp` UI: notebook frontend for end users.

Repo layout:

- `k8s/`: active Kubernetes manifests for the Linode cluster.
- `scripts/`: deployment and cluster bootstrap helpers.
- `microservices/`: service source code and Docker build contexts.
- `infrastructure/`: Terraform environments. This remains active and is not archived.
- `archived/legacy-deployments/`: deprecated Skaffold, Compose, and old repo-local Helm assets kept only for reference.

For the current deployment flow, start with `k8s/README.md`.

GitHub Actions:

- Pull requests and pushes to `main`/`master` run unit tests for the Go services and
  the `webapp`.
- Pushes to `main`/`master` publish GHCR images for `exerciselib`, `libconsole`,
  `workouttracker`, and `liftnotebook-webapp` after tests pass.
- Those same pushes then commit the exact image tag back into the Kubernetes
  deployment manifests so a later `git pull` gives you deployable pinned refs.
- Publishing uses the workflow `GITHUB_TOKEN`; no Docker Hub credentials are needed.
- If your cluster should pull without registry credentials, set the published GHCR
  packages to `public` after the first push.
- Optional repository variable: `GHCR_NAMESPACE` if you want a namespace other than
  the repository owner.
