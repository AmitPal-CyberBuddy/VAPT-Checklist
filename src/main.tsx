import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithBoundary } from './App';
import { installGlobalErrorHandlers } from './app/globalErrors';
import './styles.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithBoundary />
  </StrictMode>,
);
