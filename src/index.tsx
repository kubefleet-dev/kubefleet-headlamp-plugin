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

import { Icon } from '@iconify/react';
import { ApiProxy, registerRoute, registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import {
  LightTooltip,
  Loader,
  SectionBox,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/Crd';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import * as yaml from 'js-yaml';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FleetConfigurationCapability } from './components/FleetConfigurationCapability';
import { MemberClustersCapability } from './components/MemberClustersCapability';
import { PendingApprovalsCapability } from './components/PendingApprovalsCapability';
import { PlacementPoliciesCapability } from './components/PlacementPoliciesCapability';
import { PlacementPolicyDetailsCapability } from './components/PlacementPolicyDetailsCapability';
import { PlacementStatusCapability } from './components/PlacementStatusCapability';
import { ResourceOverridesCapability } from './components/ResourceOverridesCapability';
import { RolloutRunDetailsCapability } from './components/RolloutRunDetailsCapability';
import { RolloutRunsCapability } from './components/RolloutRunsCapability';
import { RolloutStrategiesCapability } from './components/RolloutStrategiesCapability';
import { StagedResourceDetailsCapability } from './components/StagedResourceDetailsCapability';
import { StagedResourcesCapability } from './components/StagedResourcesCapability';

const HUB_CLUSTER_STORAGE_KEY = 'fleet-plugin-hub-cluster';

// ─── Custom Resource Classes ──────────────────────────────────────────────────

/**
 * MemberCluster represents a cluster that has joined the fleet.
 * API: cluster.kubernetes-fleet.io/v1
 */
const MemberCluster = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'cluster.kubernetes-fleet.io', version: 'v1' }],
    kind: 'MemberCluster',
    pluralName: 'memberclusters',
    singularName: 'membercluster',
    isNamespaced: false,
  } // cluster-scoped
);

/**
 * ClusterResourcePlacement defines policies for placing resources across member clusters.
 * API: placement.kubernetes-fleet.io/v1beta1
 */
const ClusterResourcePlacement = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1beta1' }],
    kind: 'ClusterResourcePlacement',
    pluralName: 'clusterresourceplacements',
    singularName: 'clusterresourceplacement',
    isNamespaced: false,
  } // cluster-scoped
);

/**
 * ResourcePlacement defines namespace-scoped placement policies.
 * API: placement.kubernetes-fleet.io/v1beta1
 */
const ResourcePlacement = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1beta1' }],
    kind: 'ResourcePlacement',
    pluralName: 'resourceplacements',
    singularName: 'resourceplacement',
    isNamespaced: true,
  } // namespace-scoped
);

/**
 * ClusterStagedUpdateStrategy defines a staged rollout strategy for fleet updates.
 * API: placement.kubernetes-fleet.io/v1
 */
const ClusterStagedUpdateStrategy = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'ClusterStagedUpdateStrategy',
    pluralName: 'clusterstagedupdatestrategies',
    singularName: 'clusterstagedupdatestrategy',
    isNamespaced: false,
  } // cluster-scoped
);

/**
 * StagedUpdateStrategy defines a namespace-scoped staged rollout strategy.
 * API: placement.kubernetes-fleet.io/v1
 */
const StagedUpdateStrategy = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'StagedUpdateStrategy',
    pluralName: 'stagedupdatestrategies',
    singularName: 'stagedupdatestrategy',
    isNamespaced: true,
  } // namespace-scoped
);

/**
 * ClusterStagedUpdateRun tracks a staged rollout execution across the fleet.
 * API: placement.kubernetes-fleet.io/v1
 */
const ClusterStagedUpdateRun = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'ClusterStagedUpdateRun',
    pluralName: 'clusterstagedupdateruns',
    singularName: 'clusterstagedupdaterun',
    isNamespaced: false,
  } // cluster-scoped
);

/**
 * StagedUpdateRun tracks a staged rollout execution in a namespace.
 * API: placement.kubernetes-fleet.io/v1
 */
const StagedUpdateRun = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'StagedUpdateRun',
    pluralName: 'stagedupdateruns',
    singularName: 'stagedupdaterun',
    isNamespaced: true,
  } // namespace-scoped
);

/**
 * ClusterApprovalRequest represents a pending approval for cluster-scoped staged updates.
 * API: placement.kubernetes-fleet.io/v1
 */
const ClusterApprovalRequest = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'ClusterApprovalRequest',
    pluralName: 'clusterapprovalrequests',
    singularName: 'clusterapprovalrequest',
    isNamespaced: false,
  } // cluster-scoped
);

/**
 * ApprovalRequest represents a pending approval for namespace-scoped staged updates.
 * API: placement.kubernetes-fleet.io/v1
 */
