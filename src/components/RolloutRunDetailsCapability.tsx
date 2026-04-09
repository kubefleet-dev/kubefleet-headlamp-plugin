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
  DetailsGrid,
  LightTooltip,
  SectionBox,
  SimpleTable,
  StatusLabel,
  Table,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

type StageStatusRow = {
  id: string;
  stageName: string;
  selectedClusters: string[];
  clusterStates: Record<string, 'in-progress' | 'completed' | 'failed' | 'unknown'>;
  isProgressing: boolean;
  stageStatus: 'stopped' | 'completed' | 'waiting' | '';
  stageStatusMessage: string;
  waitingFor: 'Approval' | 'TimedWait' | '';
  approvalRequestName: string;
};

type Props = {
  stagedUpdateRunClass: any;
  clusterStagedUpdateRunClass: any;
  getRolloutRunScope: (item: any) => 'Cluster' | 'Namespace';
  getCurrentStageName: (item: any) => string;
  getRolloutRunStatusDisplay: (item: any) => {
    label: string;
    status: 'success' | 'warning' | 'error' | '';
    detailedStatus: string;
  };
  makeRolloutRunStatusLabel: (item: any) => React.ReactNode;
  formatObjectSummary: (data: Record<string, any> | undefined) => string;
  getStageStatusRows: (item: any) => StageStatusRow[];
  updateStagedUpdateRunState: (
    item: any,
    stageName: string,
    nextState: 'Run' | 'Stop'
  ) => Promise<void>;
  approveStageByName: (item: any, stageName: string, approvalRequestName: string) => Promise<void>;
};

