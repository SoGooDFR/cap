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

## Self-hosting the widget assets

By default clients load the widget/wasm from a CDN. To serve them from this
server instead, enable the asset server and pin the versions (`latest` warns in
production). The assets are fetched once from `CACHE_HOST` and cached in Redis.

```yaml
config:
  ENABLE_ASSETS_SERVER: "true"
  WIDGET_VERSION: "0.1.53"      # pin to a published @cap.js/widget version
  WASM_VERSION: "0.0.7"         # pin to a published @cap.js/wasm version
  # CACHE_HOST: "https://cdn.jsdelivr.net"  # override for an internal mirror
```

Requires outbound access to `CACHE_HOST` at startup/refresh.

### Air-gapped (no runtime egress)

For a fully self-contained deployment, the widget/wasm are baked into the image
at build time and seeded into Redis by a post-install/upgrade hook Job, so the
server never reaches out at runtime:

```yaml
assets:
  airgap:
    enabled: true
    widgetVersion: "0.1.56"   # must match the image's WIDGET_VERSION build arg
    wasmVersion: "0.0.7"      # must match the image's WASM_VERSION build arg
```

This automatically sets `ENABLE_ASSETS_SERVER=true` and the versions (leave
`config.ENABLE_ASSETS_SERVER` empty). The versions **must** match the
`WIDGET_VERSION` / `WASM_VERSION` Docker build args used to build the image.

Note: GeoIP (db-ip/maxmind) is a separate runtime egress; keep it disabled for a
true air-gap, or supply the `.mmdb` files by other means.

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
