import React, { useState } from 'react';
import {
  Container,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stack,
  Box
} from '@mui/material';

import {
  WalletClient,
  AuthFetch
} from '@bsv/sdk';

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

export default function App() {
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const handleLogEvent = async () => {
    setStatus('Logging...');
    try {
      const wallet = new WalletClient('json-api', 'localhost');
      const authFetch = new AuthFetch(wallet);

      const response = await authFetch.fetch(`${SERVER_URL}/log-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventData: { message } })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
        setStatus(`Logged with txid: ${data.txid}`);
        setMessage('');
    } catch (error: any) {
      setStatus(`Failed: ${error.message || error}`);
    }
  };

  const handleRetrieveLogs = async () => {
    setStatus('Fetching logs...');
    try {
      const wallet = new WalletClient('json-api', 'localhost');
      const authFetch = new AuthFetch(wallet);
      
      const response = await authFetch.fetch(`${SERVER_URL}/retrieve-logs`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data.logs)) {
        setLogs(data.logs.map((log: any) =>
        `${log.timestamp} - ${log.message} - txid: ${log.txid}`
      ));
        setStatus('Logs retrieved');
      } else {
        setStatus('Failed to retrieve logs');
      }
    } catch (error: any) {
      setStatus(`Error retrieving logs: ${error. mesage || error}`);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={4} alignItems="center">
        <Typography variant="h4" fontWeight="bold" align="center">
          Lab L-12: Event Logger
        </Typography>
        <TextField
          fullWidth
          label="Enter an event message"
          variant="outlined"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <Stack direction="row" spacing={2}>
          <Button variant="contained" color="primary" onClick={handleLogEvent}>
            Log Event
          </Button>
          <Button variant="contained" color="success" onClick={handleRetrieveLogs}>
            Retrieve Logs
          </Button>
        </Stack>
        {status && (
          <Typography variant="body2" color="text.secondary" align="center">
            {status}
          </Typography>
        )}
        <Card sx={{ width: '100%', maxWidth: '1000px', overflowX: 'auto', bgcolor: 'grey.900', color: 'white', p: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom align="center">
              Logged Events
            </Typography>
            {logs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                No logs yet.
              </Typography>
            ) : (
              <Box component="ul" sx={{ listStyleType: 'disc', pl: 4, m: 0 }}>
                {logs.map((log, idx) => (
                  <Box component="li" key={idx}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflowX: 'auto' }}>
                      {log}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}