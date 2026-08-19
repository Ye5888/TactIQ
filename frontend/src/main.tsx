import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('app');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<App />);