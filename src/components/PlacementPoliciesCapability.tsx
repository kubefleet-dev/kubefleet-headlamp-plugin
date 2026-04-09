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
import {
  DateLabel,
  Link,
  ResourceListView,
  SectionBox,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useLocation } from 'react-router-dom';

type Props = {
  clusterPlacements: any[] | null;
  resourcePlacements: any[] | null;
  getPlacementScope: (item: any) => 'Cluster' | 'Namespace';
  getPlacementPolicyType: (item: any) => string;
  getPlacementStrategyType: (item: any) => 'RollingUpdate' | 'External';
};

export function PlacementPoliciesCapability({
  clusterPlacements,
  resourcePlacements,
  getPlacementScope,
  getPlacementPolicyType,
  getPlacementStrategyType,
}: Props) {
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const selectedName = searchParams.get('selectedName') || '';
  const selectedKind = searchParams.get('selectedKind') || '';
  const selectedVersion = searchParams.get('selectedVersion') || '';
  const selectedGroup = searchParams.get('selectedGroup') || '';
  const selectedNamespace = searchParams.get('selectedNamespace') || '';
  const hasSelectorFilter = !!(selectedName && selectedKind && selectedVersion);
  const selectorApiVersion = selectedGroup
    ? `${selectedGroup}/${selectedVersion}`
    : selectedVersion;
  const selectorScope = selectedNamespace
    ? `namespace ${selectedNamespace}`
    : 'all namespaces/cluster-scoped resources';

  const mergedPlacements =
    clusterPlacements && resourcePlacements ? [...clusterPlacements, ...resourcePlacements] : null;

  const filteredPlacements =
    mergedPlacements?.filter(item => {
      if (!hasSelectorFilter) {
        return true;
      }

      const selectors = item?.jsonData?.spec?.resourceSelectors;
      if (!Array.isArray(selectors) || selectors.length === 0) {
        return false;
      }

      return selectors.some((selector: any) => {
        if ((selector?.name || '') !== selectedName) {
          return false;
        }

        if ((selector?.kind || '') !== selectedKind) {
          return false;
        }

        if ((selector?.version || '') !== selectedVersion) {
          return false;
        }

        if ((selector?.group || '') !== selectedGroup) {
          return false;
        }

        if (selectedNamespace && selector?.namespace && selector.namespace !== selectedNamespace) {
          return false;
        }

        return true;
      });
    }) ?? null;

  function getSchedulingCompletedCondition(item: any) {
    const conditions = item?.jsonData?.status?.conditions;
    if (!Array.isArray(conditions)) {
      return null;
    }

    const kind = String(item?.jsonData?.kind || '');
    const scheduledConditionType =
      kind === 'ResourcePlacement'
        ? 'ResourcePlacementScheduled'
        : 'ClusterResourcePlacementScheduled';

    return conditions.find((condition: any) => condition?.type === scheduledConditionType) || null;
  }

  function getSelectedClusterCount(item: any): number | null {
    const condition = getSchedulingCompletedCondition(item);
    if (!condition) {
      return null;
    }
    const message = String(condition?.message || '');
    const match = message.match(/found (\d+) cluster/);
    return match ? parseInt(match[1], 10) : null;
  }

  function getSchedulingCompletedDisplay(item: any): {
    label: string;
    status: 'success' | 'warning' | 'error' | '';
    detailedStatus: string;
  } {
    const condition = getSchedulingCompletedCondition(item);

    if (!condition) {
      return {
        label: '',
        status: '',
        detailedStatus: '',
      };
    }

    const reason = String(condition?.reason || '');
    const conditionStatus = String(condition?.status || '');
    const message = String(condition?.message || '').trim();

    const isRelevantReason =
      reason === 'SchedulingPolicyFulfilled' || reason === 'SchedulingPolicyUnfulfilled';

    if (!isRelevantReason) {
      return {
        label: '',
        status: '',
        detailedStatus: '',
      };
    }

    if (conditionStatus === 'True') {
      return {
        label: 'Fulfilled',
        status: 'success',
        detailedStatus: message || 'Scheduling policy fulfilled',
      };
    }

    if (conditionStatus === 'False') {
      return {
        label: 'Not Fulfilled',
        status: 'error',
        detailedStatus: message || 'Scheduling policy not fulfilled',
      };
    }

    return {
      label: '',
      status: '',
      detailedStatus: '',
    };
  }

  function makeSchedulingCompletedLabel(item: any) {
    const statusDisplay = getSchedulingCompletedDisplay(item);

    if (!statusDisplay.label) {
      return '';
    }

    return (
      <Tooltip title={statusDisplay.detailedStatus}>
        <Box display="inline">
          <StatusLabel status={statusDisplay.status}>
            {statusDisplay.status === 'error' && (
              <Icon aria-label="hidden" icon="mdi:alert-outline" width="1.2rem" height="1.2rem" />
            )}
            {statusDisplay.label}
          </StatusLabel>
        </Box>
      </Tooltip>
    );
  }

  return (
    <>
      <SectionBox title="Resource Placements">
        <Typography variant="body2" sx={{ mb: 2 }}>
          Resource placements select Kubernetes resources staged on the hub cluster to distribute to
          member clusters. Member clusters are chosen based on the policy specified in the
          placement.
        </Typography>
        {hasSelectorFilter && (
          <SectionBox title="Active Filter">
            <Typography variant="body2">
              Showing only placements that select <strong>{selectedKind}</strong>{' '}
              <strong>{selectedName}</strong> ({selectorApiVersion}) within {selectorScope}.
            </Typography>
            <Box mt={1}>
              <Link routeName="fleet-placement-policies">Clear filter</Link>
            </Box>
          </SectionBox>
        )}
        <Box mx={-2}>
          <ResourceListView
            title={<></>}
            headerProps={{ titleSideActions: [] }}
            data={filteredPlacements}
            columns={[
              {
                label: 'Name',
                getValue: (item: any) => item.getName(),
                render: (item: any) => {
                  const scope = getPlacementScope(item);
                  const name = item.getName();
                  const namespace = item.getNamespace?.();
                  const params =
                    scope === 'Namespace' && namespace
                      ? { scope: 'namespace', namespace, placementName: name }
                      : { scope: 'cluster', placementName: name };
                  const routeName =
                    scope === 'Namespace' && namespace
                      ? 'fleet-placement-policy-details-namespace'
                      : 'fleet-placement-policy-details-cluster';

                  return (
                    <Link routeName={routeName} params={params}>
                      {name}
                    </Link>
                  );
                },
              },
              {
                label: 'Scope',
                getValue: (item: any) => item.getNamespace?.() || 'Cluster',
                render: (item: any) => {
                  const namespace = item.getNamespace?.();

                  if (!namespace) {
                    return 'Cluster';
                  }

                  return (
                    <Link
                      routeName="namespace"
                      params={{ name: namespace }}
                      activeCluster={item.cluster}
                    >
                      {namespace}
                    </Link>
                  );
                },
              },
              {
                label: 'Policy',
                getValue: (item: any) => getPlacementPolicyType(item),
              },
              {
                label: 'Cluster Selection',
                getValue: (item: any) => getSchedulingCompletedDisplay(item).label,
                render: (item: any) => makeSchedulingCompletedLabel(item),
              },
              {
                label: 'Cluster count',
                getValue: (item: any) => getSelectedClusterCount(item) ?? '',
                render: (item: any) => {
                  const count = getSelectedClusterCount(item);
                  return count !== null ? count : '-';
                },
              },
              {
                label: 'Rollout Strategy',
                getValue: (item: any) => getPlacementStrategyType(item),
              },
              {
                label: 'Last Transition',
                getValue: (item: any) => {
                  const conditions = item?.jsonData?.status?.conditions;
                  if (!Array.isArray(conditions) || conditions.length === 0) {
                    return '';
                  }
                  return conditions[conditions.length - 1]?.lastTransitionTime || '';
                },
                render: (item: any) => {
                  const conditions = item?.jsonData?.status?.conditions;
                  if (!Array.isArray(conditions) || conditions.length === 0) {
                    return '-';
                  }
                  const lastTransition = conditions[conditions.length - 1]?.lastTransitionTime;
                  if (!lastTransition) {
                    return '-';
                  }
                  return new Date(lastTransition).toLocaleString(undefined, {
                    timeZoneName: 'short',
                  });
                },
              },
              {
                label: 'Age',
                getValue: (item: any) => item?.jsonData?.metadata?.creationTimestamp || '',
                render: (item: any) => {
                  const creationTimestamp = item?.jsonData?.metadata?.creationTimestamp;
                  if (!creationTimestamp) {
                    return '-';
                  }
                  return <DateLabel date={creationTimestamp} format="mini" />;
                },
              },
            ]}
            actions={[
              {
                id: 'view-placement-status',
                action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
                  const placementName = item.getName();
                  const scope = getPlacementScope(item);
                  const namespace = item.getNamespace?.();
                  const params =
                    scope === 'Namespace' && namespace
                      ? { scope: 'namespace', namespace, placementName }
                      : { scope: 'cluster', placementName };
                  const routeName =
                    scope === 'Namespace' && namespace
                      ? 'fleet-placement-status-namespace'
                      : 'fleet-placement-status-cluster';

                  return (
                    <MenuItem
                      key="view-placement-status"
                      component={Link as any}
                      routeName={routeName}
                      params={params}
                      onClick={closeMenu}
                    >
                      <ListItemIcon>
                        <Icon icon="mdi:clipboard-list-outline" />
                      </ListItemIcon>
                      <ListItemText>View placement status</ListItemText>
                    </MenuItem>
                  );
                },
              },
              {
                id: 'view-staged-rollouts',
                action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
                  const placementName = item.getName();
                  const isExternal = getPlacementStrategyType(item) === 'External';

                  return (
                    <MenuItem
                      key="view-staged-rollouts"
                      disabled={!isExternal}
                      component={isExternal ? (Link as any) : 'li'}
                      routeName={isExternal ? 'fleet-rollout-runs' : undefined}
                      search={isExternal ? { placement: placementName } : undefined}
                      onClick={isExternal ? closeMenu : undefined}
                    >
                      <ListItemIcon>
                        <Icon icon="mdi:format-list-bulleted" />
                      </ListItemIcon>
                      <ListItemText>View staged rollouts</ListItemText>
                    </MenuItem>
                  );
                },
              },
            ]}
          />
        </Box>
      </SectionBox>
    </>
  );
}