export function RolloutRunDetailsCapability({
  stagedUpdateRunClass,
  clusterStagedUpdateRunClass,
  getRolloutRunScope,
  getCurrentStageName,
  getRolloutRunStatusDisplay,
  makeRolloutRunStatusLabel,
  formatObjectSummary,
  getStageStatusRows,
  updateStagedUpdateRunState,
  approveStageByName,
}: Props) {
  const {
    scope = '',
    runName = '',
    namespace = '',
  } = useParams<{
    scope: string;
    runName: string;
    namespace?: string;
  }>();
  const isNamespaceScope = scope === 'namespace';
  const resourceType = isNamespaceScope ? stagedUpdateRunClass : clusterStagedUpdateRunClass;
  const detailsNamespace = isNamespaceScope ? namespace || undefined : undefined;

  const getRolloutRunStrategyName = (item: any): string =>
    item?.jsonData?.spec?.stagedRolloutStrategyName ??
    item?.jsonData?.spec?.stagedUpdateStrategyName ??
    item?.jsonData?.spec?.stagedUpdateStrategySnapshot?.name ??
    '-';

  return (
    <DetailsGrid
      resourceType={resourceType}
      name={runName}
      namespace={detailsNamespace}
      extraInfo={(item: any) =>
        item && [
          {
            name: 'Scope',
            value: getRolloutRunScope(item) === 'Namespace' ? item.getNamespace?.() : 'Cluster',
          },
          {
            name: 'Placement',
            value: item.jsonData?.spec?.placementName ?? '-',
          },
          {
            name: 'Strategy',
            value: getRolloutRunStrategyName(item),
          },
          {
            name: 'Current Stage',
            value:
              getRolloutRunStatusDisplay(item).label === 'Completed' ||
              getRolloutRunStatusDisplay(item).label === 'Not Initialized'
                ? '-'
                : getCurrentStageName(item),
          },
          {
            name: 'Status',
            value: makeRolloutRunStatusLabel(item),
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
          id: 'fleet.rollout-run-conditions',
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
        {
          id: 'fleet.rollout-run-stage-status',
          section: (
            <SectionBox title="Stage Status">
              <Table<StageStatusRow>
                data={getStageStatusRows(item)}
                getRowId={stage => stage.id}
                enableSorting={false}
                enableTopToolbar={false}
                enableBottomToolbar={false}
                columns={[
                  {
                    id: 'stageName',
                    header: 'Stage',
                    accessorFn: stage => stage.stageName,
                    muiTableBodyCellProps: ({ row }) => ({
                      sx: {
                        backgroundColor: row.original.isProgressing
                          ? 'rgba(13, 71, 161, 0.12)'
                          : undefined,
                        borderLeft: row.original.isProgressing ? `3px solid #0d47a1` : undefined,
                      },
                    }),
                  },
                  {
                    id: 'status',
                    header: 'Status',
                    accessorFn: stage => stage.stageStatus || '-',
                    Cell: ({ row }) => {
                      const stage = row.original;

                      if (stage.stageStatus === 'stopped') {
                        return (
                          <LightTooltip
                            title={stage.stageStatusMessage || 'Stage update stopped'}
                            interactive
                          >
                            <Box display="inline">
                              <StatusLabel status="warning">Stopped</StatusLabel>
                            </Box>
                          </LightTooltip>
                        );
                      }

                      if (stage.stageStatus === 'completed') {
                        return (
                          <LightTooltip
                            title={
                              stage.stageStatusMessage || 'Stage update completed successfully'
                            }
                            interactive
                          >
                            <Box display="inline">
                              <StatusLabel status="success">Completed</StatusLabel>
                            </Box>
                          </LightTooltip>
                        );
                      }

                      if (stage.stageStatus === 'waiting') {
                        return (
                          <LightTooltip
                            title={stage.stageStatusMessage || 'Stage is waiting'}
                            interactive
                          >
                            <Box
                              component="span"
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                px: '8px',
                                py: '4px',
                                borderRadius: '4px',
                                border: '1px solid transparent',
                                backgroundColor: '#e65100',
                                color: '#fff',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                              }}
                            >
                              <Icon icon="mdi:timer-sand" width="1.1rem" height="1.1rem" />
                              Waiting
                            </Box>
                          </LightTooltip>
                        );
                      }

                      return '-';
                    },
                    muiTableBodyCellProps: ({ row }) => ({
                      sx: {
                        backgroundColor: row.original.isProgressing
                          ? 'rgba(13, 71, 161, 0.12)'
                          : undefined,
                      },
                    }),
                  },
                  {
                    id: 'waitingFor',
                    header: 'Waiting For',
                    accessorFn: stage => stage.waitingFor || '-',
                    Cell: ({ row }) => {
                      const { waitingFor } = row.original;
                      if (!waitingFor) {
                        return '-';
                      }
                      const icon =
                        waitingFor === 'Approval' ? 'mdi:account-check-outline' : 'mdi:timer-sand';
                      return (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Icon icon={icon} width="1.1rem" height="1.1rem" />
                          {waitingFor}
                        </Box>
                      );
                    },
                    muiTableBodyCellProps: ({ row }) => ({
                      sx: {
                        backgroundColor: row.original.isProgressing
                          ? 'rgba(13, 71, 161, 0.12)'
                          : undefined,
                      },
                    }),
                  },
                  {
                    id: 'selectedClusters',
                    header: 'Selected Clusters',
                    accessorFn: stage => stage.selectedClusters.join(', '),
                    Cell: ({ row }) => {
                      const stage = row.original;

                      if (
                        !Array.isArray(stage.selectedClusters) ||
                        stage.selectedClusters.length === 0
                      ) {
                        return '-';
                      }

                      return (
                        <Box display="flex" flexWrap="wrap" gap={0.5} py={0.25}>
                          {stage.selectedClusters.map(clusterName =>
                            (() => {
                              const clusterState = stage.clusterStates[clusterName] ?? 'unknown';
                              const chipLabel =
                                clusterState === 'in-progress'
                                  ? `${clusterName} (In progress)`
                                  : clusterState === 'completed'
                                  ? `${clusterName} (Completed)`
                                  : clusterState === 'failed'
                                  ? `${clusterName} (Failed)`
                                  : clusterName;

                              return (
                                <Chip
                                  key={`${stage.stageName}-${clusterName}`}
                                  label={chipLabel}
                                  size="small"
                                  variant={clusterState === 'unknown' ? 'outlined' : 'filled'}
                                  sx={
                                    clusterState === 'in-progress'
                                      ? {
                                          backgroundColor: '#0d47a1',
                                          color: '#fff',
                                        }
                                      : clusterState === 'completed'
                                      ? {
                                          backgroundColor: '#2e7d32',
                                          color: '#fff',
                                        }
                                      : clusterState === 'failed'
                                      ? {
                                          backgroundColor: '#d32f2f',
                                          color: '#fff',
                                        }
                                      : undefined
                                  }
                                />
                              );
                            })()
                          )}
                        </Box>
                      );
                    },
                    muiTableBodyCellProps: ({ row }) => ({
                      sx: {
                        backgroundColor: row.original.isProgressing
                          ? 'rgba(13, 71, 161, 0.12)'
                          : undefined,
                        borderRight: row.original.isProgressing ? `1px solid #5e92f3` : undefined,
                      },
                    }),
                  },
                  {
                    id: 'actions',
                    header: 'Actions',
                    accessorFn: () => '',
                    Cell: ({ row }) => {
                      const stage = row.original;
                      const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

                      const handleMenuOpen = (event: any) => {
                        setAnchorEl(event.currentTarget);
                      };

                      const handleMenuClose = () => {
                        setAnchorEl(null);
                      };

                      const handleStart = async () => {
                        handleMenuClose();
                        try {
                          await updateStagedUpdateRunState(item, stage.stageName, 'Run');
                          window.location.reload();
                        } catch (error: any) {
                          window.alert(
                            error?.message || `Unable to start stage ${stage.stageName}.`
                          );
                        }
                      };

                      const handleStop = async () => {
                        handleMenuClose();
                        try {
                          await updateStagedUpdateRunState(item, stage.stageName, 'Stop');
                          window.location.reload();
                        } catch (error: any) {
                          window.alert(
                            error?.message || `Unable to stop stage ${stage.stageName}.`
                          );
                        }
                      };

                      const approvalRequestName = stage.approvalRequestName || null;
                      const canApprove = !!approvalRequestName;

                      const handleApprove = async () => {
                        handleMenuClose();
                        try {
                          await approveStageByName(item, stage.stageName, approvalRequestName!);
                          window.location.reload();
                        } catch (error: any) {
                          window.alert(
                            error?.message || `Unable to approve stage ${stage.stageName}.`
                          );
                        }
                      };

                      return (
                        <>
                          <IconButton
                            size="small"
                            onClick={handleMenuOpen}
                            aria-label="stage actions"
                          >
                            <Icon icon="mdi:dots-vertical" />
                          </IconButton>
                          <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                          >
                            <MenuItem onClick={() => void handleStart()}>
                              <ListItemIcon>
                                <Icon icon="mdi:play" />
                              </ListItemIcon>
                              <ListItemText>Start</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => void handleStop()}>
                              <ListItemIcon>
                                <Icon icon="mdi:stop" />
                              </ListItemIcon>
                              <ListItemText>Stop</ListItemText>
                            </MenuItem>
                            <MenuItem disabled={!canApprove} onClick={() => void handleApprove()}>
                              <ListItemIcon>
                                <Icon icon="mdi:account-check-outline" />
                              </ListItemIcon>
                              <ListItemText>Approve</ListItemText>
                            </MenuItem>
                          </Menu>
                        </>
                      );
                    },
                  },
                ]}
                emptyMessage="No stage status found."
              />
            </SectionBox>
          ),
        },
      ]}
    />
  );
}
