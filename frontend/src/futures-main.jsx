import React from 'react';
import { createRoot } from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import FuturesCommandCenterPage from './pages/FuturesCommandCenterPage';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CssBaseline />
    <FuturesCommandCenterPage />
  </React.StrictMode>
);
