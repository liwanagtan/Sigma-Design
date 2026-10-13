# Data and AI

What Sigma sends where, and how AI fits in. In short: Sigma doesn't call any AI model, and your design files
stay on your machine and in your repository. Coding agents only see what you ask them to work on.

## What Sigma itself sends

- **Nothing to an AI model.** The editor, the server and the command line make no calls to AI providers.
- **Fonts:** the editor loads Inter, JetBrains Mono, Roboto, Playfair Display and Space Grotesk from Google
  Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`), as does an exported documentation page. Google sees
  those requests, the same as on any website using Google Fonts.
- **Nothing else leaves your machine.** The server (`npx sigma-design dev`) listens on `127.0.0.1` only, so
  other computers can't reach it. Files are saved in your project's `.sigma/` folder (in a project) or in your
  browser's storage (on its own). Icon sets ship with Sigma.

## What coding agents see

The `sigma-sync` skill (`skills/sigma-sync/`) and the rules `npx sigma-design agents` writes are instructions
for the coding agent your team already uses: Claude Code, Codex, Cursor, Copilot or any other that reads
`AGENTS.md` or skills. When you ask the agent to sync tokens, build a library or open a pull request, it reads
what that task needs: Sigma files in `.sigma/`, the code those files map to, and the output of
`npx sigma-design` commands. It sends that to its model, like any other code it reads for you.

So **your team chooses the model and provider** by choosing the agent and how it's set up (an enterprise
plan, a self-hosted model, a provider with zero data retention). Sigma works the same with all of them: the
skills are plain Markdown, and every step they describe is a command you can also run yourself.

## What leaves through your workflow

When you send a proposal (`skills/sigma-sync/reference/workflow.md`), the agent uses your own tools to:

- push a branch to your Git host (GitHub, GitLab, Azure DevOps or Bitbucket) and open a draft pull request;
- create a ticket in your tracker (Notion, GitHub or GitLab issues, Linear or Jira).

The pull request and ticket hold the proposal's title, note, what changed, the accessibility check's results
and before/after pictures. They go only where your project's `sigma.config.json` (`workflow`) says, and the
agent asks before pushing, opening a pull request, or creating tickets.

## If you need more control

- Keep the agent off design work: Sigma's editor and `npx sigma-design` commands work without one.
- Review what an agent will read: everything is plain files in `.sigma/` and your code.
- To keep Google Fonts out, serve the fonts yourself and change the `<link>` in `index.html`.
