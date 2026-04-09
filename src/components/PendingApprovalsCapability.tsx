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
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { Link, ResourceListView, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { ApprovalDialog } from './ApprovalDialog';

type Props = {
  clusterApprovalRequests: any[] | null;
  approvalRequests: any[] | null;
};

/**
 * Checks if an approval request is approved
 */
function isApprovalApproved(item: any): boolean {
  const conditions = item?.jsonData?.status?.conditions ?? [];
  const approvedCondition = conditions.find((c: any) => c.type === 'Approved');
  return approvedCondition?.status === 'True';
}

/**
 * Gets the stage name that this approval is aligned with
 */
function getApprovalStage(item: any): string {
  return item?.jsonData?.spec?.targetStage ?? '-';
}

/**
 * Gets the update run name that this approval is associated with
 */
function getApprovalUpdateRunName(item: any): string {
  return item?.jsonData?.spec?.parentStageRollout ?? '-';
}

/**
 * Gets the position (Before/After stage) from the kubernetes-fleet.io/taskType label
 */
function getApprovalPosition(item: any): 'Before' | 'After' | '-' {
  const taskType = item?.jsonData?.metadata?.labels?.['kubernetes-fleet.io/taskType'];
  if (taskType === 'beforeStage') return 'Before';
  if (taskType === 'afterStage') return 'After';
  return '-';
}

/**
 * Gets the update run scope (Cluster or Namespace)
 */
function getApprovalUpdateRunScope(item: any): 'Cluster' | 'Namespace' {
  const namespace = item?.getNamespace?.();
  return namespace ? 'Namespace' : 'Cluster';
}

function getApprovalStatusApiPath(item: any): string {
  const namespace = item?.getNamespace?.();
  const plural = namespace ? 'approvalrequests' : 'clusterapprovalrequests';
  const basePath = `/apis/placement.kubernetes-fleet.io/v1`;
  const resourcePath = namespace
    ? `${basePath}/namespaces/${encodeURIComponent(namespace)}/${plural}/${encodeURIComponent(
        item.getName()
      )}`
    : `${basePath}/${plural}/${encodeURIComponent(item.getName())}`;

  return `${resourcePath}/status`;
}

async function approveApprovalRequest(item: any, message: string): Promise<void> {
  const statusPath = getApprovalStatusApiPath(item);
  const lastTransitionTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const conditionMessage = message.trim() || 'ApprovedByUser';
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

  await ApiProxy.request(statusPath, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/merge-patch+json' },
    cluster: item?.cluster ?? null,
    body: JSON.stringify(patchBody),
  });
}