const ApprovalRequest = makeCustomResourceClass(
  {
    apiInfo: [{ group: 'placement.kubernetes-fleet.io', version: 'v1' }],
    kind: 'ApprovalRequest',
    pluralName: 'approvalrequests',
    singularName: 'approvalrequest',
    isNamespaced: true,
  } // namespace-scoped
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

registerSidebarEntry({
  parent: null,
  name: 'fleet',
  label: 'KubeFleet Manager',
  url: '/fleet/member-clusters',
  icon: 'mdi:cargo-ship',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-configuration',
  label: 'Configure Plugin',
  url: '/fleet/configuration',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-member-clusters',
  label: 'Member Clusters',
  url: '/fleet/member-clusters',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-staged-resources',
  label: 'Staged Resources',
  url: '/fleet/staged-resources',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-placement-policies',
  label: 'Resource Placements',
  url: '/fleet/placement-policies',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-resource-overrides',
  label: 'Resource Overrides',
  url: '/fleet/resource-overrides',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-rollout-strategies',
  label: 'Staged Rollout Strategies',
  url: '/fleet/rollout-strategies',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-rollout-runs',
  label: 'Staged Rollout Runs',
  url: '/fleet/rollout-runs',
});

registerSidebarEntry({
  parent: 'fleet',
  name: 'fleet-pending-approvals',
  label: 'Pending Approvals',
  url: '/fleet/pending-approvals',
});

function getStoredHubCluster(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(HUB_CLUSTER_STORAGE_KEY) || '';
}

function persistHubCluster(clusterName: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(HUB_CLUSTER_STORAGE_KEY, clusterName);
}

function FleetConfiguration() {
  return (
    <FleetConfigurationCapability
      getStoredHubCluster={getStoredHubCluster}
      persistHubCluster={persistHubCluster}
    />
  );
}

async function fetchResourceList(
  hubCluster: string,
  pluralName: 'clusterresourceoverrides' | 'resourceoverrides'
): Promise<any[]> {
  const versions = ['v1', 'v1beta1', 'v1alpha1'];

  for (const version of versions) {
    try {
      const response = await ApiProxy.request(
        `/clusters/${encodeURIComponent(
          hubCluster
        )}/apis/placement.kubernetes-fleet.io/${version}/${pluralName}`,
        {},
        false,
        false
      );

      return Array.isArray(response?.items) ? response.items : [];
    } catch (requestError: any) {
      const status = requestError?.status || requestError?.response?.status;
      if (status === 404 || status === 403) {
        continue;
      }

      throw requestError;
    }
  }

  return [];
}

async function fetchResourceOverride(
  hubCluster: string,
  scope: 'cluster' | 'namespace',
  name: string,
  namespace?: string
): Promise<any> {
  const pluralName = scope === 'namespace' ? 'resourceoverrides' : 'clusterresourceoverrides';
  const versions = ['v1', 'v1beta1', 'v1alpha1'];

  for (const version of versions) {
    try {
      const basePath = `/clusters/${encodeURIComponent(
        hubCluster
      )}/apis/placement.kubernetes-fleet.io/${version}`;
      const itemPath =
        scope === 'namespace' && namespace
          ? `${basePath}/namespaces/${encodeURIComponent(
              namespace
            )}/${pluralName}/${encodeURIComponent(name)}`
          : `${basePath}/${pluralName}/${encodeURIComponent(name)}`;
      return await ApiProxy.request(itemPath, {}, false, false);
    } catch (requestError: any) {
      const status = requestError?.status || requestError?.response?.status;
      if (status === 404 || status === 403) {
        continue;
      }
      throw requestError;
    }
  }

  return {};
}

function ResourceOverrideDetails() {
  const {
    scope = '',
    name = '',
    namespace = '',
  } = useParams<{ scope: string; name: string; namespace?: string }>();
  const selectedHubCluster = getStoredHubCluster();
  const [override, setOverride] = useState<any | null>(null);
  const [detailError, setDetailError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    if (!selectedHubCluster) {
      setOverride({});
      return () => {
        mounted = false;
      };
    }

    fetchResourceOverride(
      selectedHubCluster,
      scope === 'namespace' ? 'namespace' : 'cluster',
      name,
      namespace || undefined
    )
      .then(data => {
        if (mounted) {
          setOverride(data);
        }
      })
      .catch((fetchError: any) => {
        if (mounted) {
          setDetailError(fetchError?.message || 'Unable to load resource override.');
          setOverride({});
        }
      });

    return () => {
      mounted = false;
    };
  }, [selectedHubCluster, scope, name, namespace]);

  const title = `Resource Override: ${name}`;

  if (!selectedHubCluster) {
    return (
      <SectionBox title={title}>
        <Typography>
          Configure a hub cluster in KubeFleet Configuration before viewing resource override
          details.
        </Typography>
      </SectionBox>
    );
  }

  if (override === null) {
    return (
      <SectionBox title={title}>
        <Loader title="Loading resource override" />
      </SectionBox>
    );
  }

  if (detailError) {
    return (
      <SectionBox title={title}>
        <Typography color="error">{detailError}</Typography>
      </SectionBox>
    );
  }

  const conditions: any[] = override?.status?.conditions ?? [];
  const rules: any[] = override?.spec?.rules ?? override?.spec?.overrides ?? [];
  const labels = override?.metadata?.labels ?? {};
  const annotations = override?.metadata?.annotations ?? {};

  return (
    <>
      <SectionBox title={title}>
        <SimpleTable
          data={[
            { field: 'Name', value: override?.metadata?.name ?? name },
            { field: 'Kind', value: override?.kind ?? '-' },
            {
              field: 'Scope',
              value:
                scope === 'namespace'
                  ? `Namespace (${override?.metadata?.namespace ?? namespace})`
                  : 'Cluster',
            },
            { field: 'API Version', value: override?.apiVersion ?? '-' },
            { field: 'Created', value: override?.metadata?.creationTimestamp ?? '-' },
            { field: 'Labels', value: formatObjectSummary(labels) },
            { field: 'Annotations', value: formatObjectSummary(annotations) },
          ]}
          columns={[
            { label: 'Field', getter: (row: any) => row.field },
            { label: 'Value', getter: (row: any) => row.value },
          ]}
        />
      </SectionBox>
      <SectionBox title="Override Rules">
        <SimpleTable
          data={rules}
          columns={[
            {
              label: 'Spec',
              getter: (rule: any) => (
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {yaml.dump(rule)}
                </pre>
              ),
            },
          ]}
          emptyMessage="No override rules defined."
        />
      </SectionBox>
      <SectionBox title="Conditions">
        <SimpleTable
          data={conditions}
          columns={[
            { label: 'Type', getter: (c: any) => c?.type ?? '-' },
            { label: 'Status', getter: (c: any) => c?.status ?? '-' },
            { label: 'Reason', getter: (c: any) => c?.reason ?? '-' },
            { label: 'Message', getter: (c: any) => c?.message ?? '-' },
            { label: 'Last Transition', getter: (c: any) => c?.lastTransitionTime ?? '-' },
          ]}
          emptyMessage="No conditions found."
        />
      </SectionBox>
    </>
  );
}

