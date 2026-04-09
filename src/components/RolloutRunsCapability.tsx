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
  LightTooltip,
  Link,
  ResourceListView,
  SectionBox,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ApprovalDialog } from './ApprovalDialog';
import { CreateStagedUpdateRunForm } from './CreateStagedUpdateRunForm';

type StageStatusRow = {
  waitingFor: 'Approval' | 'TimedWait' | '';
  stageStatus: 'stopped' | 'completed' | 'waiting' | '';
};

type CreateFormProps = {
  clusterResourcePlacementClass?: any;
  resourcePlacementClass?: any;
  clusterStagedUpdateStrategyClass?: any;
  stagedUpdateStrategyClass?: any;
  hubCluster?: string;
};

type Props = {
  clusterRolloutRuns: any[] | null;
  rolloutRuns: any[] | null;
  createFormProps?: CreateFormProps;
  getRolloutRunScope: (item: any) => 'Cluster' | 'Namespace';
  getCurrentStageName: (item: any) => string;
  getRolloutRunStatusDisplay: (item: any) => {
    label: string;
    status: 'success' | 'warning' | 'error' | '';
    detailedStatus: string;
  };
  makeRolloutRunStatusLabel: (item: any) => React.ReactNode;
  getStageStatusRows: (item: any) => StageStatusRow[];
  updateRolloutRunState: (item: any, nextState: 'Run' | 'Stop') => Promise<void>;
  approveStageRun: (item: any, message?: string) => Promise<void>;
  getApprovalWaitingStage: (item: any) => { stageName: string; approvalRequestName: string } | null;
  getRolloutRunStatusApiPath: (item: any) => string;
};

