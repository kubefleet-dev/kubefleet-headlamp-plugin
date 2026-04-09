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

import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  EditorDialog,
  Link,
  SectionBox,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type NamespaceResourceDefinition = {
  group: string;
  version: string;
  kind: string;
  pluralName: string;
  apiVersion: string;
};

type NamespaceResourceRow = {
  metadata: {
    uid: string;
    name: string;
    namespace: string;
    creationTimestamp?: string;
  };
  kind: string;
  apiVersion: string;
  group: string;
  version: string;
  pluralName: string;
};

function uniqueResourceKey(definition: NamespaceResourceDefinition): string {
  return `${definition.group}/${definition.version}/${definition.pluralName}`;
}

async function listNamespacedResourceDefinitions(): Promise<NamespaceResourceDefinition[]> {
  const definitionsMap = new Map<string, NamespaceResourceDefinition>();

  const addDefinitions = (resources: any[], group: string, version: string) => {
    resources
      .filter(
        resource =>
          resource?.namespaced === true &&
          Array.isArray(resource?.verbs) &&
          resource.verbs.includes('list') &&
          typeof resource?.name === 'string' &&
          !resource.name.includes('/')
      )
      .forEach(resource => {
        const definition: NamespaceResourceDefinition = {
          group,
          version,
          kind: String(resource?.kind || ''),
          pluralName: String(resource?.name || ''),
          apiVersion: group ? `${group}/${version}` : version,
        };

        if (!definition.kind || !definition.pluralName) {
          return;
        }

        definitionsMap.set(uniqueResourceKey(definition), definition);
      });
  };

  const coreResources = await ApiProxy.request('/api/v1');
  addDefinitions(coreResources?.resources ?? [], '', 'v1');

  const apiGroups = await ApiProxy.request('/apis');
  const groupVersions: string[] = Array.isArray(apiGroups?.groups)
    ? apiGroups.groups.flatMap((group: any) =>
        Array.isArray(group?.versions)
          ? group.versions.map((version: any) => version?.groupVersion)
          : []
      )
    : [];

  const discoveryResults = await Promise.allSettled(
    groupVersions
      .filter(groupVersion => typeof groupVersion === 'string' && groupVersion.length > 0)
      .map(groupVersion => ApiProxy.request(`/apis/${groupVersion}`))
  );

  discoveryResults.forEach((result: PromiseSettledResult<any>) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    const groupVersion = String(result.value?.groupVersion || '');
    const slashIndex = groupVersion.indexOf('/');
    if (slashIndex < 1) {
      return;
    }

    const group = groupVersion.slice(0, slashIndex);
    const version = groupVersion.slice(slashIndex + 1);
    addDefinitions(result.value?.resources ?? [], group, version);
  });

  return Array.from(definitionsMap.values());
}

function makeNamespacedResourcePath(
  namespace: string,
  definition: Pick<NamespaceResourceDefinition, 'group' | 'version' | 'pluralName'>
): string {
  if (!definition.group) {
    return `/api/${definition.version}/namespaces/${namespace}/${definition.pluralName}`;
  }

  return `/apis/${definition.group}/${definition.version}/namespaces/${namespace}/${definition.pluralName}`;
}

function makeNamespacedResourceItemPath(namespace: string, item: NamespaceResourceRow): string {
  return `${makeNamespacedResourcePath(namespace, item)}/${encodeURIComponent(item.metadata.name)}`;
}

async function listAllNamespaceResources(namespace: string): Promise<NamespaceResourceRow[]> {
  const resourceDefinitions = await listNamespacedResourceDefinitions();
  const listResults = await Promise.allSettled(
    resourceDefinitions.map(definition =>
      ApiProxy.request(makeNamespacedResourcePath(namespace, definition)).then(response => ({
        definition,
        items: Array.isArray(response?.items) ? response.items : [],
      }))
    )
  );

  const rows: NamespaceResourceRow[] = [];

  listResults.forEach((result, definitionIndex) => {
    if (result.status !== 'fulfilled') {
      return;
    }

    const definition = resourceDefinitions[definitionIndex];
    result.value.items.forEach((item: any) => {
      const name = item?.metadata?.name;
      const itemNamespace = item?.metadata?.namespace || namespace;
      if (typeof name !== 'string' || !name) {
        return;
      }

      rows.push({
        metadata: {
          uid:
            item?.metadata?.uid ||
            `${definition.apiVersion}/${definition.kind}/${itemNamespace}/${name}`,
          name,
          namespace: itemNamespace,
          creationTimestamp: item?.metadata?.creationTimestamp,
        },
        kind: definition.kind,
        apiVersion: definition.apiVersion,
        group: definition.group,
        version: definition.version,
        pluralName: definition.pluralName,
      });
    });
  });

  return rows;
}

