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
import { Link, ResourceListView } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';

type Props = {
  clusterStrategies: any[] | null;
  namespacedStrategies: any[] | null;
};

export function RolloutStrategiesCapability({ clusterStrategies, namespacedStrategies }: Props) {
  const mergedStrategies =
    clusterStrategies && namespacedStrategies
      ? [...clusterStrategies, ...namespacedStrategies]
      : null;

  return (
    <ResourceListView
      title="Rollout Strategies"
      data={mergedStrategies}
      columns={[
        {
          label: 'Name',
          getValue: (item: any) => item.getName(),
          render: (item: any) => {
            const strategyName = item.getName();
            const strategyNamespace = item.getNamespace?.();
            const routeName = strategyNamespace
              ? 'fleet-rollout-strategy-details-namespace'
              : 'fleet-rollout-strategy-details-cluster';
            const params = strategyNamespace
              ? { scope: 'namespace', namespace: strategyNamespace, strategyName }
              : { scope: 'cluster', strategyName };

            return (
              <Link routeName={routeName} params={params}>
                {strategyName}
              </Link>
            );
          },
        },
        {
          label: 'Scope',
          getValue: (item: any) => item.getNamespace?.() || 'Cluster',
          render: (item: any) => item.getNamespace?.() || 'Cluster',
        },
        {
          label: 'Stage Count',
          getValue: (item: any) => item.jsonData?.spec?.stages?.length ?? 0,
        },
        {
          label: 'After Stage Wait',
          getValue: (item: any) =>
            item.jsonData?.spec?.afterStageWaitSeconds !== null &&
            item.jsonData?.spec?.afterStageWaitSeconds !== undefined
              ? `${item.jsonData.spec.afterStageWaitSeconds}s`
              : '-',
        },
        'age',
      ]}
      actions={[
        {
          id: 'view-rollout-runs',
          action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
            const strategyName = item.getName();

            return (
              <MenuItem
                key="view-rollout-runs"
                component={Link as any}
                routeName="fleet-rollout-runs"
                search={{ strategy: strategyName }}
                onClick={closeMenu}
              >
                <ListItemIcon>
                  <Icon icon="mdi:format-list-bulleted" />
                </ListItemIcon>
                <ListItemText>View rollout runs</ListItemText>
              </MenuItem>
            );
          },
        },
      ]}
    />
  );
}
