# naiveworkflow

Visualize **Claude workflow scripts** as swimlane diagrams with a minimal aesthetic.

A "Claude workflow" is a JS file that calls graph-building primitives — `agent()`,
`parallel()`, `pipeline()`, `phase()` — interleaved with real control flow (`while`, `.map`,
`if`/`return`). `naiveworkflow` reads such a file and shows its structure visually, in two
phases:

1. **`@naiveworkflow/compiler`** — statically parses the JS into a coordinate-free IR (JSON).
   The source is parsed with [acorn](https://github.com/acornjs/acorn) and inspected as an AST.
   **It is never executed** — no `eval`, `Function`, `vm`, or dynamic `import`.
2. **`@naiveworkflow/react`** — lays the IR out with [elkjs](https://github.com/kieler/elkjs)
   and renders it with [React Flow](https://reactflow.dev).

```
acorn (parse) → visitor (→ IR) → elkjs (layout) → React Flow (render)
```

## Packages

| Package | Description |
|---|---|
| [`@naiveworkflow/compiler`](packages/compiler) | JS source → IR JSON. Headless, no React. |
| [`@naiveworkflow/react`](packages/react) | IR → laid-out swimlane diagram. |
| [`apps/playground`](apps/playground) | Vite dev app: paste JS, see the diagram. (private) |

## Lane semantics

Lanes are **parallel tracks**: each concurrent branch (a `parallel` thunk, a `pipeline` item, a
`.map` fan-out) is its own horizontal lane — fan-out → lanes → barrier/merge → next. Unknown
counts (`findings.map(...)`) collapse to a single representative lane with a `×N` badge; loops
render as a `↻ until <cond>` region. Unrecognized JS degrades to an annotated code node rather
than failing.

## Development

```sh
corepack enable
pnpm install
pnpm build        # build both libraries
pnpm test         # run the test suites
pnpm dev          # run the playground
```

## License

MIT