function ResourceOverrides() {
  const selectedHubCluster = getStoredHubCluster();

  return (
    <ResourceOverridesCapability
      selectedHubCluster={selectedHubCluster}
      fetchResourceList={fetchResourceList}
    />
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function MemberClusters() {
  return <MemberClustersCapability memberClusterResourceClass={MemberCluster} />;
}

function StagedResources() {
  return <StagedResourcesCapability />;
}

function StagedResourceDetails() {
  return <StagedResourceDetailsCapability />;
}

function PlacementPolicies() {
  const [clusterPlacements] = ClusterResourcePlacement.useList();
  const [resourcePlacements] = ResourcePlacement.useList();

  return (
    <PlacementPoliciesCapability
      clusterPlacements={clusterPlacements}
      resourcePlacements={resourcePlacements}
      getPlacementScope={getPlacementScope}
      getPlacementPolicyType={getPlacementPolicyType}
      getPlacementStrategyType={getPlacementStrategyType}
    />
  );
}

function getPlacementScope(item: any): 'Cluster' | 'Namespace' {
  return item.getNamespace?.() ? 'Namespace' : 'Cluster';
}

function getPlacementPolicyType(item: any): string {
  const policy = item?.jsonData?.spec?.policy;
  const placementType = policy?.placementType;

  if (typeof placementType === 'string' && placementType.length > 0) {
    return placementType;
  }

  if (policy?.pickAll) {
    return 'PickAll';
  }

  if (policy?.pickN) {
    return 'PickN';
  }

  if (policy?.pickFixed) {
    return 'PickFixed';
  }

  return '-';
}

function getPlacementStrategyType(item: any): 'RollingUpdate' | 'External' {
  const strategy = item?.jsonData?.spec?.strategy;

  if (!strategy) {
    return 'RollingUpdate';
  }

  const strategyType = String(strategy?.type || '').toLowerCase();

  if (strategyType.includes('external') || strategy?.external) {
    return 'External';
  }

  if (strategyType.includes('rolling') || strategy?.rollingUpdate) {
    return 'RollingUpdate';
  }

  return 'RollingUpdate';
}

function formatObjectSummary(data: Record<string, any> | undefined): string {
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return '-';
  }

  return Object.entries(data)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}

function getPlacementStatusDisplay(item: any): {
  label: string;
  status: 'success' | 'warning' | 'error' | '';
  detailedStatus: string;
} {
  const conditions = item?.jsonData?.status?.conditions;
  const detailedStatus = Array.isArray(conditions)
    ? conditions
        .map((condition: any) => {
          const conditionType = condition?.type ?? 'Unknown';
          const conditionStatus = condition?.status ?? '-';
          const reason = condition?.reason ? ` (${condition.reason})` : '';
          const message = condition?.message ? `: ${condition.message}` : '';

          return `${conditionType}=${conditionStatus}${reason}${message}`;
        })
        .join('\n')
    : 'Unknown';

  if (!Array.isArray(conditions) || conditions.length === 0) {
    return { label: '-', status: '', detailedStatus };
  }

  const hasFalse = conditions.some((condition: any) => String(condition?.status) === 'False');
  if (hasFalse) {
    return { label: 'Not Ready', status: 'error', detailedStatus };
  }

  const hasUnknown = conditions.some((condition: any) => String(condition?.status) === 'Unknown');
  if (hasUnknown) {
    return { label: 'Pending', status: 'warning', detailedStatus };
  }

  return { label: 'Ready', status: 'success', detailedStatus };
}

function makePlacementStatusLabel(item: any) {
  const statusDisplay = getPlacementStatusDisplay(item);

  if (statusDisplay.label === '-') {
    return '-';
  }

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <LightTooltip title={statusDisplay.detailedStatus} interactive>
        <Box display="inline">
          <StatusLabel status={statusDisplay.status}>
            {(statusDisplay.status === 'warning' || statusDisplay.status === 'error') && (
              <Icon aria-label="hidden" icon="mdi:alert-outline" width="1.2rem" height="1.2rem" />
            )}
            {statusDisplay.label}
          </StatusLabel>
        </Box>
      </LightTooltip>
    </Box>
  );
}

function ResourcePlacementDetails() {
  return (
    <PlacementPolicyDetailsCapability
      clusterResourcePlacementClass={ClusterResourcePlacement}
      resourcePlacementClass={ResourcePlacement}
      getPlacementPolicyType={getPlacementPolicyType}
      makePlacementStatusLabel={makePlacementStatusLabel}
      formatObjectSummary={formatObjectSummary}
    />
  );
}

function PlacementStatus() {
  return (
    <PlacementStatusCapability
      clusterResourcePlacementClass={ClusterResourcePlacement}
      resourcePlacementClass={ResourcePlacement}
    />
  );
}

function RolloutStrategies() {
  const [clusterStrategies] = ClusterStagedUpdateStrategy.useList();
  const [namespacedStrategies] = StagedUpdateStrategy.useList();

  return (
    <RolloutStrategiesCapability
      clusterStrategies={clusterStrategies}
      namespacedStrategies={namespacedStrategies}
    />
  );
}

function getLabelSelectorMap(stage: any): Record<string, string> | null {
  const matchLabels =
    stage?.labelSelector?.matchLabels ??
    stage?.clusterSelector?.matchLabels ??
    stage?.clusterSelector?.labelSelector?.matchLabels ??
    stage?.placement?.clusterSelector?.matchLabels ??
    stage?.placement?.clusterSelector?.labelSelector?.matchLabels;

  if (!matchLabels || typeof matchLabels !== 'object' || Object.keys(matchLabels).length === 0) {
    return null;
  }
  return matchLabels;
}