export function PendingApprovalsCapability({ clusterApprovalRequests, approvalRequests }: Props) {
  const [showApproved, setShowApproved] = useState(false);
  const [approvalToApprove, setApprovalToApprove] = useState<any | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalFormError, setApprovalFormError] = useState('');

  // Combine cluster and namespace-scoped approval requests
  const allApprovals =
    clusterApprovalRequests && approvalRequests
      ? [...clusterApprovalRequests, ...approvalRequests]
      : null;

  // Filter based on approval status
  const filteredApprovals = allApprovals
    ? allApprovals.filter(item => showApproved || !isApprovalApproved(item))
    : null;

  const closeApprovalForm = () => {
    if (isSubmittingApproval) {
      return;
    }

    setApprovalToApprove(null);
    setApprovalFormError('');
  };

  const handleApprovalSubmit = async (message: string) => {
    if (!approvalToApprove) {
      return;
    }

    setApprovalFormError('');
    setIsSubmittingApproval(true);

    try {
      await approveApprovalRequest(approvalToApprove, message);
      window.location.reload();
    } catch (error: any) {
      const statusPath = getApprovalStatusApiPath(approvalToApprove);
      const clusterName = approvalToApprove?.cluster ?? 'current';
      const errorMessage =
        error?.message ||
        `Unable to approve ${String(approvalToApprove?.getName?.() ?? 'request')}.`;

      setApprovalFormError(`${errorMessage}\nPath: ${statusPath}\nCluster: ${String(clusterName)}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  return (
    <>
      <SectionBox title="Pending Approvals">
        <Box display="flex" alignItems="center" justifyContent="flex-end" mb={1}>
          <FormControlLabel
            control={
              <Switch
                checked={showApproved}
                onChange={e => setShowApproved(e.target.checked)}
                size="small"
              />
            }
            label="Show Approved"
          />
        </Box>
        {!allApprovals ? (
          <Typography>Loading approval requests...</Typography>
        ) : allApprovals.length === 0 ? (
          <Typography>No approval requests found on the cluster.</Typography>
        ) : filteredApprovals?.length === 0 ? (
          <Typography>
            {showApproved
              ? 'No approved approval requests found.'
              : 'No pending approval requests found. All approvals have been processed.'}
          </Typography>
        ) : (
          <ResourceListView
            title=""
            data={filteredApprovals}
            columns={[
              {
                label: 'Name',
                getValue: (item: any) => item.getName(),
                render: (item: any) => {
                  const name = item.getName();
                  const isApproved = isApprovalApproved(item);

                  return (
                    <Box display="flex" alignItems="center" gap={1}>
                      <span>{name}</span>
                      {isApproved && (
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#4caf50',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          APPROVED
                        </Box>
                      )}
                    </Box>
                  );
                },
              },
              {
                label: 'Update Run',
                getValue: (item: any) => getApprovalUpdateRunName(item),
                render: (item: any) => {
                  const runName = getApprovalUpdateRunName(item);
                  const scope = getApprovalUpdateRunScope(item);
                  const namespace = item.getNamespace?.();

                  if (runName === '-') {
                    return '-';
                  }

                  const params =
                    scope === 'Namespace' && namespace
                      ? { scope: 'namespace', namespace, runName }
                      : { scope: 'cluster', runName };
                  const routeName =
                    scope === 'Namespace' && namespace
                      ? 'fleet-rollout-run-details-namespace'
                      : 'fleet-rollout-run-details-cluster';

                  return (
                    <Link routeName={routeName} params={params}>
                      {runName}
                    </Link>
                  );
                },
              },
              {
                label: 'Stage',
                getValue: (item: any) => getApprovalStage(item),
              },
              {
                label: 'Position',
                getValue: (item: any) => getApprovalPosition(item),
              },
              {
                label: 'Scope',
                getValue: (item: any) => getApprovalUpdateRunScope(item),
                render: (item: any) => {
                  const scope = getApprovalUpdateRunScope(item);
                  const namespace = item.getNamespace?.();

                  if (scope === 'Namespace' && namespace) {
                    return (
                      <Link
                        routeName="namespace"
                        params={{ name: namespace }}
                        activeCluster={item.cluster}
                      >
                        {namespace}
                      </Link>
                    );
                  }

                  return scope;
                },
              },
              'age',
            ]}
            actions={[
              {
                id: 'approve',
                action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
                  const canApprove = !isApprovalApproved(item);

                  const openApproveForm = () => {
                    closeMenu();
                    setApprovalFormError('');
                    setApprovalToApprove(item);
                  };

                  return (
                    <MenuItem key="approve" disabled={!canApprove} onClick={openApproveForm}>
                      <ListItemIcon>
                        <Icon icon="mdi:account-check-outline" />
                      </ListItemIcon>
                      <ListItemText>Approve</ListItemText>
                    </MenuItem>
                  );
                },
              },
            ]}
          />
        )}
      </SectionBox>

      <ApprovalDialog
        open={Boolean(approvalToApprove)}
        onClose={closeApprovalForm}
        onSubmit={handleApprovalSubmit}
        details={{
          name: approvalToApprove?.getName?.() ?? '',
          updateRun: approvalToApprove ? getApprovalUpdateRunName(approvalToApprove) : undefined,
          stage: approvalToApprove ? getApprovalStage(approvalToApprove) : undefined,
          position: approvalToApprove ? getApprovalPosition(approvalToApprove) : undefined,
        }}
        isSubmitting={isSubmittingApproval}
        error={approvalFormError}
        title="Approve Pending Approval"
      />
    </>
  );
}
