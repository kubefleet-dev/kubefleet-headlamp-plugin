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

import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

type Props = {
  selectedHubCluster: string;
  fetchResourceList: (
    hubCluster: string,
    pluralName: 'clusterresourceoverrides' | 'resourceoverrides'
  ) => Promise<any[]>;
};

export function ResourceOverridesCapability({ selectedHubCluster, fetchResourceList }: Props) {
  const [overrides, setOverrides] = useState<any[] | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    if (!selectedHubCluster) {
      setOverrides([]);
      return () => {
        mounted = false;
      };
    }

    Promise.all([
      fetchResourceList(selectedHubCluster, 'clusterresourceoverrides'),
      fetchResourceList(selectedHubCluster, 'resourceoverrides'),
    ])
      .then(([clusterResourceOverrides, resourceOverrides]) => {
        if (!mounted) {
          return;
        }

        const mergedOverrides = [
          ...clusterResourceOverrides.map((item: any) => ({ ...item, __scope: 'Cluster' })),
          ...resourceOverrides.map((item: any) => ({ ...item, __scope: 'Namespace' })),
        ];

        setOverrides(mergedOverrides);
      })
      .catch((requestError: any) => {
        if (!mounted) {
          return;
        }

        setError(requestError?.message || 'Unable to load resource overrides.');
        setOverrides([]);
      });

    return () => {
      mounted = false;
    };
  }, [selectedHubCluster, fetchResourceList]);

  if (!selectedHubCluster) {
    return (
      <SectionBox title="Resource Overrides">
        <Typography>
          Configure a hub cluster in KubeFleet Configuration before viewing Resource Overrides.
        </Typography>
      </SectionBox>
    );
  }

  return (
    <>
      {error && (
        <SectionBox title="Resource Overrides">
          <Typography color="error">Unable to load overrides: {error}</Typography>
        </SectionBox>
      )}
      <ResourceListView
        title="Resource Overrides"
        data={overrides}
        columns={[
          {
            label: 'Name',
            getValue: (item: any) => item?.metadata?.name || '-',
            render: (item: any) => {
              const itemName = item?.metadata?.name;
              if (!itemName) {
                return '-';
              }
              const itemScope = item?.__scope === 'Namespace' ? 'namespace' : 'cluster';
              const itemNamespace = item?.metadata?.namespace;
              const routeName =
                itemScope === 'namespace'
                  ? 'fleet-resource-override-details-namespace'
                  : 'fleet-resource-override-details-cluster';
              const params =
                itemScope === 'namespace' && itemNamespace
                  ? { scope: itemScope, namespace: itemNamespace, name: itemName }
                  : { scope: itemScope, name: itemName };

              return (
                <Link routeName={routeName} params={params}>
                  {itemName}
                </Link>
              );
            },
          },
          {
            label: 'Type',
            getValue: (item: any) => item?.kind || '-',
          },
          {
            label: 'Scope',
            getValue: (item: any) => item?.__scope || '-',
          },
          {
            label: 'Namespace',
            getValue: (item: any) => item?.metadata?.namespace || '-',
          },
          {
            label: 'Created',
            getValue: (item: any) => item?.metadata?.creationTimestamp || '-',
          },
        ]}
      />
    </>
  );
}