function renderLabelSelectorChips(stage: any) {
  const labels = getLabelSelectorMap(stage);
  if (!labels) return <>-</>;
  return (
    <Box display="inline-flex" flexWrap="wrap" gap={0.5} ml={0.5}>
      {Object.entries(labels).map(([key, value]) => (
        <Chip key={key} label={`${key}=${String(value)}`} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

function getTaskType(task: any): string {
  if (typeof task?.type === 'string') {
    return task.type;
  }

  if (task?.approval || task?.Approval) {
    return 'Approval';
  }

  if (task?.timedWait || task?.TimedWait) {
    return 'TimedWait';
  }

  return 'Unknown';
}

function renderTask(task: any, index: number) {
  const taskType = getTaskType(task);
  const taskLabel = task?.name ? `${taskType} – ${task.name}` : taskType;

  if (taskType === 'TimedWait') {
    // Prefer the raw YAML string (e.g. "5m", "30s"); fall back to numeric seconds field.
    const waitTime = task?.timedWait?.waitTime ?? task?.TimedWait?.waitTime ?? task?.waitTime;
    const waitTimeFallback =
      task?.timedWait?.waitTimeSeconds ??
      task?.TimedWait?.waitTimeSeconds ??
      task?.waitTimeSeconds ??
      task?.waitSeconds ??
      task?.durationSeconds;
    const displayValue =
      waitTime !== undefined && waitTime !== null
        ? String(waitTime)
        : waitTimeFallback !== undefined && waitTimeFallback !== null
        ? String(waitTimeFallback)
        : null;

    return (
      <div key={index} style={{ marginLeft: '0.75rem' }}>
        <strong>{taskLabel}</strong>
        {displayValue !== null && (
          <div style={{ marginLeft: '0.75rem' }}>Wait Time: {displayValue}</div>
        )}
      </div>
    );
  }

  return (
    <div key={index} style={{ marginLeft: '0.75rem' }}>
      <strong>{taskLabel}</strong>
    </div>
  );
}

function renderTaskList(tasks: any[] | undefined) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return <span>None</span>;
  }

  return (
    <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.15rem' }}>
      {tasks.map((task, index) => renderTask(task, index))}
    </div>
  );
}

function getStageTasks(stage: any, when: 'before' | 'after'): any[] {
  const candidates =
    when === 'before'
      ? [
          stage?.beforeStageTasks,
          stage?.beforeStageTask,
          stage?.tasks?.beforeStageTasks,
          stage?.tasks?.beforeStageTask,
        ]
      : [
          stage?.afterStageTasks,
          stage?.afterStageTask,
          stage?.tasks?.afterStageTasks,
          stage?.tasks?.afterStageTask,
        ];

  const resolved = candidates.find(Array.isArray);
  return Array.isArray(resolved) ? resolved : [];
}

function normalizeStrategyStages(stages: any[] | undefined): any[] {
  if (!Array.isArray(stages)) {
    return [];
  }

  return stages.map(stage => ({
    ...stage,
    beforeStageTasks: getStageTasks(stage, 'before'),
    afterStageTasks: getStageTasks(stage, 'after'),
  }));
}

function formatMaxConcurrency(stage: any): string {
  const maxConcurrency = stage?.maxConcurrency;
  if (maxConcurrency === undefined || maxConcurrency === null) {
    return 'None';
  }

  return String(maxConcurrency);
}

function getRolloutRunStatusDisplay(item: any): {
  label: string;
  status: 'success' | 'warning' | 'error' | '';
  detailedStatus: string;
} {
  const conditions = item?.jsonData?.status?.conditions;
  const lastCondition =
    Array.isArray(conditions) && conditions.length > 0 ? conditions.at(-1) : null;

  if (
    String(lastCondition?.reason ?? '') === 'UpdateRunSucceeded' &&
    String(lastCondition?.type ?? '') === 'Succeeded' &&
    String(lastCondition?.status ?? '') === 'True'
  ) {
    const message = lastCondition?.message ?? 'All stages are completed successfully';

    return {
      label: 'Completed',
      status: 'success',
      detailedStatus: message,
    };
  }

  if (
    String(lastCondition?.reason ?? '') === 'UpdateRunWaiting' &&
    String(lastCondition?.type ?? '') === 'Progressing' &&
    String(lastCondition?.status ?? '') === 'False'
  ) {
    const message = lastCondition?.message ?? 'Update run is waiting';

    return {
      label: 'Waiting',
      status: 'warning',
      detailedStatus: message,
    };
  }

  if (
    String(lastCondition?.reason ?? '') === 'UpdateRunStopped' &&
    String(lastCondition?.type ?? '') === 'Progressing' &&
    String(lastCondition?.status ?? '') === 'False'
  ) {
    const reason = lastCondition?.reason ? ` (${lastCondition.reason})` : '';
    const message = lastCondition?.message ? `: ${lastCondition.message}` : '';

    return {
      label: 'User stopped',
      status: 'warning',
      detailedStatus: `UpdateRunStopped=${lastCondition?.status ?? '-'}${reason}${message}`,
    };
  }

  if (
    String(lastCondition?.reason ?? '') === 'UpdateRunStuck' &&
    String(lastCondition?.type ?? '') === 'Progressing' &&
    String(lastCondition?.status ?? '') === 'False'
  ) {
    const message = lastCondition?.message ?? 'Update run is blocked';

    return {
      label: 'Blocked',
      status: 'error',
      detailedStatus: message,
    };
  }

  const initializedCondition = Array.isArray(conditions)
    ? conditions.find((condition: any) => condition?.type === 'Initialized')
    : null;

  if (initializedCondition) {
    const initializedStatus = String(initializedCondition?.status ?? '').toLowerCase();
    const reason = initializedCondition?.reason ? ` (${initializedCondition.reason})` : '';
    const message = initializedCondition?.message ? `: ${initializedCondition.message}` : '';
    const detailedStatus = `Initialized=${initializedCondition?.status ?? '-'}${reason}${message}`;

    if (initializedStatus === 'true') {
      return {
        label: 'Intialized OK',
        status: 'success',
        detailedStatus,
      };
    }

    if (initializedStatus === 'false') {
      return {
        label: 'Not Initialized',
        status: 'error',
        detailedStatus,
      };
    }
  }

  const rawStatus = String(item?.jsonData?.spec?.State ?? item?.jsonData?.spec?.state ?? '').trim();
  const normalizedStatus = rawStatus.toLowerCase();
  const detailedStatus = Array.isArray(conditions)
    ? conditions
        .map((condition: any) => {
          const conditionType = condition?.type ?? 'Unknown';
          const conditionStatus = condition?.status ?? '-';
          const reason = condition?.reason ? ` (${condition.reason})` : '';
          const message = condition?.message ? `: ${condition.message}` : '';

          return `${conditionType}=${conditionStatus}${reason}${message}`;
        })
        .join('\n')
    : rawStatus || 'Unknown';

  if (normalizedStatus === 'initialized') {
    return { label: 'Created', status: 'success', detailedStatus };
  }

  if (normalizedStatus === 'run') {
    return { label: 'Running', status: 'success', detailedStatus };
  }

  if (normalizedStatus === 'stop') {
    return { label: 'Stopped', status: 'warning', detailedStatus };
  }

  return {
    label: rawStatus || '-',
    status: rawStatus ? 'error' : '',
    detailedStatus,
  };
}

function makeRolloutRunStatusLabel(item: any) {
  const statusDisplay = getRolloutRunStatusDisplay(item);

  if (statusDisplay.label === '-') {
    return '-';
  }

  const isWaiting = statusDisplay.label === 'Waiting';
  const isBlocked = statusDisplay.label === 'Blocked';

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <LightTooltip title={statusDisplay.detailedStatus} interactive>
        <Box display="inline">
          {isWaiting ? (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                px: '8px',
                py: '4px',
                borderRadius: '4px',
                border: '1px solid transparent',
                backgroundColor: '#e65100',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              <Icon aria-label="hidden" icon="mdi:timer-sand" width="1.1rem" height="1.1rem" />
              Waiting
            </Box>
          ) : isBlocked ? (
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                px: '8px',
                py: '4px',
                borderRadius: '4px',
                border: '1px solid transparent',
                backgroundColor: '#e65100',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              <Icon aria-label="hidden" icon="mdi:alert" width="1.1rem" height="1.1rem" />
              Blocked
            </Box>
          ) : (
            <StatusLabel status={statusDisplay.status}>
              {(statusDisplay.status === 'warning' || statusDisplay.status === 'error') && (
                <Icon aria-label="hidden" icon="mdi:alert-outline" width="1.2rem" height="1.2rem" />
              )}
              {statusDisplay.label}
            </StatusLabel>
          )}
        </Box>
      </LightTooltip>
    </Box>
  );
}

function getRolloutRunScope(item: any): 'Cluster' | 'Namespace' {
  return item.getNamespace?.() ? 'Namespace' : 'Cluster';
}

function getRolloutRunApiPath(item: any): string {
  const apiVersion = String(item?.jsonData?.apiVersion ?? 'placement.kubernetes-fleet.io/v1');
  const [group, version] = apiVersion.includes('/')
    ? apiVersion.split('/', 2)
    : ['placement.kubernetes-fleet.io', apiVersion];
  const name = item?.getName?.();
  const namespace = item?.getNamespace?.();
  const pluralName = namespace ? 'stagedupdateruns' : 'clusterstagedupdateruns';
  const basePath = `/apis/${group}/${version}`;

  return namespace
    ? `${basePath}/namespaces/${encodeURIComponent(namespace)}/${pluralName}/${encodeURIComponent(
        name
      )}`
    : `${basePath}/${pluralName}/${encodeURIComponent(name)}`;
}

function getRolloutRunStatusApiPath(item: any): string {
  return `${getRolloutRunApiPath(item)}/status`;
}

/**
 * Returns the stage name and approval-request resource name when the run's
 * current stage is blocked waiting for an Approval task whose request has
 * been created (beforeStageTaskStatus condition type=ApprovalRequestCreated,
 * status='True').
 */
function getApprovalWaitingStage(
  item: any
): { stageName: string; approvalRequestName: string } | null {
  const parsed = parseStagesStatus(getStagesStatusArray(item));
  for (const stage of parsed) {
    if (stage.stageStatus === 'waiting' && stage.waitingFor === 'Approval') {
      if (stage.approvalRequestName) {
        return { stageName: stage.stageName, approvalRequestName: stage.approvalRequestName };
      }
      // Fallback naming convention: {runName}-{stageName}
      const runName: string = item?.getName?.() ?? '';
      const name = stage.stageName ? `${runName}-${stage.stageName}` : runName;
      return { stageName: stage.stageName, approvalRequestName: name };
    }
  }
  return null;
}

async function approveStageRun(item: any, message?: string): Promise<void> {
  const approvalInfo = getApprovalWaitingStage(item);
  if (!approvalInfo) {
    throw new Error('No stage is currently waiting for approval.');
  }
  await approveStageByName(item, approvalInfo.stageName, approvalInfo.approvalRequestName, message);
}

async function approveStageByName(
  item: any,
  stageName: string,
  approvalRequestName: string,
  message?: string
): Promise<void> {
  const namespace = item?.getNamespace?.();
  const cluster = item?.cluster ?? null;
  const plural = namespace ? 'approvalrequests' : 'clusterapprovalrequests';
  const basePath = `/apis/placement.kubernetes-fleet.io/v1`;
  const resourcePath = namespace
    ? `${basePath}/namespaces/${encodeURIComponent(namespace)}/${plural}/${encodeURIComponent(
        approvalRequestName
      )}`
    : `${basePath}/${plural}/${encodeURIComponent(approvalRequestName)}`;
  const statusPath = `${resourcePath}/status`;

  const lastTransitionTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const conditionMessage = message?.trim() || 'ApprovedByUser';
  const patchBody = {
    status: {
      conditions: [
        {
          lastTransitionTime,
          message: conditionMessage,
          observedGeneration: 1,
          reason: 'ApprovedByUser',
          status: 'True',
          type: 'Approved',
        },
      ],
    },
  };

  console.info('Fleet Stage Approve action patching approval request status', {
    stage: stageName,
    approvalRequest: approvalRequestName,
    cluster,
    path: statusPath,
    patchBody,
  });

  await ApiProxy.request(statusPath, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    cluster,
    body: JSON.stringify(patchBody),
  });

  console.info('Fleet Stage Approve action patch succeeded', {
    stage: stageName,
    approvalRequest: approvalRequestName,
    cluster,
    path: statusPath,
  });
}

async function updateStagedUpdateRunState(
  item: any,
  stageName: string,
  nextState: 'Run' | 'Stop'
): Promise<void> {
  const patchBody = {
    spec: {
      State: nextState,
      state: nextState,
      stageName,
    },
  };

  if (typeof item?.patch === 'function') {
    try {
      await item.patch(patchBody);
      return;
    } catch {
      // Fall through to explicit API call.
    }
  }

  await ApiProxy.request(getRolloutRunApiPath(item), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    cluster: item?.cluster ?? null,
    body: JSON.stringify(patchBody),
  });
}

