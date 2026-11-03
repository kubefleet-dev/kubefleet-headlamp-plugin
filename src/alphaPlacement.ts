/*
 * Copyright 2026 The KubeFleet Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { K8s } from '@kinvolk/headlamp-plugin/lib';

export const PLACEMENT_POLICY_API = 'placement.kubefleet.dev/v1alpha1';
export const POLICY_CONDITIONS = ['Scheduled', 'ResourceCollected', 'Synchronized', 'Available'];

export interface PlacementCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  observedGeneration?: number;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ResourceSelector {
  apiGroup?: string;
  apiVersion: string;
  kind: string;
  name?: string;
  namespace?: string;
  labelSelector?: Record<string, unknown>;
}

export interface ClusterSelector {
  count?: number | string;
  minCount?: number;
  whenUnfulfilled?: 'AddClusterClaim' | 'KeepSearching';
  terms?: {
    matchLabels?: Record<string, string>;
    matchLabelExpressions?: { key: string; operator: string; values?: string[] }[];
    matchClusterPropertyExpressions?: { key: string; operator: string; values?: string[] }[];
  }[];
}

export interface PlacementPolicyData extends K8s.cluster.KubeObjectInterface {
  spec: {
    resourceSelectors: ResourceSelector[];
    clusterSelectors?: ClusterSelector[];
    resourceRevisionHistoryLimit?: number;
    syncStrategy?: Record<string, unknown>;
  };
  status?: {
    conditions?: PlacementCondition[];
    latestResourceRevisionName?: string;
    desiredClusters?: number;
    scheduledClusters?: number;
    synchronizedClusters?: number;
    resourcesAvailableClusters?: number;
    activeClusterClaims?: number;
  };
}

export interface PlacementBindingData extends K8s.cluster.KubeObjectInterface {
  spec: {
    placementPolicyName: string;
    clusterName: string;
    resourceSnapshotName: string;
    suspended?: boolean;
  };
  status?: {
    conditions?: PlacementCondition[];
    selectedResources?: number;
    synchronizedResources?: number;
    availableResources?: number;
    lastProcessedResourceSnapshotName?: string;
    failedResources?: {
      objectRef: ResourceSelector;
      conditions?: PlacementCondition[];
    }[];
  };
}

export class PlacementPolicy extends K8s.cluster.KubeObject<PlacementPolicyData> {
  static kind = 'PlacementPolicy';
  static apiName = 'placementpolicies';
  static apiVersion = PLACEMENT_POLICY_API;
  static isNamespaced = true;
}

export class ClusterPlacementPolicy extends K8s.cluster.KubeObject<PlacementPolicyData> {
  static kind = 'ClusterPlacementPolicy';
  static apiName = 'clusterplacementpolicies';
  static apiVersion = PLACEMENT_POLICY_API;
  static isNamespaced = false;
}

export class PlacementBinding extends K8s.cluster.KubeObject<PlacementBindingData> {
  static kind = 'PlacementBinding';
  static apiName = 'placementbindings';
  static apiVersion = PLACEMENT_POLICY_API;
  static isNamespaced = true;
}

export class ClusterPlacementBinding extends K8s.cluster.KubeObject<PlacementBindingData> {
  static kind = 'ClusterPlacementBinding';
  static apiName = 'clusterplacementbindings';
  static apiVersion = PLACEMENT_POLICY_API;
  static isNamespaced = false;
}

export type StatusDisplay = {
  label: string;
  status: 'success' | 'warning' | 'error';
  message: string;
};

type ConditionedResource = {
  metadata: { generation?: number; deletionTimestamp?: string };
  status?: { conditions?: PlacementCondition[] };
};

export function getConditionDisplay(resource: ConditionedResource, type: string): StatusDisplay {
  const condition = resource.status?.conditions?.find(item => item.type === type);
  if (!condition) {
    return { label: 'Pending', status: 'warning', message: `${type} has not been reported yet.` };
  }
  if (
    resource.metadata.generation !== undefined &&
    condition.observedGeneration !== resource.metadata.generation
  ) {
    return {
      label: 'Pending',
      status: 'warning',
      message: `Waiting for generation ${resource.metadata.generation}; ${type} is not current.`,
    };
  }
  return {
    label: condition.status,
    status:
      condition.status === 'True' ? 'success' : condition.status === 'False' ? 'error' : 'warning',
    message: [condition.reason, condition.message].filter(Boolean).join(': ') || condition.status,
  };
}

function getResourceStatus(resource: ConditionedResource, types: string[]): StatusDisplay {
  if (resource.metadata.deletionTimestamp) {
    return { label: 'Deleting', status: 'warning', message: 'Deletion is in progress.' };
  }
  const conditions = types.map(type => getConditionDisplay(resource, type));
  const failed = conditions.find(condition => condition.status === 'error');
  if (failed) {
    return { ...failed, label: 'Not Ready' };
  }
  const pending = conditions.find(condition => condition.status !== 'success');
  return pending
    ? { ...pending, label: 'Pending' }
    : {
        label: 'Ready',
        status: 'success',
        message: 'All required conditions are current and true.',
      };
}

export function getPolicyStatus(policy: PlacementPolicyData): StatusDisplay {
  return getResourceStatus(policy, POLICY_CONDITIONS);
}

export function getBindingStatus(binding: PlacementBindingData): StatusDisplay {
  if (binding.metadata.deletionTimestamp) {
    return getResourceStatus(binding, ['Synchronized', 'Available']);
  }
  if (binding.spec.suspended) {
    return { label: 'Suspended', status: 'warning', message: 'This binding is suspended.' };
  }
  const status = getResourceStatus(binding, ['Synchronized', 'Available']);
  if (status.status === 'error') {
    return status;
  }
  if (binding.status?.lastProcessedResourceSnapshotName !== binding.spec.resourceSnapshotName) {
    return {
      label: 'Pending',
      status: 'warning',
      message: 'The current resource snapshot has not been processed yet.',
    };
  }
  return status;
}

export function bindingBelongsToPolicy(
  binding: PlacementBindingData,
  policy: PlacementPolicyData
): boolean {
  const owner = binding.metadata.ownerReferences?.find(reference => reference.kind === policy.kind);
  return (
    binding.spec.placementPolicyName === policy.metadata.name &&
    (binding.metadata.namespace || '') === (policy.metadata.namespace || '') &&
    (binding.kind === 'PlacementBinding') === (policy.kind === 'PlacementPolicy') &&
    (!owner || owner.uid === policy.metadata.uid)
  );
}

export function getGeneratedSource(policy: PlacementPolicyData): string | undefined {
  const labels = policy.metadata.labels;
  const kind = labels?.['placement.kubefleet.dev/parent-kind'];
  const name = labels?.['placement.kubefleet.dev/parent-name'];
  const group = labels?.['placement.kubefleet.dev/parent-api-group'];
  if (!kind || !name || group === undefined) {
    return undefined;
  }
  const owner = policy.metadata.ownerReferences?.find(
    reference =>
      reference.kind === kind &&
      (reference.apiVersion.includes('/') ? reference.apiVersion.split('/')[0] : '') === group
  );
  return `${kind}/${owner?.name || name}`;
}

export function formatCounts(actual?: number, desired?: number): string {
  return `${actual ?? '-'} / ${desired ?? '-'}`;
}

export function formatApiError(
  error: { status?: number; message: string },
  resource: string
): string {
  if (error.status === 403) {
    return `Access denied reading ${resource}. Check get/list/watch permissions on ${PLACEMENT_POLICY_API}.`;
  }
  if (error.status === 404) {
    return `${resource} was not found. Verify the resource exists and the ${PLACEMENT_POLICY_API} CRDs are installed on the configured hub.`;
  }
  return `Unable to load ${resource}: ${error.message}`;
}
