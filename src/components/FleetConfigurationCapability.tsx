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
import { SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

type FleetClusterInfo = {
  name: string;
  server: string;
};

type Props = {
  getStoredHubCluster: () => string;
  persistHubCluster: (clusterName: string) => void;
};

function useFleetClusters() {
  const [clusters, setClusters] = useState<FleetClusterInfo[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    ApiProxy.request('/config', {}, false, false)
      .then((response: any) => {
        if (!mounted) {
          return;
        }

        const availableClusters = Array.isArray(response?.clusters)
          ? response.clusters
              .map((cluster: any) => ({
                name: typeof cluster?.name === 'string' ? cluster.name : '',
                server: typeof cluster?.server === 'string' ? cluster.server : '',
              }))
              .filter((cluster: FleetClusterInfo) => cluster.name.length > 0)
          : [];
        setClusters(availableClusters);
      })
      .catch((requestError: any) => {
        if (!mounted) {
          return;
        }

        setError(requestError?.message || 'Unable to load clusters.');
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { clusters, error };
}

export function FleetConfigurationCapability({ getStoredHubCluster, persistHubCluster }: Props) {
  const { clusters, error } = useFleetClusters();
  const [selectedHubCluster, setSelectedHubCluster] = useState(getStoredHubCluster());
  const [savedHubCluster, setSavedHubCluster] = useState(getStoredHubCluster());
  const selectedHubClusterDetails = clusters.find(cluster => cluster.name === selectedHubCluster);
  const savedHubClusterDetails = clusters.find(cluster => cluster.name === savedHubCluster);

  useEffect(() => {
    if (clusters.length === 0) {
      return;
    }

    if (savedHubCluster && clusters.some(cluster => cluster.name === savedHubCluster)) {
      setSelectedHubCluster(savedHubCluster);
      return;
    }

    const firstCluster = clusters[0].name;
    setSelectedHubCluster(firstCluster);
    if (!savedHubCluster) {
      return;
    }

    persistHubCluster(firstCluster);
    setSavedHubCluster(firstCluster);
  }, [clusters, savedHubCluster, persistHubCluster]);

  const handleSave = () => {
    persistHubCluster(selectedHubCluster);
    setSavedHubCluster(selectedHubCluster);
  };

  return (
    <SectionBox title="KubeFleet Manager Configuration">
      <Box display="grid" gap={2} maxWidth="36rem">
        <Typography>
          Select which existing Kubernetes cluster should be used as the Fleet hub cluster.
        </Typography>
        {error && <Typography color="error">Unable to load clusters: {error}</Typography>}
        <FormControl fullWidth>
          <InputLabel id="fleet-hub-cluster-label">Hub Cluster</InputLabel>
          <Select
            labelId="fleet-hub-cluster-label"
            value={selectedHubCluster}
            label="Hub Cluster"
            onChange={event => setSelectedHubCluster(String(event.target.value || ''))}
          >
            {clusters.map(cluster => (
              <MenuItem key={cluster.name} value={cluster.name}>
                <Box display="grid">
                  <Typography>{cluster.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {cluster.server || 'Server URL unavailable'}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          Selected cluster server URL: {selectedHubClusterDetails?.server || 'Unavailable'}
        </Typography>
        <Box display="flex" gap={1.5} alignItems="center">
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!selectedHubCluster || selectedHubCluster === savedHubCluster}
          >
            Save Hub Cluster
          </Button>
          <Typography variant="body2" color="text.secondary">
            Active hub cluster: {savedHubCluster || 'Not configured'}
            {savedHubCluster
              ? ` (${savedHubClusterDetails?.server || 'Server URL unavailable'})`
              : ''}
          </Typography>
        </Box>
      </Box>
    </SectionBox>
  );
}
