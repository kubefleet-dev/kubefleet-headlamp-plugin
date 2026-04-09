# KubeFleet Manager Headlamp Plugin

A Headlamp plugin for managing KubeFleet resources via a hub cluster, providing visibility into multi-cluster fleet operations.

## Prerequisites

The target cluster must have the [KubeFleet](https://kubefleet.dev/) CRDs and hub-agent installed.

## Development

The plugin requires you have Headlamp (https://headlamp.dev/) available on your machine.

```bash
npm install
npm start   # watch mode
npm run build
npm run tsc
npm run lint
```