export function RolloutRunsCapability({
  clusterRolloutRuns,
  rolloutRuns,
  createFormProps,
  getRolloutRunScope,
  getCurrentStageName,
  getRolloutRunStatusDisplay,
  makeRolloutRunStatusLabel,
  getStageStatusRows,
  updateRolloutRunState,
  approveStageRun,
  getApprovalWaitingStage,
  getRolloutRunStatusApiPath,
}: Props) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const strategyFilter = searchParams.get('strategy') || '';
  const placementFilter = searchParams.get('placement') || '';

  const [rolloutToApprove, setRolloutToApprove] = useState<any | null>(null);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalFormError, setApprovalFormError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const allRuns =
    clusterRolloutRuns && rolloutRuns ? [...clusterRolloutRuns, ...rolloutRuns] : null;
  const filteredByStrategy =
    allRuns && strategyFilter
      ? allRuns.filter(
          (item: any) => (item.jsonData?.spec?.stagedRolloutStrategyName ?? '') === strategyFilter
        )
      : allRuns;
  const mergedRolloutRuns =
    filteredByStrategy && placementFilter
      ? filteredByStrategy.filter(
          (item: any) => (item.jsonData?.spec?.placementName ?? '') === placementFilter
        )
      : filteredByStrategy;

  return (
    <>
      {strategyFilter && (
        <SectionBox title="Active Filter">
          <Typography variant="body2">
            Showing only staged rollout runs using strategy <strong>{strategyFilter}</strong>.
          </Typography>
          <Box mt={1}>
            <Link routeName="fleet-rollout-runs">Clear filter</Link>
          </Box>
        </SectionBox>
      )}
      {placementFilter && (
        <SectionBox title="Active Filter">
          <Typography variant="body2">
            Showing only staged rollout runs for placement <strong>{placementFilter}</strong>.
          </Typography>
          <Box mt={1}>
            <Link routeName="fleet-rollout-runs">Clear filter</Link>
          </Box>
        </SectionBox>
      )}
      <ResourceListView
        title="Staged Rollout Runs"
        data={mergedRolloutRuns}
        headerProps={
          createFormProps
            ? {
                titleSideActions: [
                  <Tooltip key="create" title="Create Staged Rollout Run">
                    <IconButton
                      aria-label="Create Staged Rollout Run"
                      size="medium"
                      onClick={() => setIsCreateOpen(true)}
                    >
                      <Icon icon="mdi:plus-circle" color="primary" />
                    </IconButton>
                  </Tooltip>,
                ],
              }
            : undefined
        }
        columns={[
          {
            label: 'Run Name',
            getValue: (item: any) => item.getName(),
            render: (item: any) => {
              const scope = getRolloutRunScope(item);
              const name = item.getName();
              const namespace = item.getNamespace?.();
              const params =
                scope === 'Namespace' && namespace
                  ? { scope: 'namespace', namespace, runName: name }
                  : { scope: 'cluster', runName: name };
              const routeName =
                scope === 'Namespace' && namespace
                  ? 'fleet-rollout-run-details-namespace'
                  : 'fleet-rollout-run-details-cluster';

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
            label: 'Placement',
            getValue: (item: any) => item.jsonData?.spec?.placementName ?? '-',
            render: (item: any) => {
              const placementName = item.jsonData?.spec?.placementName;
              if (!placementName) {
                return '-';
              }

              return (
                <Link
                  routeName="fleet-placement-policy-details-cluster"
                  params={{ scope: 'cluster', placementName }}
                >
                  {placementName}
                </Link>
              );
            },
          },
          {
            label: 'Strategy',
            getValue: (item: any) => item.jsonData?.spec?.stagedRolloutStrategyName ?? '-',
            render: (item: any) => {
              const strategyName = item.jsonData?.spec?.stagedRolloutStrategyName;

              if (!strategyName) {
                return '-';
              }

              return (
                <LightTooltip title="Opens rollout strategy details" interactive>
                  <span>
                    <Link routeName="fleet-rollout-strategy-details" params={{ strategyName }}>
                      {strategyName}
                    </Link>
                  </span>
                </LightTooltip>
              );
            },
          },
          {
            label: 'Current Stage',
            getValue: (item: any) => getCurrentStageName(item),
            render: (item: any) => {
              const statusDisplay = getRolloutRunStatusDisplay(item);
              if (
                statusDisplay.label === 'Completed' ||
                statusDisplay.label === 'Not Initialized'
              ) {
                return '-';
              }
              return getCurrentStageName(item);
            },
          },
          {
            label: 'Status',
            getValue: (item: any) => getRolloutRunStatusDisplay(item).label,
            render: (item: any) => makeRolloutRunStatusLabel(item),
          },
          {
            label: 'Waiting For',
            getValue: (item: any) => {
              const waitingRow = getStageStatusRows(item).find(r => r.stageStatus === 'waiting');
              return waitingRow?.waitingFor || '-';
            },
            render: (item: any) => {
              const waitingRow = getStageStatusRows(item).find(r => r.stageStatus === 'waiting');
              const taskType = waitingRow?.waitingFor;
              if (!taskType) {
                return '-';
              }
              const icon = taskType === 'Approval' ? 'mdi:account-check-outline' : 'mdi:timer-sand';
              return (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Icon icon={icon} width="1.1rem" height="1.1rem" />
                  {taskType}
                </Box>
              );
            },
          },
          'age',
        ]}
        actions={[
          {
            id: 'start',
            action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
              const runName = item.getName();
              const statusLabel = getRolloutRunStatusDisplay(item).label;
              const isCompleted =
                statusLabel === 'Completed' ||
                statusLabel === 'Not Initialized' ||
                statusLabel === 'Blocked';

              const handleStateUpdate = async () => {
                closeMenu();

                try {
                  await updateRolloutRunState(item, 'Run');
                  window.location.reload();
                } catch (error: any) {
                  window.alert(error?.message || `Unable to set ${runName} to Run.`);
                }
              };

              return (
                <MenuItem
                  key="start"
                  disabled={isCompleted}
                  onClick={() => void handleStateUpdate()}
                >
                  <ListItemIcon>
                    <Icon icon="mdi:play" />
                  </ListItemIcon>
                  <ListItemText>Start</ListItemText>
                </MenuItem>
              );
            },
          },
          {
            id: 'stop',
            action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
              const runName = item.getName();
              const statusLabel = getRolloutRunStatusDisplay(item).label;
              const isCompleted =
                statusLabel === 'Completed' ||
                statusLabel === 'Not Initialized' ||
                statusLabel === 'Blocked';

              const handleStateUpdate = async () => {
                closeMenu();

                try {
                  await updateRolloutRunState(item, 'Stop');
                  window.location.reload();
                } catch (error: any) {
                  window.alert(error?.message || `Unable to set ${runName} to Stop.`);
                }
              };

              return (
                <MenuItem
                  key="stop"
                  disabled={isCompleted}
                  onClick={() => void handleStateUpdate()}
                >
                  <ListItemIcon>
                    <Icon icon="mdi:stop" />
                  </ListItemIcon>
                  <ListItemText>Stop</ListItemText>
                </MenuItem>
              );
            },
          },
          {
            id: 'approve',
            action: ({ item, closeMenu }: { item: any; closeMenu: () => void }) => {
              const approvalInfo = getApprovalWaitingStage(item);
              const statusLabel = getRolloutRunStatusDisplay(item).label;
              const canApprove =
                approvalInfo !== null &&
                statusLabel !== 'Not Initialized' &&
                statusLabel !== 'Blocked';

              const handleOpenApprovalForm = () => {
                closeMenu();
                setApprovalFormError('');
                setRolloutToApprove(item);
              };

              return (
                <MenuItem key="approve" disabled={!canApprove} onClick={handleOpenApprovalForm}>
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

      {rolloutToApprove && (
        <ApprovalDialog
          open={Boolean(rolloutToApprove)}
          onClose={() => {
            if (!isSubmittingApproval) {
              setRolloutToApprove(null);
              setApprovalFormError('');
            }
          }}
          onSubmit={async (message: string) => {
            if (!rolloutToApprove) return;

            setApprovalFormError('');
            setIsSubmittingApproval(true);

            try {
              await approveStageRun(rolloutToApprove, message);
              window.location.reload();
            } catch (error: any) {
              const statusPath = getRolloutRunStatusApiPath(rolloutToApprove);
              const clusterName = rolloutToApprove?.cluster ?? 'current';
              const errorMessage = error?.message || 'Unable to approve stage.';

              setApprovalFormError(
                `${errorMessage}\nPath: ${statusPath}\nCluster: ${String(clusterName)}`
              );
            } finally {
              setIsSubmittingApproval(false);
            }
          }}
          details={
            rolloutToApprove
              ? {
                  name: rolloutToApprove.getName() ?? '',
                  stage: getCurrentStageName(rolloutToApprove) ?? undefined,
                  updateRun: rolloutToApprove.getName() ?? undefined,
                }
              : null
          }
          isSubmitting={isSubmittingApproval}
          error={approvalFormError}
          title="Approve Stage"
        />
      )}

      {createFormProps && (
        <CreateStagedUpdateRunForm
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          clusterResourcePlacementClass={createFormProps.clusterResourcePlacementClass}
          resourcePlacementClass={createFormProps.resourcePlacementClass}
          clusterStagedUpdateStrategyClass={createFormProps.clusterStagedUpdateStrategyClass}
          stagedUpdateStrategyClass={createFormProps.stagedUpdateStrategyClass}
          hubCluster={createFormProps.hubCluster}
        />
      )}
    </>
  );
}
