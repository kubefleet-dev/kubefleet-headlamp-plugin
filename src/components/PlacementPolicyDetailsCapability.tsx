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
  DetailsGrid,
  Link,
  SectionBox,
  SimpleTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import * as yaml from 'js-yaml';
import { useParams } from 'react-router-dom';

type Props = {
  clusterResourcePlacementClass: any;
  resourcePlacementClass: any;
  getPlacementPolicyType: (item: any) => string;
  makePlacementStatusLabel: (item: any) => React.ReactNode;
  formatObjectSummary: (data: Record<string, any> | undefined) => string;
};

function getResourceSelectors(selectors: any[] | undefined): any[] {
  if (!Array.isArray(selectors)) {
    return [];
  }

  return selectors;
}

function formatConditions(conditions: any[] | undefined): string {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '-';
  }

  return conditions
    .map(condition => `${condition?.type ?? 'Unknown'}=${condition?.status ?? '-'}`)
    .join(', ');
}

function formatPolicyDetails(item: any, getPlacementPolicyType: (item: any) => string) {
  const policy = item?.jsonData?.spec?.policy;
  if (!policy || typeof policy !== 'object') {
    return '-';
  }

  const placementType = getPlacementPolicyType(item);
  const isPickFixed = placementType === 'PickFixed';
  const isPickN = placementType === 'PickN';
  const isPickAll = placementType === 'PickAll';

  const renderYamlSnippet = (snippet: Record<string, any>) => {
    const yamlSnippet = yaml.dump(snippet, { lineWidth: -1, noRefs: true }).trim();

    return (
      <pre
        style={{
          margin: 0,
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
        }}
      >
        {yamlSnippet}
      </pre>
    );
  };

  if (isPickFixed || policy.pickFixed) {
    const clusterNames = policy.pickFixed?.clusterNames ?? policy.clusterNames;
    if (Array.isArray(clusterNames) && clusterNames.length > 0) {
      return renderYamlSnippet({ clusterNames });
    }

    return '-';
  }

  if (isPickAll || isPickN || policy.pickAll || policy.pickN) {
    const affinity = policy.pickN?.affinity ?? policy.pickAll?.affinity ?? policy?.affinity;
    const yamlFields: Record<string, any> = {};

    if (affinity !== undefined && affinity !== null) {
      yamlFields.affinity = affinity;
    }

    if (isPickN || policy.pickN) {
      const numberOfClusters = policy.pickN?.numberOfClusters ?? policy.numberOfClusters;
      if (numberOfClusters !== undefined && numberOfClusters !== null) {
        yamlFields.numberOfClusters = numberOfClusters;
      }

      const topologySpreadConstraints =
        policy.pickN?.topologySpreadConstraints ?? policy.topologySpreadConstraints;
      if (Array.isArray(topologySpreadConstraints) && topologySpreadConstraints.length > 0) {
        yamlFields.topologySpreadConstraints = topologySpreadConstraints;
      }
    }

    if (Object.keys(yamlFields).length === 0) {
      return '-';
    }

    return renderYamlSnippet(yamlFields);
  }

  return '-';
}

export function PlacementPolicyDetailsCapability({
  clusterResourcePlacementClass,
  resourcePlacementClass,
  getPlacementPolicyType,
  makePlacementStatusLabel,
  formatObjectSummary,
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
  const resourceType = isNamespaceScope ? resourcePlacementClass : clusterResourcePlacementClass;
  const detailsNamespace = isNamespaceScope ? namespace || undefined : undefined;

  return (
    <DetailsGrid
      resourceType={resourceType}
      name={placementName}
      namespace={detailsNamespace}
      extraInfo={(item: any) =>
        item && [
          {
            name: 'Scope',
            value: item.getNamespace?.() || 'Cluster',
          },
          {
            name: 'Policy',
            value: getPlacementPolicyType(item),
          },
          {
            name: 'Policy Criteria',
            value: formatPolicyDetails(item, getPlacementPolicyType),
          },
          {
            name: 'Status',
            value: makePlacementStatusLabel(item),
          },
          {
            name: 'Placement Status',
            value: (() => {
              const statusParams =
                isNamespaceScope && namespace
                  ? { scope: 'namespace', namespace, placementName }
                  : { scope: 'cluster', placementName };
              const statusRouteName =
                isNamespaceScope && namespace
                  ? 'fleet-placement-status-namespace'
                  : 'fleet-placement-status-cluster';

              return (
                <Link routeName={statusRouteName} params={statusParams}>
                  View Placement Status
                </Link>
              );
            })(),
          },
          {
            name: 'Conditions',
            value: formatConditions(item.jsonData?.status?.conditions),
          },
          {
            name: 'Labels',
            value: formatObjectSummary(item.jsonData?.metadata?.labels),
          },
          {
            name: 'Annotations',
            value: formatObjectSummary(item.jsonData?.metadata?.annotations),
          },
        ]
      }
      extraSections={(item: any) => [
        {
          id: 'fleet.resource-placement-selected-resources',
          section: (
            <SectionBox title="Selected Resources">
              <SimpleTable
                data={getResourceSelectors(item?.jsonData?.spec?.resourceSelectors)}
                columns={[
                  {
                    label: 'name',
                    getter: (selector: any) => selector?.name ?? '-',
                  },
                  {
                    label: 'kind',
                    getter: (selector: any) => selector?.kind ?? '-',
                  },
                  {
                    label: 'version',
                    getter: (selector: any) => selector?.version ?? '-',
                  },
                  {
                    label: 'group',
                    getter: (selector: any) => selector?.group ?? '-',
                  },
                  {
                    label: 'selectionScope',
                    getter: (selector: any) => selector?.selectionScope ?? '-',
                  },
                ]}
                emptyMessage="No resource selectors defined."
              />
            </SectionBox>
          ),
        },
        {
          id: 'fleet.resource-placement-conditions',
          section: (
            <SectionBox title="Conditions">
              <SimpleTable
                data={item?.jsonData?.status?.conditions ?? []}
                columns={[
                  {
                    label: 'Type',
                    getter: (condition: any) => condition?.type ?? '-',
                  },
                  {
                    label: 'Status',
                    getter: (condition: any) => condition?.status ?? '-',
                  },
                  {
                    label: 'Reason',
                    getter: (condition: any) => condition?.reason ?? '-',
                  },
                  {
                    label: 'Message',
                    getter: (condition: any) => condition?.message ?? '-',
                  },
                  {
                    label: 'Last Transition Time',
                    getter: (condition: any) => condition?.lastTransitionTime ?? '-',
                  },
                ]}
                emptyMessage="No conditions found."
              />
            </SectionBox>
          ),
        },
      ]}
    />
  );
}