function createRolloutPlacement(namespace: string, selectedResources: NamespaceResourceRow[]) {
  const selectors = selectedResources.map(resource => ({
    group: resource.group,
    version: resource.version,
    kind: resource.kind,
    name: resource.metadata.name,
  }));

  return {
    apiVersion: 'placement.kubernetes-fleet.io/v1beta1',
    kind: 'ResourcePlacement',
    metadata: {
      name: `rollout-${namespace}-${Date.now()}`,
      namespace,
    },
    spec: {
      resourceSelectors: selectors,
      policy: {
        placementType: 'PickAll',
      },
    },
  };
}

export function StagedResourceDetailsCapability() {
  const { namespace = '' } = useParams<{ namespace: string }>();
  const [resources, setResources] = useState<NamespaceResourceRow[] | null>(null);
  const [error, setError] = useState<string>('');
  const [reloadToken, setReloadToken] = useState(0);
  const [rolloutEditorOpen, setRolloutEditorOpen] = useState(false);
  const [rolloutTemplate, setRolloutTemplate] = useState<any>({});

  useEffect(() => {
    let mounted = true;

    setResources(null);
    setError('');

    listAllNamespaceResources(namespace)
      .then(items => {
        if (!mounted) {
          return;
        }

        setResources(items);
      })
      .catch(listError => {
        if (!mounted) {
          return;
        }

        setResources([]);
        setError(listError?.message || 'Unable to load namespace resources.');
      });

    return () => {
      mounted = false;
    };
  }, [namespace, reloadToken]);

  const refreshResources = () => {
    setReloadToken(token => token + 1);
  };

  return (
    <SectionBox title={`Staged Resource: ${namespace}`}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Select resources in this namespace and either delete them or generate a rollout placement
        policy for member clusters.
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 1.5 }}>
          {error}
        </Typography>
      )}
      <Table<NamespaceResourceRow>
        loading={resources === null}
        data={resources ?? []}
        enableRowSelection
        columns={[
          {
            id: 'name',
            header: 'Name',
            accessorFn: item => item.metadata.name,
            Cell: ({ row }) => {
              const resource = row.original as NamespaceResourceRow;

              return (
                <Link
                  routeName="fleet-placement-policies"
                  search={{
                    selectedName: resource.metadata.name,
                    selectedKind: resource.kind,
                    selectedVersion: resource.version,
                    selectedGroup: resource.group || '',
                    selectedNamespace: resource.metadata.namespace || '',
                  }}
                >
                  {resource.metadata.name}
                </Link>
              );
            },
          },
          {
            id: 'kind',
            header: 'Kind',
            accessorFn: item => item.kind,
          },
          {
            id: 'apiVersion',
            header: 'GVK',
            accessorFn: item => `${item.apiVersion}/${item.kind}`,
          },
          {
            id: 'namespace',
            header: 'Namespace',
            accessorFn: item => item.metadata.namespace,
          },
          {
            id: 'age',
            header: 'Created',
            accessorFn: item => item.metadata.creationTimestamp || '-',
          },
          {
            id: 'placementPolicies',
            header: 'Placements',
            accessorFn: () => 'View matching policies',
            Cell: ({ row }) => {
              const resource = row.original as NamespaceResourceRow;

              return (
                <Link
                  routeName="fleet-placement-policies"
                  underline="always"
                  search={{
                    selectedName: resource.metadata.name,
                    selectedKind: resource.kind,
                    selectedVersion: resource.version,
                    selectedGroup: resource.group || '',
                    selectedNamespace: resource.metadata.namespace || '',
                  }}
                >
                  View matching policies
                </Link>
              );
            },
          },
        ]}
        getRowId={item => item.metadata.uid}
        renderRowSelectionToolbar={({ table }) => {
          const selectedResources = table
            .getSelectedRowModel()
            .rows.map(row => row.original as NamespaceResourceRow);

          const deleteSelectedResources = () => {
            if (selectedResources.length === 0) {
              return;
            }

            const isConfirmed = window.confirm(
              `Delete ${selectedResources.length} selected resource(s) from namespace ${namespace}?`
            );
            if (!isConfirmed) {
              return;
            }

            Promise.allSettled(
              selectedResources.map(resource =>
                ApiProxy.request(makeNamespacedResourceItemPath(namespace, resource), {
                  method: 'DELETE',
                })
              )
            ).finally(() => {
              table.resetRowSelection();
              refreshResources();
            });
          };

          const openRolloutEditor = () => {
            if (selectedResources.length === 0) {
              return;
            }

            setRolloutTemplate(createRolloutPlacement(namespace, selectedResources));
            setRolloutEditorOpen(true);
          };

          return (
            <Box display="flex" gap={1}>
              <Button color="error" variant="contained" onClick={deleteSelectedResources}>
                Delete
              </Button>
              <Button variant="contained" onClick={openRolloutEditor}>
                Rollout to members
              </Button>
            </Box>
          );
        }}
      />
      <EditorDialog
        open={rolloutEditorOpen}
        title="Rollout to Members"
        item={rolloutTemplate}
        onSave="default"
        onClose={() => {
          setRolloutEditorOpen(false);
          refreshResources();
        }}
        saveLabel="Create Placement Policy"
      />
    </SectionBox>
  );
}
