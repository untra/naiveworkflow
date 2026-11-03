import { Panel, useReactFlow, useViewport } from '@xyflow/react';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;
const PAN_DISTANCE = 80;
const ZOOM_FACTOR = 1.2;

export function ViewportControls({ empty }: { empty: boolean }) {
  const { setViewport, fitView } = useReactFlow();
  const viewport = useViewport();
  const pan = (dx: number, dy: number) => {
    void setViewport({ ...viewport, x: viewport.x + dx, y: viewport.y + dy }, { duration: 0 });
  };
  const zoom = (factor: number) => {
    const value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
    void setViewport({ ...viewport, zoom: value }, { duration: 0 });
  };
  return (
    <Panel position="top-left" className="nwf-navigation" aria-label="Workflow navigation">
      <button type="button" onClick={() => pan(PAN_DISTANCE, 0)} disabled={empty}>
        Pan left
      </button>
      <button type="button" onClick={() => pan(-PAN_DISTANCE, 0)} disabled={empty}>
        Pan right
      </button>
      <button type="button" onClick={() => pan(0, PAN_DISTANCE)} disabled={empty}>
        Pan up
      </button>
      <button type="button" onClick={() => pan(0, -PAN_DISTANCE)} disabled={empty}>
        Pan down
      </button>
      <button
        type="button"
        onClick={() => zoom(ZOOM_FACTOR)}
        disabled={empty || viewport.zoom >= MAX_ZOOM}
      >
        Zoom in
      </button>
      <button
        type="button"
        onClick={() => zoom(1 / ZOOM_FACTOR)}
        disabled={empty || viewport.zoom <= MIN_ZOOM}
      >
        Zoom out
      </button>
      <button
        type="button"
        onClick={() => {
          void fitView({ duration: 0 });
        }}
        disabled={empty}
      >
        Fit workflow
      </button>
    </Panel>
  );
}
