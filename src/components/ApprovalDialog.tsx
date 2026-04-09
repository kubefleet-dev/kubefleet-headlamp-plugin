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

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React from 'react';

export type ApprovalDetails = {
  name: string;
  updateRun?: string;
  stage?: string;
  position?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  details: ApprovalDetails | null;
  isSubmitting: boolean;
  error: string;
  title?: string;
};

export function ApprovalDialog({
  open,
  onClose,
  onSubmit,
  details,
  isSubmitting,
  error,
  title = 'Approve Request',
}: Props) {
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setMessage('');
    }
  }, [open]);

  const handleSubmit = async () => {
    try {
      await onSubmit(message);
    } finally {
      setMessage('');
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={1.25} mt={0.5}>
          {details?.name && (
            <Typography variant="body2">
              <strong>Request:</strong> {details.name}
            </Typography>
          )}
          {details?.updateRun && (
            <Typography variant="body2">
              <strong>Update Run:</strong> {details.updateRun}
            </Typography>
          )}
          {details?.stage && (
            <Typography variant="body2">
              <strong>Stage:</strong> {details.stage}
            </Typography>
          )}
          {details?.position && (
            <Typography variant="body2">
              <strong>Position:</strong> {details.position}
            </Typography>
          )}
          <TextField
            label="Message"
            placeholder="Enter an approval message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            multiline
            minRows={3}
            fullWidth
          />
          {error && (
            <Typography color="error" variant="body2" sx={{ whiteSpace: 'pre-line' }}>
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting || !details}
          variant="contained"
        >
          Approve
        </Button>
      </DialogActions>
    </Dialog>
  );
}
