This directory keeps deprecated deployment assets for reference only.

Archived here:

- Root `skaffold` configs from the old local-Kubernetes workflow.
- The old `docker-compose.yml` local stack.
- The repo-local Helm chart that predated the current Linode `k8s/` manifests.

Current deployment path:

- Kubernetes manifests under `k8s/environments/linode`
- Rollout script at `scripts/deploy-linode.sh`
- Terraform under `infrastructure/`

Do not treat the files in this directory as the source of truth for current deployments.
