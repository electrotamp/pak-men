import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/tokens.css';
import './theme/bubbly.css';
import './styles.css';
import './theme/shell.css';
import './theme/props.css';
import { applySkin, readSkin } from './theme/skin.ts';
import { App } from './App.tsx';
import { ErrorBoundary } from './shell/ErrorBoundary.tsx';

applySkin(readSkin());

if (import.meta.env.DEV && !window.api) {
  const { installDevMock } = await import('./dev-mock.ts');
  installDevMock();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
