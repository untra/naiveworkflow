import { RENDERER_VERSION } from '@naiveworkflow/react';

export function App() {
  return (
    <main style={{ fontFamily: 'ui-sans-serif, system-ui', padding: 24 }}>
      <h1>naiveworkflow playground</h1>
      <p>Renderer version: {RENDERER_VERSION}</p>
    </main>
  );
}