async function updateRolloutRunState(item: any, nextState: 'Run' | 'Stop'): Promise<void> {
  const patchBody = {
    spec: {
      State: nextState,
      state: nextState,
    },
  };

  if (typeof item?.patch === 'function') {
    await item.patch(patchBody);
    return;
  }

  await ApiProxy.request(getRolloutRunApiPath(item), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/merge-patch+json',
    },
    body: JSON.stringify(patchBody),
  });
}

// ─── Stage Status Parsing Types ───────────────────────────────────────────────

/** Standard Kubernetes condition. */
interface KubeConditionEntry {
  type: string;
  status: string;
  reason: string;
  message: string;
  lastTransitionTime: string;
  observedGeneration?: number;
}

/** A task entry in beforeStageTaskStatus or afterStageTaskStatus. */
interface StageTaskStatus {
  type: 'Approval' | 'TimedWait';
  approvalRequestName?: string;
  conditions: KubeConditionEntry[];
}

/** A cluster entry inside a stage. */
interface StageClusterStatus {
  clusterName: string;
  conditions: KubeConditionEntry[];
  state: 'in-progress' | 'completed' | 'failed' | 'pending';
}

/** A fully parsed stage from status.stagesStatus. */
interface ParsedStageStatus {
  stageName: string;
  startTime: string;
  endTime: string;
  conditions: KubeConditionEntry[];
  clusters: StageClusterStatus[];
  beforeStageTaskStatus: StageTaskStatus[];
  afterStageTaskStatus: StageTaskStatus[];
  stageStatus: 'succeeded' | 'stopped' | 'waiting' | 'progressing' | 'pending';
  stageStatusMessage: string;
  waitingFor: 'Approval' | 'TimedWait' | '';
  approvalRequestName: string;
  isProgressing: boolean;
}

// ─── Condition Helpers ────────────────────────────────────────────────────────

function parseConditions(raw: any): KubeConditionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c: any) => c && typeof c === 'object')
    .map((c: any) => ({
      type: String(c.type ?? ''),
      status: String(c.status ?? ''),
      reason: String(c.reason ?? ''),
      message: String(c.message ?? ''),
      lastTransitionTime: String(c.lastTransitionTime ?? ''),
      ...(c.observedGeneration !== undefined
        ? { observedGeneration: Number(c.observedGeneration) }
        : {}),
    }));
}

function findCondition(
  conditions: KubeConditionEntry[],
  type: string
): KubeConditionEntry | undefined {
  return conditions.find(c => c.type === type);
}

function lastCondition(conditions: KubeConditionEntry[]): KubeConditionEntry | undefined {
  return conditions.length > 0 ? conditions[conditions.length - 1] : undefined;
}

// ─── Task Parsing ─────────────────────────────────────────────────────────────

