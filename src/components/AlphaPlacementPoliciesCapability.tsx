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

import {
  DateLabel,
  Link,
  Loader,
  ResourceListView,
  SectionBox,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import * as yaml from 'js-yaml';
import { useParams } from 'react-router-dom';
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
  PlacementCondition,
  PlacementPolicy,
  PlacementPolicyData,
  POLICY_CONDITIONS,
  StatusDisplay,
} from '../alphaPlacement';

type Props = { hubCluster: string };

function Status({ display }: { display: StatusDisplay }) {
  return (
    <Tooltip title={display.message}>
      <Box component="span">
        <StatusLabel status={display.status}>{display.label}</StatusLabel>
      </Box>
    </Tooltip>
  );
}

function Yaml({ value }: { value: unknown }) {
  return (
    <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {yaml.dump(value, { noRefs: true, lineWidth: -1 }).trim()}
    </Box>
  );
}

function ConfigureHub() {
  return (
    <SectionBox title="Placement Policies (Alpha)">
      <Typography>
        Select a hub cluster in <Link routeName="fleet-configuration">Configure Plugin</Link> first.
      </Typography>
    </SectionBox>
  );
}

function PolicyList({ hubCluster }: Props) {
  const [clusterPolicies, clusterError] = ClusterPlacementPolicy.useList({ cluster: hubCluster });
  const [policies, policyError] = PlacementPolicy.useList({ cluster: hubCluster });

  return (
    <SectionBox title="Placement Policies (Alpha)">
      <Typography variant="body2" sx={{ mb: 2 }}>
        Read-only view of placement.kubefleet.dev/v1alpha1 on hub {hubCluster}. Annotation-based
        placement generates these policies; their specs are controller-managed. Older CRP/RP
        resources remain under Resource Placements.
      </Typography>
      {clusterError && (
        <Typography role="alert" color="error">
          {formatApiError(clusterError, 'ClusterPlacementPolicies')}
        </Typography>
      )}
      {policyError && (
        <Typography role="alert" color="error">
          {formatApiError(policyError, 'PlacementPolicies')}
        </Typography>
      )}
      {!clusterError && !policyError && (
        <ResourceListView
          title={<></>}
          headerProps={{ titleSideActions: [] }}
          data={clusterPolicies && policies ? [...clusterPolicies, ...policies] : null}
          enableRowActions={false}
          enableRowSelection={false}
          actions={[]}
          columns={[
            {
              label: 'Name',
              getValue: (item: PlacementPolicy) => item.getName(),
              render: (item: PlacementPolicy) => {
                const namespace = item.getNamespace();
                return (
                  <Link
                    routeName={
                      namespace
                        ? 'fleet-alpha-placement-policy-namespace'
                        : 'fleet-alpha-placement-policy-cluster'
                    }
                    params={
                      namespace
                        ? { namespace, policyName: item.getName() }
                        : { policyName: item.getName() }
                    }
                    activeCluster={hubCluster}
                  >
                    {item.getName()}
                  </Link>
                );
              },
            },
            { label: 'Kind', getValue: (item: PlacementPolicy) => item.jsonData.kind },
            {
              label: 'Namespace',
              getValue: (item: PlacementPolicy) => item.getNamespace() || 'Cluster-scoped',
            },
            {
              label: 'Source',
              getValue: (item: PlacementPolicy) =>
                getGeneratedSource(item.jsonData) || 'Manually authored',
            },
            {
              label: 'Status',
              getValue: (item: PlacementPolicy) => getPolicyStatus(item.jsonData).label,
              render: (item: PlacementPolicy) => (
                <Status display={getPolicyStatus(item.jsonData)} />
              ),
            },
            {
              label: 'Scheduled / Desired',
              getValue: (item: PlacementPolicy) =>
                formatCounts(
                  item.jsonData.status?.scheduledClusters,
                  item.jsonData.status?.desiredClusters
                ),
            },
            {
              label: 'Synchronized / Desired',
              getValue: (item: PlacementPolicy) =>
                formatCounts(
                  item.jsonData.status?.synchronizedClusters,
                  item.jsonData.status?.desiredClusters
                ),
            },
            {
              label: 'Available / Desired',
              getValue: (item: PlacementPolicy) =>
                formatCounts(
                  item.jsonData.status?.resourcesAvailableClusters,
                  item.jsonData.status?.desiredClusters
                ),
            },
            {
              label: 'Age',
              getValue: (item: PlacementPolicy) => item.getCreationTs(),
              render: (item: PlacementPolicy) => (
                <DateLabel date={item.getCreationTs()} format="mini" />
              ),
            },
          ]}
        />
      )}
    </SectionBox>
  );
}

