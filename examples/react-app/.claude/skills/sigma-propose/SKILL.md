---
name: sigma-propose
description: Turn a design change proposed in Sigma (.sigma/changesets/) into a ticket and a pull request the way acme-react's team works. Use when asked to send, ship or open a PR for a Sigma proposal, or to sync proposal statuses.
---

<!-- sigma-design:start -->
# Proposals → tickets and pull requests (acme-react)

- Git: github; base branch `main`; branches named `design/{slug}`; labels `design`.
- Tracker: none.

`npx sigma-design changeset list`, then follow the guide: branch in a worktree, `changeset prepare`, the
project's own checks, a draft pull request with `changeset pr-body`, and `changeset sync` for statuses.
Only open pull requests or tickets when the person asked.

Guide: `../../skills/sigma-sync/reference/workflow.md`.
<!-- sigma-design:end -->

## Project notes

<!-- Kept when setup runs again. Write this team’s conventions: commit message format, who reviews design PRs, which checks must pass, ticket fields. -->
