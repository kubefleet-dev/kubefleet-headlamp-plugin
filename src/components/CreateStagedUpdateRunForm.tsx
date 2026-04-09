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

import { ApiProxy, K8s } from '@kinvolk/headlamp-plugin/lib';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import * as yaml from 'js-yaml';
import { useCallback, useEffect, useState } from 'react';

type Scope = 'Cluster' | 'Namespace';

type Props = {
  open: boolean;
  clusterResourcePlacementClass?: any;
  resourcePlacementClass?: any;
  clusterStagedUpdateStrategyClass?: any;
  stagedUpdateStrategyClass?: any;
  clusterStagedUpdateRunClass?: any;
  stagedUpdateRunClass?: any;
  hubCluster?: string;
  defaultNamespace?: string;
  onClose?: () => void;
};

export function CreateStagedUpdateRunForm({
  open,
  clusterResourcePlacementClass,
  resourcePlacementClass,
  clusterStagedUpdateStrategyClass,
  stagedUpdateStrategyClass,
  hubCluster = '',
  defaultNamespace = 'default',
  onClose,
}: Props) {
  const [scope, setScope] = useState<Scope>('Cluster');
  const [selectedPlacement, setSelectedPlacement] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [startImmediately, setStartImmediately] = useState(false);
  const [namespace, setNamespace] = useState(defaultNamespace);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showYaml, setShowYaml] = useState(false);
  const [generatedYaml, setGeneratedYaml] = useState('');

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) {
      setScope('Cluster');
      setSelectedPlacement('');
      setSelectedStrategy('');
      setStartImmediately(false);
      setNamespace(defaultNamespace);
      setError('');
      setSuccess('');
      setShowYaml(false);
      setGeneratedYaml('');
    }
  }, [open, defaultNamespace]);

  // Fetch all resources unconditionally
  const [clusterPlacements] = clusterResourcePlacementClass?.useList?.() ?? [];
  const [namespacedPlacements] = resourcePlacementClass?.useList?.(namespace) ?? [];

  const [clusterStrategies] = clusterStagedUpdateStrategyClass?.useList?.() ?? [];
  const [namespacedStrategies] = stagedUpdateStrategyClass?.useList?.(namespace) ?? [];

  // Fetch namespaces for namespace-scoped selection
  const [namespaces] = K8s.ResourceClasses.Namespace.useList();
  const availableNamespaces = namespaces?.map(ns => ns.getName()) ?? [];

  // Filter placements based on scope
  const placements = scope === 'Cluster' ? clusterPlacements ?? [] : namespacedPlacements ?? [];

  // Filter strategies based on scope
  const strategies = scope === 'Cluster' ? clusterStrategies ?? [] : namespacedStrategies ?? [];

  const generateResource = useCallback((): any => {
    const resource: any = {
      apiVersion: 'placement.kubernetes-fleet.io/v1',
      kind: scope === 'Cluster' ? 'ClusterStagedUpdateRun' : 'StagedUpdateRun',
      metadata: {
        name: `staged-rollout-${Date.now()}`,
        ...(scope === 'Namespace' && { namespace }),
      },
      spec: {
        stagedRolloutStrategyName: selectedStrategy,
        placementName: selectedPlacement,
        state: startImmediately ? 'Run' : 'Initialize',
      },
    };

    return resource;
  }, [scope, selectedStrategy, selectedPlacement, startImmediately, namespace]);

  const handleGenerateYaml = useCallback(() => {
    if (!selectedPlacement) {
      setError('Please select a Placement');
      return;
    }
    if (!selectedStrategy) {
      setError('Please select a Strategy');
      return;
    }

    const resource = generateResource();
    const yamlString = yaml.dump(resource, { indent: 2 });
    setGeneratedYaml(yamlString);
    setShowYaml(true);
    setError('');
  }, [selectedPlacement, selectedStrategy, generateResource]);

  const handleApply = useCallback(async () => {
    try {
      setError('');
      setSuccess('');

      if (!selectedPlacement) {
        setError('Please select a Placement');
        return;
      }
      if (!selectedStrategy) {
        setError('Please select a Strategy');
        return;
      }

      setIsLoading(true);
      const resource = generateResource();

      // Determine the API path based on scope
      const apiPath =
        scope === 'Cluster'
          ? `/clusters/${encodeURIComponent(
              hubCluster
            )}/apis/placement.kubernetes-fleet.io/v1/clusterstagedupdateruns`
          : `/clusters/${encodeURIComponent(
              hubCluster
            )}/apis/placement.kubernetes-fleet.io/v1/namespaces/${encodeURIComponent(
              namespace
            )}/stagedupdateruns`;

      // Try POST first to create the resource
      try {
        await ApiProxy.request(
          apiPath,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(resource),
          },
          false,
          false
        );

        setSuccess(`${resource.kind} "${resource.metadata.name}" created successfully!`);
        setSelectedPlacement('');
        setSelectedStrategy('');
        setStartImmediately(false);
        setGeneratedYaml('');
        setShowYaml(false);
        onClose?.();
      } catch (createError: any) {
        // If we get a conflict, try applying with PUT
        if (createError?.status === 409) {
          // For apply-like behavior on conflict, we can try PUT, but for creation we'd typically fail here
          throw new Error(
            `Resource already exists. Please use a different name or delete the existing resource first.`
          );
        }
        throw createError;
      }
    } catch (err: any) {
      const errorMessage =
        err?.message ||
        err?.response?.message ||
        (typeof err === 'string' ? err : 'Failed to create resource');
      setError(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlacement, selectedStrategy, scope, namespace, generateResource, hubCluster]);

  const placementList = placements?.filter((p: any) => p?.metadata?.name) ?? [];
  const strategyList = strategies?.filter((s: any) => s?.metadata?.name) ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Staged Rollout Run</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            pt: 1,
          }}
        >
          {/* Error Alert */}
          {error && <Alert severity="error">{error}</Alert>}

          {/* Success Alert */}
          {success && <Alert severity="success">{success}</Alert>}

          {/* Scope Selection */}
          <TextField
            select
            label="Scope"
            value={scope}
            onChange={e => {
              setScope(e.target.value as Scope);
              setSelectedPlacement('');
              setSelectedStrategy('');
              setError('');
            }}
            fullWidth
            size="small"
          >
            <MenuItem value="Cluster">Cluster</MenuItem>
            <MenuItem value="Namespace">Namespace</MenuItem>
          </TextField>

          {/* Namespace Selection (only for Namespace scope) */}
          {scope === 'Namespace' && (
            <TextField
              select
              label="Namespace"
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              fullWidth
              size="small"
            >
              {availableNamespaces.map(ns => (
                <MenuItem key={ns} value={ns}>
                  {ns}
                </MenuItem>
              ))}
            </TextField>
          )}

          {/* Placement Selection */}
          <TextField
            select
            label="Resource Placement"
            value={selectedPlacement}
            onChange={e => {
              setSelectedPlacement(e.target.value);
              setError('');
            }}
            fullWidth
            size="small"
            disabled={placementList.length === 0}
            helperText={
              placementList.length === 0
                ? `No ${scope === 'Cluster' ? 'Cluster' : ''}ResourcePlacements available`
                : ''
            }
          >
            {placementList.map((placement: any) => (
              <MenuItem key={placement.metadata?.uid} value={placement.metadata?.name}>
                {placement.metadata?.name}
              </MenuItem>
            ))}
          </TextField>

          {/* Strategy Selection */}
          <TextField
            select
            label="Staged Rollout Strategy"
            value={selectedStrategy}
            onChange={e => {
              setSelectedStrategy(e.target.value);
              setError('');
            }}
            fullWidth
            size="small"
            disabled={strategyList.length === 0}
            helperText={
              strategyList.length === 0
                ? `No ${scope === 'Cluster' ? 'Cluster' : ''}StagedUpdateStrategies available`
                : ''
            }
          >
            {strategyList.map((strategy: any) => (
              <MenuItem key={strategy.metadata?.uid} value={strategy.metadata?.name}>
                {strategy.metadata?.name}
              </MenuItem>
            ))}
          </TextField>

          {/* Start Immediately Checkbox */}
          <FormControlLabel
            control={
              <Checkbox
                checked={startImmediately}
                onChange={e => setStartImmediately(e.target.checked)}
              />
            }
            label="Start immediately (set state to Run, otherwise Initialize)"
          />

          {/* YAML Preview */}
          {showYaml && generatedYaml && (
            <Box
              sx={{
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: 1,
                p: 2,
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                maxHeight: 300,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {generatedYaml}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          onClick={handleGenerateYaml}
          disabled={isLoading || !selectedPlacement || !selectedStrategy}
        >
          Generate YAML
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => void handleApply()}
          disabled={isLoading || !selectedPlacement || !selectedStrategy}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Apply'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
