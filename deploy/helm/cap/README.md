# Cap Helm chart

Deploys the [Cap](https://github.com/SoGooDFR/cap) standalone proof-of-work CAPTCHA server on Kubernetes.

The pod is **stateless and rootless** (runs as the non-root `bun` user, read-only root filesystem, all capabilities dropped). All state lives in Redis/Valkey, which is **external** to this chart.

## Install

```sh
# From the OCI registry (published by the chart-release workflow):
helm install cap oci://ghcr.io/<owner>/charts/cap --version 0.1.0 \
  --set secrets.adminKey='change-me-min-12-chars' \
  --set secrets.redisUrl='redis://valkey:6379'

# Or from a local checkout:
helm install cap ./deploy/helm/cap \
  --set secrets.adminKey='change-me-min-12-chars' \
  --set secrets.redisUrl='redis://valkey:6379'
```

`secrets.adminKey` (>= 12 chars) and `secrets.redisUrl` are required unless you provide your own Secret via `secrets.existingSecret`.

## Redis / high availability

This chart does not deploy Redis. Point it at an existing instance or a managed cluster.

```yaml
secrets:
  redisUrl: "redis://node-1:6379,redis://node-2:6379,redis://node-3:6379"
config:
  REDIS_CLUSTER: "true"
  REDIS_PREFIX: "cap:"
```

For HA also enable:

```yaml
replicaCount: 3
podDisruptionBudget:
  enabled: true
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: cap
```

## Exposure: Ingress or Gateway API

Enable one. Ingress:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: cap.example.com
      paths: [{ path: /, pathType: Prefix }]
  tls:
    - secretName: cap-tls
      hosts: [cap.example.com]
```

Gateway API (`HTTPRoute`):

```yaml
gateway:
  enabled: true
  parentRefs:
    - name: public-gateway
      namespace: gateway-system
  hostnames:
    - cap.example.com
```

## Key parameters

| Key | Default | Description |
|-----|---------|-------------|
| `replicaCount` | `2` | Number of pods (ignored if autoscaling). |
| `image.repository` / `image.tag` | `ghcr.io/sogoodfr/cap` / `""` | Image; tag defaults to chart `appVersion`. |
| `secrets.adminKey` | `""` | Dashboard/API admin key (>= 12 chars), required. |
| `secrets.redisUrl` | `redis://valkey:6379` | Redis/Valkey URL (comma-separated seeds in cluster mode). |
| `secrets.existingSecret` | `""` | Use an existing Secret instead of creating one. |
| `config.*` | see `values.yaml` | Non-sensitive env vars (REDIS_CLUSTER, REDIS_PREFIX, CORS_ORIGIN, RATELIMIT_IP_HEADER, ...). Empty values are skipped. |
| `extraEnv` / `envFrom` | `[]` | Additional env / env sources. |
| `ingress.*` | disabled | Ingress resource. |
| `gateway.*` | disabled | Gateway API HTTPRoute. |
| `autoscaling.*` | disabled | HorizontalPodAutoscaler. |
| `podDisruptionBudget.*` | disabled | PDB for HA. |
| `dataDir.*` | `/usr/src/app/data` | emptyDir for runtime GeoIP downloads. |
| `resources` | 100m/128Mi .. 1/512Mi | Requests/limits. |
| `podSecurityContext` / `securityContext` | hardened | Rootless defaults. |

See `values.yaml` for the full, commented list.
