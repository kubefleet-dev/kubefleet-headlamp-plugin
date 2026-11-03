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

import { describe, expect, it, vi } from 'vitest';
import {
  bindingBelongsToPolicy,
  ClusterPlacementBinding,
  ClusterPlacementPolicy,
  formatApiError,
  formatCounts,
  getBindingStatus,
  getConditionDisplay,
  getGeneratedSource,
  getPolicyStatus,
  PlacementBinding,
  PlacementBindingData,
  PlacementPolicy,
  PlacementPolicyData,
  POLICY_CONDITIONS,
} from './alphaPlacement';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: { cluster: { KubeObject: class {} } },
}));

function policy(): PlacementPolicyData {
  return {
    apiVersion: 'placement.kubefleet.dev/v1alpha1',
    kind: 'PlacementPolicy',
    metadata: {
      name: 'sample',
      namespace: 'demo',
      uid: 'policy-uid',
      creationTimestamp: '2026-11-03T00:00:00Z',
      generation: 2,
    },
    spec: { resourceSelectors: [{ apiVersion: 'v1', kind: 'ConfigMap', name: 'sample' }] },
    status: {
      conditions: POLICY_CONDITIONS.map(type => ({
        type,
        status: 'True',
        observedGeneration: 2,
      })),
    },
  };
}

function binding(): PlacementBindingData {
  return {
    apiVersion: 'placement.kubefleet.dev/v1alpha1',
    kind: 'PlacementBinding',
    metadata: {
      name: 'sample-east',
      namespace: 'demo',
      uid: 'binding-uid',
      creationTimestamp: '2026-11-03T00:00:00Z',
      generation: 1,
      ownerReferences: [
        {
          apiVersion: 'placement.kubefleet.dev/v1alpha1',
          kind: 'PlacementPolicy',
          name: 'sample',
          uid: 'policy-uid',
          controller: true,
          blockOwnerDeletion: true,
        },
      ],
    },
    spec: {
      placementPolicyName: 'sample',
      clusterName: 'east',
      resourceSnapshotName: 'revision-1',
    },
    status: {
      lastProcessedResourceSnapshotName: 'revision-1',
      conditions: ['Synchronized', 'Available'].map(type => ({
        type,
        status: 'True',
        observedGeneration: 1,
      })),
    },
  };
}

describe('alpha resource API scopes', () => {
  it.each([
    [PlacementPolicy, 'placementpolicies', true],
    [ClusterPlacementPolicy, 'clusterplacementpolicies', false],
    [PlacementBinding, 'placementbindings', true],
    [ClusterPlacementBinding, 'clusterplacementbindings', false],
  ])('uses the alpha API for %s', (resourceClass, pluralName, isNamespaced) => {
    expect(resourceClass.apiVersion).toBe('placement.kubefleet.dev/v1alpha1');
    expect(resourceClass.apiName).toBe(pluralName);
    expect(resourceClass.isNamespaced).toBe(isNamespaced);
  });
});

describe('policy conditions', () => {
  it('requires all four current conditions before reporting ready', () => {
    expect(getPolicyStatus(policy()).label).toBe('Ready');
    const item = policy();
    item.status.conditions.pop();
    expect(getPolicyStatus(item).label).toBe('Pending');
  });

  it('does not present a stale successful generation as ready', () => {
    const item = policy();
    item.metadata.generation = 3;
    expect(getPolicyStatus(item).label).toBe('Pending');
    expect(getConditionDisplay(item, 'Available').message).toContain('generation 3');
  });

  it('does not present an unobserved generation as ready', () => {
    const item = policy();
    delete item.status.conditions[0].observedGeneration;
    expect(getPolicyStatus(item).label).toBe('Pending');
  });

  it('shows pending resource rollout even when availability remains true', () => {
    const item = policy();
    item.status.conditions[2] = {
      type: 'Synchronized',
      status: 'False',
      observedGeneration: 2,
      reason: 'ResourcesChangedPendingRollout',
      message: 'A new rollout is required',
    };
    expect(getPolicyStatus(item)).toEqual({
      label: 'Not Ready',
      status: 'error',
      message: 'ResourcesChangedPendingRollout: A new rollout is required',
    });
  });

  it('handles missing status and deletion explicitly', () => {
    const item = policy();
    delete item.status;
    expect(getPolicyStatus(item).label).toBe('Pending');
    item.metadata.deletionTimestamp = '2026-11-03T01:00:00Z';
    expect(getPolicyStatus(item).label).toBe('Deleting');
  });
});