export function AlphaPlacementPoliciesCapability({ hubCluster }: Props) {
  return hubCluster ? <PolicyList key={hubCluster} hubCluster={hubCluster} /> : <ConfigureHub />;
}

function PolicyBindings({ policy, hubCluster }: Props & { policy: PlacementPolicyData }) {
  const bindingClass =
    policy.kind === 'PlacementPolicy' ? PlacementBinding : ClusterPlacementBinding;
  const [bindings, error] = bindingClass.useList({
    cluster: hubCluster,
    namespace: policy.metadata.namespace,
  });
  const selectedBindings = bindings?.filter(binding =>
    bindingBelongsToPolicy(binding.jsonData, policy)
  );
  const failedResources = selectedBindings?.flatMap(binding =>
    (binding.jsonData.status?.failedResources || []).map(resource => ({
      ...resource,
      cluster: binding.jsonData.spec.clusterName,
    }))
  );

  return (
    <>
      <SectionBox title="Per-cluster Bindings">
        {error ? (
          <Typography role="alert" color="error">
            {formatApiError(error, `${bindingClass.kind} list`)}
          </Typography>
        ) : (
          <SimpleTable
            data={selectedBindings}
            columns={[
              {
                label: 'Member Cluster',
                getter: (binding: PlacementBinding) => binding.jsonData.spec.clusterName,
              },
              {
                label: 'Status',
                getter: (binding: PlacementBinding) => (
                  <Status display={getBindingStatus(binding.jsonData)} />
                ),
              },
              {
                label: 'Synchronized / Selected Resources',
                getter: (binding: PlacementBinding) =>
                  formatCounts(
                    binding.jsonData.status?.synchronizedResources,
                    binding.jsonData.status?.selectedResources
                  ),
              },
              {
                label: 'Available / Selected Resources',
                getter: (binding: PlacementBinding) =>
                  formatCounts(
                    binding.jsonData.status?.availableResources,
                    binding.jsonData.status?.selectedResources
                  ),
              },
              {
                label: 'Desired Snapshot',
                getter: (binding: PlacementBinding) => binding.jsonData.spec.resourceSnapshotName,
              },
              {
                label: 'Processed Snapshot',
                getter: (binding: PlacementBinding) =>
                  binding.jsonData.status?.lastProcessedResourceSnapshotName || '-',
              },
              {
                label: 'Conditions',
                getter: (binding: PlacementBinding) =>
                  binding.jsonData.status?.conditions
                    ?.map(
                      condition =>
                        `${condition.type}: ${
                          getConditionDisplay(binding.jsonData, condition.type).label
                        } - ${condition.reason || ''} ${condition.message || ''}`
                    )
                    .join('\n') || '-',
              },
            ]}
            emptyMessage="No bindings have been created for this policy."
          />
        )}
      </SectionBox>
      {!error && !!failedResources?.length && (
        <SectionBox title="Failed Resources">
          <SimpleTable
            data={failedResources}
            columns={[
              { label: 'Cluster', datum: 'cluster' },
              {
                label: 'Resource',
                getter: (resource: NonNullable<typeof failedResources>[number]) =>
                  `${resource.objectRef.kind} ${
                    resource.objectRef.namespace ? `${resource.objectRef.namespace}/` : ''
                  }${resource.objectRef.name || '-'}`,
              },
              {
                label: 'Conditions',
                getter: (resource: NonNullable<typeof failedResources>[number]) =>
                  resource.conditions
                    ?.map(
                      condition =>
                        `${condition.type}=${condition.status}: ${condition.reason || ''} ${
                          condition.message || ''
                        }`
                    )
                    .join('\n') || '-',
              },
            ]}
          />
        </SectionBox>
      )}
    </>
  );
}

