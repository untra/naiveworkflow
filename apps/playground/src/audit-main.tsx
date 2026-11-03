import '@xyflow/react/dist/style.css';
import '@untra/naiveworkflow-react/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Audit } from './Audit.js';

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(
  <StrictMode>
    <Audit />
  </StrictMode>,
);
