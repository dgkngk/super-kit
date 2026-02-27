# Project Plan: Remove Python Dependencies from Node tools

## Project Type: BACKEND

## Objective
The orchestration tools (`checklist.ts` and `verifyAll.ts`) currently rely on Python scripts located inside `.agent/skills/` (now `skills/tech/`) to run verifications. To make the SuperKit purely agnostic and remove Python dependencies, these checks should execute standard package.json scripts (e.g., `npm run lint`, `npm run test`) or lightweight Node validation instead of `spawn('python')`.

## Tasks

1. **Delete Python Scripts**
   - Locate and delete all `.py` files under `skills/tech/*/scripts`.

2. **Refactor Native Checks in `checklist.ts`**
   - Replace the `spawn('python', scriptPath)` mechanism with a native Node.js command runner (e.g., `exec` or `spawn` running `npm run lint`, `npm test`, etc.).
   - If a script isn't found in `package.json`, skip it gracefully.

3. **Refactor Native Checks in `verifyAll.ts`**
   - Adapt to use the same native Node.js mechanism for the larger suite of tools.

4. **Verify MCP server builds correctly**
   - `npm run build`