function PolicyDetails({
  hubCluster,
  policyName,
  namespace,
}: Props & { policyName: string; namespace?: string }) {
  const policyClass = namespace ? PlacementPolicy : ClusterPlacementPolicy;
  const [policy, error] = policyClass.useGet(policyName, namespace, { cluster: hubCluster });

  if (error) {
    return (
      <SectionBox title="Placement Policy" backLink>
        <Typography role="alert" color="error">
          {formatApiError(error, `${policyClass.kind} ${policyName}`)}
        </Typography>
      </SectionBox>
    );
  }
  if (!policy) {
    return <Loader title="Loading placement policy..." />;
  }
  const data = policy.jsonData;
  const source = getGeneratedSource(data);
  const autoRollout = data.metadata.annotations?.['kubefleet.dev/auto-rollout-enabled'] === 'true';
  const interval =
    data.metadata.annotations?.['kubefleet.dev/auto-rollout-minimum-wait-period'] || '3m (default)';

  return (
    <>
      <SectionBox title={`${data.kind}: ${policyName}`} backLink>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Read-only alpha policy on hub {hubCluster}.{' '}
          {source
            ? 'Change placement through the source annotation, not the generated spec.'
            : 'Manually authored policy.'}
        </Typography>
        <SimpleTable
          noTableHeader
          showPagination={false}
          data={[
            { name: 'API', value: data.apiVersion },
            { name: 'Namespace', value: data.metadata.namespace || 'Cluster-scoped' },
            {
              name: 'Source',
              value: source ? `Annotation-generated: ${source}` : 'Manually authored',
            },
            { name: 'Status', value: <Status display={getPolicyStatus(data)} /> },
            {
              name: 'Scheduled / Desired Clusters',
              value: formatCounts(data.status?.scheduledClusters, data.status?.desiredClusters),
            },
            {
              name: 'Synchronized / Desired Clusters',
              value: formatCounts(data.status?.synchronizedClusters, data.status?.desiredClusters),
            },
            {
              name: 'Available / Desired Clusters',
              value: formatCounts(
                data.status?.resourcesAvailableClusters,
                data.status?.desiredClusters
              ),
            },
            { name: 'Active Cluster Claims', value: data.status?.activeClusterClaims ?? '-' },
            {
              name: 'Latest Resource Revision',
              value: data.status?.latestResourceRevisionName || '-',
            },
            { name: 'Revision History Limit', value: data.spec.resourceRevisionHistoryLimit ?? 3 },
            {
              name: 'Auto-rollout',
              value: autoRollout ? `Enabled; minimum interval annotation: ${interval}` : 'Disabled',
            },
          ]}
          columns={[
            { label: 'Field', datum: 'name' },
            { label: 'Value', datum: 'value' },
          ]}
        />
      </SectionBox>
      <SectionBox title="Conditions">
        <SimpleTable
          data={POLICY_CONDITIONS.map(type => ({
            type,
            display: getConditionDisplay(data, type),
            condition: data.status?.conditions?.find(condition => condition.type === type),
          }))}
          columns={[
            { label: 'Type', datum: 'type' },
            {
              label: 'Status',
              getter: (row: { display: StatusDisplay }) => <Status display={row.display} />,
            },
            {
              label: 'Observed Generation',
              getter: (row: { condition?: PlacementCondition }) =>
                row.condition?.observedGeneration ?? '-',
            },
            {
              label: 'Reason / Message',
              getter: (row: { display: StatusDisplay }) => row.display.message,
            },
            {
              label: 'Last Transition',
              getter: (row: { condition?: PlacementCondition }) =>
                row.condition?.lastTransitionTime || '-',
            },
          ]}
        />
      </SectionBox>
      <SectionBox title="Resource Selectors">
        <SimpleTable
          data={data.spec.resourceSelectors}
          columns={[
            { label: 'Kind', datum: 'kind' },
            {
              label: 'API Group',
              getter: (selector: { apiGroup?: string }) => selector.apiGroup || 'Core',
            },
            { label: 'API Version', datum: 'apiVersion' },
            {
              label: 'Namespace',
              getter: (selector: { namespace?: string }) =>
                selector.namespace || data.metadata.namespace || '-',
            },
            { label: 'Name', datum: 'name' },
            {
              label: 'Label Selector',
              getter: (selector: { labelSelector?: Record<string, unknown> }) =>
                selector.labelSelector ? <Yaml value={selector.labelSelector} /> : '-',
            },
          ]}
        />
      </SectionBox>
      <SectionBox title="Cluster Selectors">
        {data.spec.clusterSelectors?.length ? (
          <Yaml value={data.spec.clusterSelectors} />
        ) : (
          <Typography>
            No cluster selectors specified: all eligible member clusters are selected.
          </Typography>
        )}
      </SectionBox>
      <PolicyBindings policy={data} hubCluster={hubCluster} />
      <SectionBox title="Policy Specification (Read-only)">
        <Yaml value={data.spec} />
      </SectionBox>
    </>
  );
}

export function AlphaPlacementPolicyDetailsCapability({ hubCluster }: Props) {
  const { policyName = '', namespace } = useParams<{ policyName: string; namespace?: string }>();
  return hubCluster ? (
    <PolicyDetails
      key={`${hubCluster}/${namespace || ''}/${policyName}`}
      hubCluster={hubCluster}
      policyName={policyName}
      namespace={namespace}
    />
  ) : (
    <ConfigureHub />
  );
}
