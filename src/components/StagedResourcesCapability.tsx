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
import { ApiProxy, K8s } from '@kinvolk/headlamp-plugin/lib';
import {
  CreateResourceButton,
  DateLabel,
  EditorDialog,
  Link,
  SectionBox,
  StatusLabel,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

type ClusterScopedResourceDefinition = {
  key: string;
  label: string;
  group: string;
  version: string;
  kind: string;
  pluralName: string;
  apiVersion: string;
};

type ClusterScopedResourceRow = {
  metadata: {
    uid: string;
    name: string;
    creationTimestamp?: string;
  };
  kind: string;
  apiVersion: string;
  group: string;
  version: string;
  pluralName: string;
  status: string;
};

const RESTRICTED_NAMESPACE_NAMES = new Set(['default', 'fleet-system']);
const NAMESPACE_RESOURCE_KEY = '/v1/namespaces';

function makeResourceDefinitionKey(group: string, version: string, pluralName: string): string {
  return `${group}/${version}/${pluralName}`;
}

function makeClusterResourceListPath(
  definition: Pick<ClusterScopedResourceDefinition, 'group' | 'version' | 'pluralName'>
) {
  if (!definition.group) {
    return `/api/${definition.version}/${definition.pluralName}`;
  }

  return `/apis/${definition.group}/${definition.version}/${definition.pluralName}`;
}

function makeClusterResourceItemPath(
  definition: Pick<ClusterScopedResourceDefinition, 'group' | 'version' | 'pluralName'>,
  name: string
) {
  return `${makeClusterResourceListPath(definition)}/${encodeURIComponent(name)}`;
}

function normalizeStatus(item: any): string {
  const phase = item?.status?.phase;
  if (typeof phase === 'string' && phase.length > 0) {
    return phase;
  }

  const conditions = item?.status?.conditions;
  if (Array.isArray(conditions)) {
    const falseCondition = conditions.find(
      (condition: any) => String(condition?.status) === 'False'
    );
    if (falseCondition) {
      return String(falseCondition?.type || 'Not Ready');
    }

    const unknownCondition = conditions.find(
      (condition: any) => String(condition?.status) === 'Unknown'
    );
    if (unknownCondition) {
      return String(unknownCondition?.type || 'Pending');
    }

    const trueCondition = conditions.find((condition: any) => String(condition?.status) === 'True');
    if (trueCondition) {
      return String(trueCondition?.type || 'Ready');
    }
  }

  return '-';
}

async function listClusterScopedResourceDefinitions(): Promise<ClusterScopedResourceDefinition[]> {
  const definitionsMap = new Map<string, ClusterScopedResourceDefinition>();

  const addDefinitions = (resources: any[], group: string, version: string) => {
    resources
      .filter(
        resource =>
          resource?.namespaced === false &&
          Array.isArray(resource?.verbs) &&
          resource.verbs.includes('list') &&
          typeof resource?.name === 'string' &&
          !resource.name.includes('/')
      )
      .forEach(resource => {
        const pluralName = String(resource?.name || '');
        const kind = String(resource?.kind || '');
        if (!pluralName || !kind) {
          return;
        }

        const definition: ClusterScopedResourceDefinition = {
          key: makeResourceDefinitionKey(group, version, pluralName),
          label: kind,
          group,
          version,
          kind,
          pluralName,
          apiVersion: group ? `${group}/${version}` : version,
        };

        definitionsMap.set(definition.key, definition);
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

  discoveryResults.forEach(result => {
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

  return Array.from(definitionsMap.values()).sort((a, b) => {
    if (a.label === b.label) {
      return a.apiVersion.localeCompare(b.apiVersion);
    }

    return a.label.localeCompare(b.label);
  });
}

async function listResourcesByType(
  definition: ClusterScopedResourceDefinition
): Promise<ClusterScopedResourceRow[]> {
  const response = await ApiProxy.request(makeClusterResourceListPath(definition));
  const items = Array.isArray(response?.items) ? response.items : [];

  return items
    .filter((item: any) => {
      if (definition.kind !== 'Namespace') {
        return true;
      }

      const name = String(item?.metadata?.name || '');
      return (
        !!name &&
        !RESTRICTED_NAMESPACE_NAMES.has(name) &&
        !name.startsWith('kube-') &&
        !name.startsWith('fleet-member-')
      );
    })
    .map((item: any) => {
      const name = String(item?.metadata?.name || '');

      return {
        metadata: {
          uid: item?.metadata?.uid || `${definition.apiVersion}/${definition.kind}/${name}`,
          name,
          creationTimestamp: item?.metadata?.creationTimestamp,
        },
        kind: definition.kind,
        apiVersion: definition.apiVersion,
        group: definition.group,
        version: definition.version,
        pluralName: definition.pluralName,
        status: normalizeStatus(item),
      };
    });
}

export function StagedResourcesCapability() {
  const [resourceTypes, setResourceTypes] = useState<ClusterScopedResourceDefinition[] | null>(
    null
  );
  const [resourceRows, setResourceRows] = useState<ClusterScopedResourceRow[] | null>(null);
  const [selectedResourceTypeKey, setSelectedResourceTypeKey] = useState(NAMESPACE_RESOURCE_KEY);
  const [loadingError, setLoadingError] = useState('');
  const [rolloutEditorOpen, setRolloutEditorOpen] = useState(false);
  const [rolloutTemplate, setRolloutTemplate] = useState<any>({});

  useEffect(() => {
    let mounted = true;

    listClusterScopedResourceDefinitions()
      .then(definitions => {
        if (!mounted) {
          return;
        }

        setResourceTypes(definitions);

        const hasNamespace = definitions.some(
          definition => definition.key === NAMESPACE_RESOURCE_KEY
        );
        const defaultKey = hasNamespace ? NAMESPACE_RESOURCE_KEY : definitions[0]?.key || '';
        setSelectedResourceTypeKey(defaultKey);
      })
      .catch(error => {
        if (!mounted) {
          return;
        }

        setResourceTypes([]);
        setLoadingError(error?.message || 'Unable to load cluster resource types.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!resourceTypes || resourceTypes.length === 0 || !selectedResourceTypeKey) {
      setResourceRows([]);
      return () => {
        mounted = false;
      };
    }

    const selectedResourceType = resourceTypes.find(
      definition => definition.key === selectedResourceTypeKey
    );
    if (!selectedResourceType) {
      setResourceRows([]);
      return () => {
        mounted = false;
      };
    }

    setResourceRows(null);
    setLoadingError('');

    listResourcesByType(selectedResourceType)
      .then(rows => {
        if (!mounted) {
          return;
        }

        setResourceRows(rows);
      })
      .catch(error => {
        if (!mounted) {
          return;
        }

        setResourceRows([]);
        setLoadingError(error?.message || 'Unable to load staged resources.');
      });

    return () => {
      mounted = false;
    };
  }, [resourceTypes, selectedResourceTypeKey]);

  const selectedResourceType =
    resourceTypes?.find(definition => definition.key === selectedResourceTypeKey) || null;
  const isNamespaceSelection = selectedResourceType?.kind === 'Namespace';

  const handleResourceTypeChange = (event: SelectChangeEvent<string>) => {
    setSelectedResourceTypeKey(event.target.value);
  };

  const createClusterRolloutPlacement = (selectedNamespaces: string[]) => ({
    apiVersion: 'placement.kubernetes-fleet.io/v1beta1',
    kind: 'ClusterResourcePlacement',
    metadata: {
      name: `rollout-selected-namespaces-${Date.now()}`,
    },
    spec: {
      resourceSelectors: selectedNamespaces.map(namespace => ({
        group: '',
        version: 'v1',
        kind: 'Namespace',
        name: namespace,
        selectionScope: 'NamespaceWithResources',
      })),
      policy: {
        placementType: 'PickAll',
      },
    },
  });

  return (
    <>
      <SectionBox title="KubeFleet Hub Staged Resources">
        <Typography variant="body2" sx={{ mb: 2 }}>
          Use the resource type selector below to view different types of cluster-level staged
          resources. To view namespace-scoped staged resources, select the appropriate namespace.
          <br />
          Staged resources are deployed on the KubeFleet hub cluster and can be referenced by
          placement policies to be rolled out to fleet member clusters.
        </Typography>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={2}>
          <FormControl size="small" sx={{ minWidth: 280 }}>
            <InputLabel id="fleet-staged-resource-type-label">
              Cluster-level Resource Type
            </InputLabel>
            <Select
              labelId="fleet-staged-resource-type-label"
              value={selectedResourceTypeKey}
              label="Cluster Resource Type"
              onChange={handleResourceTypeChange}
              disabled={!resourceTypes || resourceTypes.length === 0}
            >
              {(resourceTypes ?? []).map(definition => (
                <MenuItem key={definition.key} value={definition.key}>
                  {definition.label} ({definition.apiVersion})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isNamespaceSelection && (
            <CreateResourceButton resourceClass={K8s.ResourceClasses.Namespace} />
          )}
        </Box>

        {loadingError && (
          <Typography color="error" sx={{ mb: 1.5 }}>
            {loadingError}
          </Typography>
        )}

        <Table<any>
          loading={resourceRows === null}
          data={resourceRows ?? []}
          enableRowSelection
          enableRowActions
          columns={[
            {
              id: 'name',
              header: 'Name',
              accessorFn: item => item.metadata?.name || '-',
              Cell: ({ row }) => {
                const item = row.original as ClusterScopedResourceRow;
                const name = item.metadata?.name || '-';

                if (!isNamespaceSelection) {
                  return name;
                }

                return (
                  <Link routeName="fleet-staged-resource-details" params={{ namespace: name }}>
                    {name}
                  </Link>
                );
              },
            },
            {
              id: 'kind',
              header: 'Kind',
              accessorFn: item => item.kind || '-',
            },
            {
              id: 'gvk',
              header: 'GVK',
              accessorFn: item => `${item.apiVersion}/${item.kind}`,
            },
            {
              id: 'status',
              header: 'Status',
              accessorFn: item => item.status || '-',
              Cell: ({ row }) => {
                const item = row.original as ClusterScopedResourceRow;
                const status = item.status || '-';
                const normalized = status.toLowerCase();
                const labelStatus: 'success' | 'error' | '' =
                  normalized === 'active' || normalized.includes('ready')
                    ? 'success'
                    : normalized === '-' || normalized.includes('pending')
                    ? ''
                    : 'error';

                if (labelStatus === '') {
                  return status;
                }

                return <StatusLabel status={labelStatus}>{status}</StatusLabel>;
              },
            },
            {
              id: 'age',
              header: 'Age',
              accessorFn: item => item.metadata?.creationTimestamp ?? '',
              Cell: ({ row }) => {
                const ts = (row.original as ClusterScopedResourceRow).metadata?.creationTimestamp;
                return ts ? <DateLabel date={ts} format="mini" /> : '-';
              },
            },
          ]}
          renderRowActionMenuItems={({ closeMenu, row }) => {
            const item = row.original as ClusterScopedResourceRow;
            const search = {
              selectedName: item.metadata?.name || '',
              selectedKind: item.kind || '',
              selectedVersion: item.version || '',
              selectedGroup: item.group || '',
              selectedNamespace:
                isNamespaceSelection && item.metadata?.name ? item.metadata.name : '',
            };

            return [
              <MenuItem
                key="view-matching-policies"
                component={Link as any}
                routeName="fleet-placement-policies"
                search={search}
                onClick={closeMenu}
              >
                <ListItemIcon>
                  <Icon icon="mdi:filter-variant" />
                </ListItemIcon>
                <ListItemText>View matching policies</ListItemText>
              </MenuItem>,
            ];
          }}
          getRowId={item => item?.metadata?.uid || item?.metadata?.name}
          renderRowSelectionToolbar={({ table }) => {
            const selectedItems = table
              .getSelectedRowModel()
              .rows.map(row => row.original as ClusterScopedResourceRow);
            const selectedNamespaces = selectedItems
              .map(item => item.metadata?.name)
              .filter((namespaceName: string) => !!namespaceName);

            const deleteSelectedNamespaces = () => {
              if (selectedItems.length === 0) {
                return;
              }

              const isConfirmed = window.confirm(
                `Delete ${selectedItems.length} selected ${
                  selectedResourceType?.label || 'resource'
                } item(s)?`
              );
              if (!isConfirmed) {
                return;
              }

              Promise.allSettled(
                selectedItems.map(item =>
                  ApiProxy.request(
                    makeClusterResourceItemPath(
                      {
                        group: item.group,
                        version: item.version,
                        pluralName: item.pluralName,
                      },
                      item.metadata.name
                    ),
                    {
                      method: 'DELETE',
                    }
                  )
                )
              ).finally(() => {
                table.resetRowSelection();
                if (selectedResourceType) {
                  setResourceRows(null);
                  listResourcesByType(selectedResourceType)
                    .then(rows => {
                      setResourceRows(rows);
                    })
                    .catch(error => {
                      setResourceRows([]);
                      setLoadingError(error?.message || 'Unable to refresh staged resources.');
                    });
                }
              });
            };

            const openRolloutEditor = () => {
              if (selectedNamespaces.length === 0) {
                return;
              }

              setRolloutTemplate(createClusterRolloutPlacement(selectedNamespaces));
              setRolloutEditorOpen(true);
            };

            return (
              <Box display="flex" gap={1}>
                <Button color="error" variant="contained" onClick={deleteSelectedNamespaces}>
                  Delete
                </Button>
                {isNamespaceSelection && (
                  <Button variant="contained" onClick={openRolloutEditor}>
                    Rollout to members
                  </Button>
                )}
              </Box>
            );
          }}
        />
      </SectionBox>
      <EditorDialog
        open={rolloutEditorOpen}
        title="Rollout to Members"
        item={rolloutTemplate}
        onSave="default"
        onClose={() => setRolloutEditorOpen(false)}
        saveLabel="Create Cluster Placement Policy"
      />
    </>
  );
}
