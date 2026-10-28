# AGENTS.md

Instructions for any agent harness (Claude Code, Codex, etc.) working in this repo. This is the only instruction file; don't add a CLAUDE.md or per-harness copies.

## What this fork is

A fork of [newyorkcompute/kalshi](https://github.com/newyorkcompute/kalshi), cut down to a **Kalshi data/analysis MCP server** that tracks Kalshi's current API. Upstream also ships a market-maker bot and a TUI; this fork deliberately does not.

Packages:

- `packages/mcp` - the MCP server. This is the product.
- `packages/core` - SDK config, formatting, WebSocket helpers.
- `packages/weather` - NWS-based fair-value/probability models, kept in sync with upstream.
- `skills/kalshi-trading` - Agent Skill (code-first alternative to the MCP).

Out of scope: `apps/mm`, `packages/core/src/mm`, `packages/tui`. Don't re-add them, and don't import from upstream's mm code. If something there is useful (as `orders-v2.ts` was), port a trimmed copy into `packages/mcp`.

## Kalshi API conventions

- **Fixed-point schema.** Kalshi returns money/quotes as `*_dollars` strings and counts/sizes/volume as `*_fp` strings. The old integer-cent fields are gone; reading them silently yields zeros. Convert everything through `packages/mcp/src/schema.ts` (`fp()`, `cents()`), never with ad hoc `parseFloat`.
- **Deci-cent precision.** `cents()` keeps 0.1c granularity (`"0.7350"` -> `73.5`). Don't round prices to whole cents; the half-cent matters for EV math.
- **Reads** go through the `kalshi-typescript` SDK (`createMarketApi`, `createPortfolioApi`, etc.).
- **Order writes** go through `packages/mcp/src/orders-v2.ts`, a self-contained RSA-PSS-signed client for `/portfolio/events/orders*`. The SDK's V1 order endpoints return HTTP 410. NO-side intents map onto the single YES book. Writes need a `write::trade`-scoped key; read-only keys get an `insufficient scope` error, which is expected.
- **Settlements** report net P&L (revenue - cost - fees). Never report gross payouts as profit.

When Kalshi changes a field or endpoint, verify against the live API (read-only key via `KALSHI_API_KEY` / `KALSHI_PRIVATE_KEY`), not just the SDK types. Never place real orders to test something unless Andy asks for it explicitly.

## Verification

Run `npm run ci` (build, lint, test, typecheck across all packages) before committing. Don't open a PR with known failures. If you changed request/response handling, also exercise the affected tool against the live API and say so in the PR.

## Git and PRs

- Feature work: branch, PR, squash-merge. Follow `.github/PULL_REQUEST_TEMPLATE.md`; note any skipped verification in the Testing section.
- Use `--repo aaymeloglu/kalshi` with `gh pr`/`gh issue`; on a fork it otherwise defaults to upstream.
- Add a changeset (`npm run changeset`) for user-visible changes to a published package.

## Syncing with upstream

Remotes: `origin` = `aaymeloglu/kalshi`, `upstream` = `newyorkcompute/kalshi`.

1. `git fetch upstream && git merge --no-ff upstream/main` on `main`.
2. Resolve modify/delete conflicts in mm/tui paths by keeping them deleted (`git rm -rf apps/mm packages/core/src/mm packages/tui`). Drop changesets that only touch mm.
3. Take upstream's changes to `packages/weather`, `packages/core` (outside `mm/`), and tooling. Check whether upstream fixed anything in its mm order/schema code that `packages/mcp` should port.
4. Regenerate the lockfile with `npm install`, run `npm run ci`, then commit and push the merge commit directly to `main`.

Land syncs as a real merge commit, never a squash-merged PR. A squash keeps upstream's content but not its ancestry, so GitHub keeps reporting the fork as behind and the next sync re-conflicts.
