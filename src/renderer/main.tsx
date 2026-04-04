import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';
import DashboardApp from './DashboardApp';
import App from './App';
import { TrpcProvider } from './providers/TrpcProvider';
import './index.css';

const params = new URLSearchParams(window.location.search);
const isScannerMode = params.get('mode') === 'scanner' || window.location.hash.includes('mode=scanner');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrpcProvider>
      {isScannerMode ? <App /> : <DashboardApp />}
      <Toaster richColors position="top-center" />
    </TrpcProvider>
  </React.StrictMode>
);