function parseTaskStatusArray(raw: any): StageTaskStatus[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t: any) => t && typeof t === 'object')
    .map((t: any) => ({
      type: String(t.type ?? '') as StageTaskStatus['type'],
      ...(t.approvalRequestName ? { approvalRequestName: String(t.approvalRequestName) } : {}),
      conditions: parseConditions(t.conditions),
    }));
}

// ─── Cluster State ────────────────────────────────────────────────────────────

function deriveClusterState(
  conditions: KubeConditionEntry[]
): 'in-progress' | 'completed' | 'failed' | 'pending' {
  // Check explicit Succeeded condition first
  const succeeded = findCondition(conditions, 'Succeeded');
  if (succeeded && succeeded.status === 'True') return 'completed';

  // Fleet uses ClusterUpdatingCondition with reason to indicate state
  const updating = findCondition(conditions, 'ClusterUpdatingCondition');
  if (updating) {
    if (updating.status === 'True' && /succeeded/i.test(updating.reason)) return 'completed';
    if (/failed/i.test(updating.reason)) return 'failed';
    // status=True with a non-succeeded/non-failed reason means in-progress
    if (updating.status === 'True') return 'in-progress';
    // status=False typically means not yet started or waiting
    return 'in-progress';
  }

  const started = findCondition(conditions, 'Started');
  if (started && started.status === 'True') {
    const last = lastCondition(conditions);
    if (last && /failed/i.test(last.reason)) return 'failed';
    return 'in-progress';
  }

  // Fall back to last condition
  const last = lastCondition(conditions);
  if (last) {
    if (/succeeded/i.test(last.reason) && last.status === 'True') return 'completed';
    if (/failed/i.test(last.reason)) return 'failed';
    // Any condition present means the cluster has been touched
    return 'in-progress';
  }

  return 'pending';
}

// ─── Stage Status Derivation ──────────────────────────────────────────────────

