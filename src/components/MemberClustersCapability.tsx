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

import { Link, ResourceListView, StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

type Props = {
  memberClusterResourceClass: any;
};

function renderMetadataChips(metadataMap: Record<string, string> | undefined) {
  if (!metadataMap || Object.keys(metadataMap).length === 0) {
    return <>-</>;
  }

  return (
    <Box display="flex" flexWrap="wrap" gap={0.5} py={0.25}>
      {Object.entries(metadataMap).map(([key, value]) => (
        <Chip key={key} label={`${key}=${value}`} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

export function MemberClustersCapability({ memberClusterResourceClass }: Props) {
  const formatMetadataMap = (metadataMap: Record<string, string> | undefined) => {
    if (!metadataMap || Object.keys(metadataMap).length === 0) {
      return '-';
    }

    return Object.entries(metadataMap)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  };

  return (
    <ResourceListView
      title="Member Clusters"
      resourceClass={memberClusterResourceClass}
      headerProps={{ titleSideActions: [] }}
      columns={[
        {
          label: 'Member Name',
          gridTemplate: 'min-content',
          getValue: (item: any) => item.getName(),
          render: (item: any) => {
            const clusterName = item.getName();
            return (
              <Link routeName="cluster" params={{ cluster: clusterName }}>
                {clusterName}
              </Link>
            );
          },
        },
        {
          label: 'Status',
          gridTemplate: 'min-content',
          getValue: (item: any) => {
            const props = item.jsonData?.status?.properties ?? {};
            const nodeCount = Number(
              props['kubernetes-fleet.io/node-count']?.value ??
                props['kubernetes-fleet.io/node-count'] ??
                0
            );
            const usage = item.jsonData?.status?.resourceUsage ?? {};
            const allUsageZero =
              Object.keys(usage).length === 0 ||
              Object.values(usage).every(
                (v: any) =>
                  v === 0 || v === '0' || (typeof v === 'object' && Number(v?.value ?? 0) === 0)
              );
            return nodeCount === 0 && allUsageZero ? 'Unavailable' : 'Available';
          },
          render: (item: any) => {
            const props = item.jsonData?.status?.properties ?? {};
            const nodeCount = Number(
              props['kubernetes-fleet.io/node-count']?.value ??
                props['kubernetes-fleet.io/node-count'] ??
                0
            );
            const usage = item.jsonData?.status?.resourceUsage ?? {};
            const allUsageZero =
              Object.keys(usage).length === 0 ||
              Object.values(usage).every(
                (v: any) =>
                  v === 0 || v === '0' || (typeof v === 'object' && Number(v?.value ?? 0) === 0)
              );
            const unavailable = nodeCount === 0 && allUsageZero;
            return (
              <StatusLabel status={unavailable ? 'error' : 'success'}>
                {unavailable ? 'Unavailable' : 'Available'}
              </StatusLabel>
            );
          },
        },
        {
          label: 'Kubernetes',
          gridTemplate: 'min-content',
          getValue: (item: any) => {
            const versionProperty = item.jsonData?.status?.properties?.['k8s.io/k8s-version'];

            if (typeof versionProperty === 'string') {
              return versionProperty;
            }

            if (typeof versionProperty?.value === 'string') {
              return versionProperty.value;
            }

            return '-';
          },
        },
        {
          label: 'Labels',
          getValue: (item: any) => formatMetadataMap(item.jsonData?.metadata?.labels),
          render: (item: any) => renderMetadataChips(item.jsonData?.metadata?.labels),
        },
      ]}
    />
  );
}
