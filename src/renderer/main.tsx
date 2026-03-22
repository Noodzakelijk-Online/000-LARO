import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import DashboardApp from './DashboardApp';
import { TrpcProvider } from './providers/TrpcProvider';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrpcProvider>
      <DashboardApp />
      <Toaster richColors position="top-center" />
    </TrpcProvider>
  </React.StrictMode>
);