function deriveStageStatus(
  conditions: KubeConditionEntry[],
  beforeTasks: StageTaskStatus[],
  afterTasks: StageTaskStatus[]
): {
  stageStatus: ParsedStageStatus['stageStatus'];
  stageStatusMessage: string;
  waitingFor: 'Approval' | 'TimedWait' | '';
  approvalRequestName: string;
  isProgressing: boolean;
} {
  const last = lastCondition(conditions);

  // Succeeded
  const succeeded = findCondition(conditions, 'Succeeded');
  if (succeeded && succeeded.status === 'True' && succeeded.reason === 'StageUpdatingSucceeded') {
    return {
      stageStatus: 'succeeded',
      stageStatusMessage: succeeded.message || 'Stage update completed successfully',
      waitingFor: '',
      approvalRequestName: '',
      isProgressing: false,
    };
  }

  // Stopped
  if (last && last.reason === 'StageUpdatingStopped') {
    return {
      stageStatus: 'stopped',
      stageStatusMessage: last.message || 'Stage update stopped',
      waitingFor: '',
      approvalRequestName: '',
      isProgressing: false,
    };
  }

  // Waiting
  if (last && last.reason === 'StageUpdatingWaiting' && last.status === 'False') {
    // Determine what we are waiting for by inspecting task status
    let waitingFor: 'Approval' | 'TimedWait' | '' = '';
    let approvalRequestName = '';

    // Check before-stage tasks first
    for (const task of beforeTasks) {
      if (task.type === 'Approval') {
        const created = findCondition(task.conditions, 'ApprovalRequestCreated');
        if (created && created.status === 'True') {
          waitingFor = 'Approval';
          approvalRequestName = task.approvalRequestName ?? '';
          break;
        }
      }
      if (task.type === 'TimedWait') {
        const elapsed = findCondition(task.conditions, 'WaitTimeElapsed');
        if (!elapsed || elapsed.status !== 'True') {
          waitingFor = 'TimedWait';
          break;
        }
      }
    }

    // Check after-stage tasks for approval or timed wait
    if (!waitingFor) {
      for (const task of afterTasks) {
        if (task.type === 'Approval') {
          const created = findCondition(task.conditions, 'ApprovalRequestCreated');
          if (created && created.status === 'True') {
            waitingFor = 'Approval';
            approvalRequestName = task.approvalRequestName ?? '';
            break;
          }
        }
        if (task.type === 'TimedWait') {
          const elapsed = findCondition(task.conditions, 'WaitTimeElapsed');
          if (!elapsed || elapsed.status !== 'True') {
            waitingFor = 'TimedWait';
            break;
          }
        }
      }
    }

    // Fall back to message text
    if (!waitingFor) {
      const lc = last.message.toLowerCase();
      if (lc.includes('approval')) waitingFor = 'Approval';
      else if (lc.includes('timed') || lc.includes('wait')) waitingFor = 'TimedWait';
    }

    return {
      stageStatus: 'waiting',
      stageStatusMessage: last.message || 'Stage is waiting',
      waitingFor,
      approvalRequestName,
      isProgressing: false,
    };
  }

  // Progressing (Progressing condition with status=True or status=False with non-waiting reason)
  const progressing = findCondition(conditions, 'Progressing');
  if (progressing) {
    return {
      stageStatus: 'progressing',
      stageStatusMessage: progressing.message || '',
      waitingFor: '',
      approvalRequestName: '',
      isProgressing: true,
    };
  }

  // No conditions at all — stage hasn't started yet
  return {
    stageStatus: 'pending',
    stageStatusMessage: '',
    waitingFor: '',
    approvalRequestName: '',
    isProgressing: false,
  };
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

function parseStagesStatus(rawStagesStatus: any): ParsedStageStatus[] {
  if (!Array.isArray(rawStagesStatus)) return [];

  return rawStagesStatus
    .filter((s: any) => s && typeof s === 'object')
    .map((stage: any, index: number) => {
      const stageName = String(stage.stageName ?? stage.name ?? `Stage ${index + 1}`);
      const conditions = parseConditions(stage.conditions);
      const beforeStageTaskStatus = parseTaskStatusArray(stage.beforeStageTaskStatus);
      const afterStageTaskStatus = parseTaskStatusArray(stage.afterStageTaskStatus);

      const rawClusters: any[] = Array.isArray(stage.clusters) ? stage.clusters : [];
      const clusters: StageClusterStatus[] = rawClusters
        .filter((c: any) => c && typeof c === 'object' && c.clusterName)
        .map((c: any) => {
          const clusterConditions = parseConditions(c.conditions);
          return {
            clusterName: String(c.clusterName),
            conditions: clusterConditions,
            state: deriveClusterState(clusterConditions),
          };
        });

      const derived = deriveStageStatus(conditions, beforeStageTaskStatus, afterStageTaskStatus);

      return {
        stageName,
        startTime: String(stage.startTime ?? ''),
        endTime: String(stage.endTime ?? ''),
        conditions,
        clusters,
        beforeStageTaskStatus,
        afterStageTaskStatus,
        ...derived,
      };
    });
}

// ─── Stage status rows for the details table ──────────────────────────────────

type StageStatusRow = {
  id: string;
  stageName: string;
  selectedClusters: string[];
  clusterStates: Record<string, 'in-progress' | 'completed' | 'failed' | 'unknown'>;
  isProgressing: boolean;
  stageStatus: 'stopped' | 'completed' | 'waiting' | '';
  stageStatusMessage: string;
  waitingFor: 'Approval' | 'TimedWait' | '';
  approvalRequestName: string;
  parsed: ParsedStageStatus;
};

function getStagesStatusArray(item: any): any[] {
  const status = item?.jsonData?.status ?? {};
  return (
    status?.stagesStatus ??
    status?.stageStatuses ??
    status?.stages ??
    status?.runStatus?.stagesStatus ??
    status?.runStatus?.stageStatuses ??
    []
  );
}

function getCurrentStageName(item: any): string {
  const status = item?.jsonData?.status ?? {};
  const parsed = parseStagesStatus(getStagesStatusArray(item));

  if (parsed.length === 0) return status?.stageName ?? '-';

  // Walk from the end; the highest-index stage with conditions is the current one.
  for (let i = parsed.length - 1; i >= 0; i--) {
    if (parsed[i].conditions.length > 0) return parsed[i].stageName;
  }

  return status?.stageName ?? parsed[0]?.stageName ?? '-';
}

function getStageStatusRows(item: any): StageStatusRow[] {
  const parsed = parseStagesStatus(getStagesStatusArray(item));

  return parsed.map((stage, index) => {
    const clusterStates: Record<string, 'in-progress' | 'completed' | 'failed' | 'unknown'> = {};
    const clusterNames: string[] = [];

    stage.clusters.forEach(c => {
      clusterNames.push(c.clusterName);
      clusterStates[c.clusterName] =
        c.state === 'pending' ? 'unknown' : (c.state as 'in-progress' | 'completed' | 'failed');
    });

    // Map parsed stageStatus to the table row's status enum
    let stageStatus: StageStatusRow['stageStatus'] = '';
    if (stage.stageStatus === 'succeeded') stageStatus = 'completed';
    else if (stage.stageStatus === 'stopped') stageStatus = 'stopped';
    else if (stage.stageStatus === 'waiting') stageStatus = 'waiting';

    return {
      id: `${stage.stageName}-${index}`,
      stageName: stage.stageName,
      selectedClusters: clusterNames,
      clusterStates,
      isProgressing: stage.isProgressing,
      stageStatus,
      stageStatusMessage: stage.stageStatusMessage,
      waitingFor: stageStatus === 'waiting' ? stage.waitingFor : '',
      approvalRequestName: stage.approvalRequestName,
      parsed: stage,
    };
  });
}

function RolloutRunDetails() {
  return (
    <RolloutRunDetailsCapability
      stagedUpdateRunClass={StagedUpdateRun}
      clusterStagedUpdateRunClass={ClusterStagedUpdateRun}
      getRolloutRunScope={getRolloutRunScope}
      getCurrentStageName={getCurrentStageName}
      getRolloutRunStatusDisplay={getRolloutRunStatusDisplay}
      makeRolloutRunStatusLabel={makeRolloutRunStatusLabel}
      formatObjectSummary={formatObjectSummary}
      getStageStatusRows={getStageStatusRows}
      updateStagedUpdateRunState={updateStagedUpdateRunState}
      approveStageByName={approveStageByName}
    />
  );
}

function RolloutStrategyDetails() {
  const {
    scope = 'cluster',
    strategyName = '',
    namespace = '',
  } = useParams<{ scope?: string; strategyName: string; namespace?: string }>();
  const [clusterStrategies] = ClusterStagedUpdateStrategy.useList();
  const [namespacedStrategies] = StagedUpdateStrategy.useList();
  const isNamespaceScope = scope === 'namespace';

  const strategy = isNamespaceScope
    ? namespacedStrategies?.find(
        item => item.getName?.() === strategyName && item.getNamespace?.() === namespace
      )
    : clusterStrategies?.find(item => item.getName?.() === strategyName);

  const isLoading = isNamespaceScope ? !namespacedStrategies : !clusterStrategies;
  if (isLoading) {
    return (
      <SectionBox title={`Rollout Strategy: ${strategyName}`}>
        <Loader title="Loading strategy details" />
      </SectionBox>
    );
  }

  if (!strategy) {
    return (
      <SectionBox title={`Rollout Strategy: ${strategyName}`}>
        <div>
          Unable to load strategy details for{' '}
          {isNamespaceScope ? `namespace ${namespace}` : 'cluster'}.
        </div>
      </SectionBox>
    );
  }

  const strategyData = strategy?.jsonData;
  const stages = normalizeStrategyStages(strategyData?.spec?.stages);

  return (
    <SectionBox title={`Rollout Strategy: ${strategyName}`}>
      <div style={{ marginBottom: '1rem', opacity: 0.85 }}>
        Visual sequence of rollout stages, including cluster selectors, stage tasks, and concurrency
        limits.
      </div>

      {stages.length === 0 ? (
        <div>No stages are defined for this strategy.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {stages.map((stage, index) => (
            <div key={stage?.name ?? `stage-${index}`}>
              {index > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '4px 0',
                  }}
                >
                  <Icon icon="mdi:arrow-down" width="1.5rem" height="1.5rem" color="#90a4ae" />
                </div>
              )}
              <div
                style={{
                  border: '1px solid rgba(127,127,127,0.35)',
                  borderRadius: '8px',
                  background: 'rgba(127,127,127,0.06)',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    padding: '0.6rem 0.45rem',
                    background: 'rgba(25, 118, 210, 0.08)',
                    borderRight: '1px solid rgba(127,127,127,0.2)',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    letterSpacing: '0.25em',
                    color: '#1976d2',
                    textTransform: 'uppercase',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  STAGE
                </div>
                <div style={{ padding: '0.9rem', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      marginBottom: '0.6rem',
                    }}
                  >
                    <div
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '50%',
                        background: '#1976d2',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </div>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {stage?.name ?? 'Unnamed stage'}
                    </Typography>
                  </div>
                  <div style={{ display: 'grid', gap: '0.35rem', paddingLeft: '2.6rem' }}>
                    <div>
                      <strong>Cluster Selector Labels:</strong> {renderLabelSelectorChips(stage)}
                    </div>
                    <div>
                      <strong>Sorting Label Key:</strong> {stage?.sortingLabelKey ?? 'none'}
                    </div>
                    <div>
                      <strong>Before Stage Tasks:</strong> {renderTaskList(stage?.beforeStageTasks)}
                    </div>
                    <div>
                      <strong>After Stage Tasks:</strong> {renderTaskList(stage?.afterStageTasks)}
                    </div>
                    <div>
                      <strong>Max Concurrency:</strong> {formatMaxConcurrency(stage)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionBox>
  );
}

function RolloutRuns() {
  const [clusterRolloutRuns] = ClusterStagedUpdateRun.useList();
  const [rolloutRuns] = StagedUpdateRun.useList();
  const hubCluster = getStoredHubCluster();

  return (
    <RolloutRunsCapability
      clusterRolloutRuns={clusterRolloutRuns}
      rolloutRuns={rolloutRuns}
      createFormProps={{
        clusterResourcePlacementClass: ClusterResourcePlacement,
        resourcePlacementClass: ResourcePlacement,
        clusterStagedUpdateStrategyClass: ClusterStagedUpdateStrategy,
        stagedUpdateStrategyClass: StagedUpdateStrategy,
        hubCluster,
      }}
      getRolloutRunScope={getRolloutRunScope}
      getCurrentStageName={getCurrentStageName}
      getRolloutRunStatusDisplay={getRolloutRunStatusDisplay}
      makeRolloutRunStatusLabel={makeRolloutRunStatusLabel}
      getStageStatusRows={getStageStatusRows}
      updateRolloutRunState={updateRolloutRunState}
      approveStageRun={approveStageRun}
      getApprovalWaitingStage={getApprovalWaitingStage}
      getRolloutRunStatusApiPath={getRolloutRunStatusApiPath}
    />
  );
}

function PendingApprovals() {
  const [clusterApprovalRequests] = ClusterApprovalRequest.useList();
  const [approvalRequests] = ApprovalRequest.useList();

  return (
    <PendingApprovalsCapability
      clusterApprovalRequests={clusterApprovalRequests}
      approvalRequests={approvalRequests}
    />
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────

registerRoute({
  path: '/fleet/member-clusters',
  sidebar: 'fleet-member-clusters',
  name: 'fleet-member-clusters',
  exact: true,
  component: MemberClusters,
});

registerRoute({
  path: '/fleet/configuration',
  sidebar: 'fleet-configuration',
  name: 'fleet-configuration',
  exact: true,
  component: FleetConfiguration,
});

registerRoute({
  path: '/fleet/resource-overrides',
  sidebar: 'fleet-resource-overrides',
  name: 'fleet-resource-overrides',
  exact: true,
  component: ResourceOverrides,
});

registerRoute({
  path: '/fleet/resource-overrides/details/:scope/:name',
  sidebar: 'fleet-resource-overrides',
  name: 'fleet-resource-override-details-cluster',
  exact: true,
  component: ResourceOverrideDetails,
});

registerRoute({
  path: '/fleet/resource-overrides/details/:scope/:namespace/:name',
  sidebar: 'fleet-resource-overrides',
  name: 'fleet-resource-override-details-namespace',
  exact: true,
  component: ResourceOverrideDetails,
});

registerRoute({
  path: '/fleet/staged-resources',
  sidebar: 'fleet-staged-resources',
  name: 'fleet-staged-resources',
  exact: true,
  component: StagedResources,
});

registerRoute({
  path: '/fleet/staged-resources/:namespace',
  sidebar: 'fleet-staged-resources',
  name: 'fleet-staged-resource-details',
  exact: true,
  component: StagedResourceDetails,
});

registerRoute({
  path: '/fleet/placement-policies',
  sidebar: 'fleet-placement-policies',
  name: 'fleet-placement-policies',
  exact: true,
  component: PlacementPolicies,
});

registerRoute({
  path: '/fleet/placement-policies/:scope/:placementName',
  sidebar: 'fleet-placement-policies',
  name: 'fleet-placement-policy-details-cluster',
  exact: true,
  component: ResourcePlacementDetails,
});

registerRoute({
  path: '/fleet/placement-policies/:scope/:placementName/status',
  sidebar: 'fleet-placement-policies',
  name: 'fleet-placement-status-cluster',
  exact: true,
  component: PlacementStatus,
});

registerRoute({
  path: '/fleet/placement-policies/:scope/:namespace/:placementName/status',
  sidebar: 'fleet-placement-policies',
  name: 'fleet-placement-status-namespace',
  exact: true,
  component: PlacementStatus,
});

registerRoute({
  path: '/fleet/placement-policies/:scope/:namespace/:placementName',
  sidebar: 'fleet-placement-policies',
  name: 'fleet-placement-policy-details-namespace',
  exact: true,
  component: ResourcePlacementDetails,
});

registerRoute({
  path: '/fleet/rollout-strategies',
  sidebar: 'fleet-rollout-strategies',
  name: 'fleet-rollout-strategies',
  exact: true,
  component: RolloutStrategies,
});

registerRoute({
  path: '/fleet/rollout-strategies/:strategyName',
  sidebar: 'fleet-rollout-strategies',
  name: 'fleet-rollout-strategy-details',
  exact: true,
  component: RolloutStrategyDetails,
});

registerRoute({
  path: '/fleet/rollout-strategies/:scope/:strategyName',
  sidebar: 'fleet-rollout-strategies',
  name: 'fleet-rollout-strategy-details-cluster',
  exact: true,
  component: RolloutStrategyDetails,
});

registerRoute({
  path: '/fleet/rollout-strategies/:scope/:namespace/:strategyName',
  sidebar: 'fleet-rollout-strategies',
  name: 'fleet-rollout-strategy-details-namespace',
  exact: true,
  component: RolloutStrategyDetails,
});

registerRoute({
  path: '/fleet/rollout-runs',
  sidebar: 'fleet-rollout-runs',
  name: 'fleet-rollout-runs',
  exact: true,
  component: RolloutRuns,
});

registerRoute({
  path: '/fleet/rollout-runs/:scope/:runName',
  sidebar: 'fleet-rollout-runs',
  name: 'fleet-rollout-run-details-cluster',
  exact: true,
  component: RolloutRunDetails,
});

registerRoute({
  path: '/fleet/rollout-runs/:scope/:namespace/:runName',
  sidebar: 'fleet-rollout-runs',
  name: 'fleet-rollout-run-details-namespace',
  exact: true,
  component: RolloutRunDetails,
});

registerRoute({
  path: '/fleet/pending-approvals',
  sidebar: 'fleet-pending-approvals',
  name: 'fleet-pending-approvals',
  exact: true,
  component: PendingApprovals,
});
