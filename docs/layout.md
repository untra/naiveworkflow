# Layout notes

Findings from the M0.5 spike (throwaway code, deleted). These are the validated
assumptions the `@naiveworkflow/react` layout pipeline (M3) is built on.

## elk produces swimlanes with `layered` + compound nesting

A `parallel` container holding N lane children, laid out with `layered` + `direction: RIGHT`,
yields lanes **stacked vertically and aligned in a column** (distinct `y`, shared `x`). No
swimlane-specific elk option (`partitioning`, `layerConstraint`) was needed.

Validated root + container `layoutOptions`:

```js
// root
{
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN', // fan-out → lane edges cross container boundaries
  'elk.spacing.nodeNode': '24',
  'elk.layered.spacing.nodeNodeBetweenLayers': '48',
  'elk.padding': '[top=24,left=24,bottom=24,right=24]',
}
// each container (parallel / loop / branch / phase)
{
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.padding': '[top=28,left=16,bottom=16,right=16]', // top pad leaves room for the container label
}
```

Containers auto-size to fit children — read `width`/`height` straight off the elk result for the
React Flow container `style`; no manual sizing.

## elk → React Flow mapping (confirmed)

- elk compound mode returns child positions **relative to the parent** → use verbatim as the RF
  node `position`, set `parentId` = container id and `extent: 'parent'`.
- **Parent nodes must precede children** in the RF `nodes` array.
- elk edges come back with **absolute `sections`** — do NOT consume them. Pass only
  `{ id, source, target }` to React Flow and let it route (avoids kieler/elkjs #112).

## Packaging

- Import the browser-safe entry: `import ELK from 'elkjs/lib/elk.bundled.js'` (the Node default
  import breaks Vite). The bundled entry has no own `.d.ts` — add a one-line module shim in the
  react package that re-exports `elkjs`'s types.
- `elkjs` is a dependency of `@naiveworkflow/react` only. The playground (and any consumer)
  renders via `@naiveworkflow/react` and must never import `elkjs` directly — pnpm's strict
  layout will (correctly) fail to resolve it otherwise.
- `new ELK()` once as a module singleton; `elk.layout()` is async.
