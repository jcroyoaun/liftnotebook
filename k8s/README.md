This directory contains the repeatable Kubernetes deployment layout for the Linode
cluster.

Key decisions:

- `exerciselib` and `liftnotebook` each get their own namespace.
- `workouttracker` and `webapp` share the `liftnotebook` namespace so the webapp can
  keep using the in-cluster `workouttracker` service name from nginx.
- `exerciselib` gets its own Postgres cluster.
- `liftnotebook` gets its own Postgres cluster, but that database is still seeded with
  reference exercise data because `workouttracker` reads those tables directly.
- Notebook-specific data is not preloaded. Fresh deployments start with empty users,
  mesocycles, sessions, and sets.
- Istio exposure is done with per-namespace Gateways and VirtualServices, so this app
  does not need to patch the shared cluster gateway.
- These workloads do not use Istio sidecars. The Linode cluster is currently two
  `g6-standard-1` nodes, and namespace-wide injection pushed the app pods into
  `Insufficient cpu` scheduling failures.
- The three app Deployments use `Recreate` strategy and small CPU requests because the
  cluster does not have enough spare requested CPU for surge-based one-replica rollouts.

Deployment order:

1. Bootstrap the Zalando operator on a fresh cluster if it is not already present.
2. Apply namespaces.
3. Apply the Postgres custom resources.
4. Create the SQL ConfigMaps and application secrets.
5. Run the database bootstrap Jobs.
6. Apply the workloads and ingress resources.

Use `scripts/deploy-linode.sh` for the full rollout.

The deployment scripts do not hardcode a kubeconfig path. Set either
`KUBECONFIG_PATH=/path/to/kubeconfig` or the standard `KUBECONFIG=/path/to/kubeconfig`
before running them.
