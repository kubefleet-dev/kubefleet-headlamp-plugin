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

import { Loader, SectionBox, Table } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useParams } from 'react-router-dom';

type Props = {
  clusterResourcePlacementClass: any;
  resourcePlacementClass: any;
};

function getPrimaryCondition(entry: any): any {
  const conditions = Array.isArray(entry?.conditions) ? entry.conditions : [];
  if (conditions.length === 0) {
    return null;
  }

  return (
    conditions.find((condition: any) => String(condition?.status) === 'False') ||
    conditions.find((condition: any) => String(condition?.status) === 'Unknown') ||
    conditions[0]
  );
}

function formatConditions(conditions: any[] | undefined): string {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '-';
  }

  return conditions
    .map(condition => `${condition?.type ?? 'Unknown'}=${condition?.status ?? '-'}`)
    .join(', ');
}

export function PlacementStatusCapability({
  clusterResourcePlacementClass,
  resourcePlacementClass,
}: Props) {
  const {
    scope = '',
    placementName = '',
    namespace = '',
  } = useParams<{
    scope: string;
    placementName: string;
    namespace?: string;
  }>();
  const isNamespaceScope = scope === 'namespace';
  const resourceClass = isNamespaceScope ? resourcePlacementClass : clusterResourcePlacementClass;
  const detailsNamespace = isNamespaceScope ? namespace || undefined : undefined;

  const [item] = resourceClass.useGet(placementName, detailsNamespace);

  if (!item) {
    return <Loader title="Loading placement status..." />;
  }

  const placementStatuses = (
    item?.jsonData?.status?.placementstatuses ??
    item?.jsonData?.status?.placementStatuses ??
    []
  ).map((statusEntry: any, index: number) => ({
    ...statusEntry,
    __id:
      statusEntry?.clusterName || statusEntry?.cluster || statusEntry?.name
        ? `${statusEntry?.clusterName || statusEntry?.cluster || statusEntry?.name}-${index}`
        : `placement-status-${index}`,
  }));

  return (
    <SectionBox title={`Placement Status: ${placementName}`} backLink>
      <Table<any>
        data={placementStatuses}
        getRowId={statusEntry => statusEntry.__id}
        rowsPerPage={[10, 25, 50]}
        columns={[
          {
            id: 'cluster',
            header: 'Picked Cluster',
            accessorFn: statusEntry =>
              statusEntry?.clusterName || statusEntry?.cluster || statusEntry?.name || '-',
          },
          {
            id: 'status',
            header: 'Status',
            accessorFn: statusEntry => {
              const primaryCondition = getPrimaryCondition(statusEntry);
              return primaryCondition?.status || '-';
            },
          },
          {
            id: 'conditions',
            header: 'Conditions',
            accessorFn: statusEntry => formatConditions(statusEntry?.conditions),
          },
          {
            id: 'reason',
            header: 'Reason',
            accessorFn: statusEntry => getPrimaryCondition(statusEntry)?.reason || '-',
          },
          {
            id: 'message',
            header: 'Message',
            accessorFn: statusEntry => getPrimaryCondition(statusEntry)?.message || '-',
          },
          {
            id: 'lastTransitionTime',
            header: 'Last Transition Time',
            accessorFn: statusEntry => getPrimaryCondition(statusEntry)?.lastTransitionTime || '-',
          },
        ]}
      />
    </SectionBox>
  );
}
