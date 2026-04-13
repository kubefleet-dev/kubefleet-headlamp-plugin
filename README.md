# KubeFleet Manager Headlamp Plugin

A Headlamp plugin for managing KubeFleet resources via a hub cluster, providing visibility into multi-cluster fleet operations.

![KubeFleet Manager in Headlamp](https://raw.githubusercontent.com/kubefleet-dev/kubefleet-headlamp-plugin/refs/heads/main/kubfleet-manager-01.png)

## Prerequisites

The target cluster must have the [KubeFleet](https://kubefleet.dev/) CRDs and hub-agent installed. You can access the cluster using its `kubeconfig`.

## Development

The plugin requires you have Headlamp (https://headlamp.dev/) available on your machine if you want an end-to-end debugging experience.

```bash
npm install
npm start   # watch mode
npm run build
npm run tsc
npm run lint
```
