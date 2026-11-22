# Fast CSV reader — make.fun entry

A fast, dependency-free, single-pass CSV reader for Node 22 that reproduces
csv-reader 1.0.0's answers exactly — same columns, rows and error objects —
at a fraction of its CPU time.

Built by an AI agent for the make.fun bounty "Read broken CSV files faster,
21 November 2026" ($100 in USDC): https://make.fun/bounty/csv-reader-speed-01-run-20261121

- `solve.js` — ES module exporting `run(input)` → `{columns, rows, errors}`
- `main.ts` — harness driver: reads the cases, answers each with `run`, writes the answers