describe('binding status and policy association', () => {
  it('does not hide current synchronization failures behind an older processed snapshot', () => {
    const item = binding();
    item.status.lastProcessedResourceSnapshotName = 'revision-0';
    item.status.conditions[0] = {
      type: 'Synchronized',
      status: 'False',
      observedGeneration: 1,
      reason: 'InvalidSnapshots',
    };
    expect(getBindingStatus(item)).toEqual({
      label: 'Not Ready',
      status: 'error',
      message: 'InvalidSnapshots',
    });
  });

  it('requires the current resource snapshot as well as current conditions', () => {
    const item = binding();
    expect(getBindingStatus(item).label).toBe('Ready');
    item.status.lastProcessedResourceSnapshotName = 'revision-0';
    expect(getBindingStatus(item).label).toBe('Pending');
    item.spec.suspended = true;
    expect(getBindingStatus(item).label).toBe('Suspended');
  });

  it('isolates same-named policies by namespace and owner identity', () => {
    const item = binding();
    expect(bindingBelongsToPolicy(item, policy())).toBe(true);
    item.metadata.namespace = 'another-namespace';
    expect(bindingBelongsToPolicy(item, policy())).toBe(false);
    item.metadata.namespace = 'demo';
    item.metadata.ownerReferences[0].uid = 'previous-policy-uid';
    expect(bindingBelongsToPolicy(item, policy())).toBe(false);
  });

  it('matches cluster-scoped bindings without mixing policy scopes', () => {
    const item = binding();
    const owner = policy();
    item.kind = 'ClusterPlacementBinding';
    delete item.metadata.namespace;
    expect(bindingBelongsToPolicy(item, owner)).toBe(false);
    owner.kind = 'ClusterPlacementPolicy';
    delete owner.metadata.namespace;
    item.metadata.ownerReferences[0].kind = owner.kind;
    expect(bindingBelongsToPolicy(item, owner)).toBe(true);
  });
});

describe('source and display helpers', () => {
  it('uses the owner reference for a source whose name was shortened in labels', () => {
    const item = policy();
    item.metadata.labels = {
      'placement.kubefleet.dev/parent-api-group': '',
      'placement.kubefleet.dev/parent-kind': 'ConfigMap',
      'placement.kubefleet.dev/parent-name': 'shortened-name-hash',
    };
    item.metadata.ownerReferences = [
      {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        name: 'the-complete-original-source-name',
        uid: 'source-uid',
        controller: false,
        blockOwnerDeletion: false,
      },
    ];
    expect(getGeneratedSource(item)).toBe('ConfigMap/the-complete-original-source-name');
    delete item.metadata.labels;
    expect(getGeneratedSource(item)).toBeUndefined();
  });

  it('distinguishes zero counts from status that has not been reported', () => {
    expect(formatCounts(0, 0)).toBe('0 / 0');
    expect(formatCounts(undefined, 2)).toBe('- / 2');
  });

  it('does not hide missing APIs or authorization failures as empty results', () => {
    expect(formatApiError({ status: 403, message: 'Forbidden' }, 'PlacementPolicies')).toContain(
      'Access denied'
    );
    expect(formatApiError({ status: 404, message: 'Not Found' }, 'PlacementPolicies')).toContain(
      'CRDs'
    );
    expect(
      formatApiError({ status: 500, message: 'API server unavailable' }, 'PlacementPolicies')
    ).toContain('API server unavailable');
  });
});
