# From a proposal to a pull request

A designer's **Propose change** saves a changeset in `.sigma/changesets/<id>.json`: some Sigma edits, with a
title, a note and before/after pictures. Turn it into a ticket and a pull request that follow the team's
process exactly like a developer's would. Read `sigma.config.json` → `workflow` first:

```json
"workflow": { "git": "github", "tracker": "notion", "branch": "design/{ticket}-{slug}", "base": "main",
              "prTemplate": ".github/pull_request_template.md", "labels": ["design"], "reviewers": [],
              "notion": { "database": "<database id or URL>", "status": "Status", "done": "Done" } }
```

`git` is `github` (with `gh`), `gitlab` (with `glab`) or `azure` (Azure DevOps, with `az repos`). `tracker` is `notion`, `github` (GitHub Issues),
`gitlab` (GitLab issues), `linear`, `jira` or `none`; Linear and Jira say where tickets go:
`"linear": { "team": "DES", "done": "Done" }`, `"jira": { "project": "DES", "issueType": "Task", "done": "Done" }`.

Only do this when the person asks you to send a proposal (or all open ones). Ask before anything they
haven't asked for: pushing, opening a pull request, creating or moving tickets.

## Steps (for one changeset)

```bash
S="npx sigma-design"
$S changeset list <project>                      # find it (any unique part of its id works)
$S changeset show <id> <project>                 # read what it changes
```

1. **Ticket** (`workflow.tracker`):
   - `notion`: create a page in `workflow.notion.database` with the title and body from
     `$S changeset ticket <id> <project> --json` (title, body, status "To do"), using the Notion tools you
     have (an MCP server or the API). Attach or link the before/after pictures.
   - `github`: `gh issue create --title … --body-file …` with the same text.
   - `gitlab`: `glab issue create --title … --description "$(cat body.md)" --label design`.
   - `linear`: create an issue in team `workflow.linear.team` with the Linear tools you have (an MCP server or
     the GraphQL API), title and body as above.
   - `jira`: create an issue of type `workflow.jira.issueType` (default Task) in project `workflow.jira.project`
     with the Jira tools you have (an MCP server, `acli`, or the REST API).
   - `none`: skip.

   Record it: `$S changeset status <id> proposed <project> --ticket <url>`.
2. **Branch**, from the base, in its own worktree (never in the person's working copy):

   ```bash
   B=$($S changeset branch <id> <project>)                  # from workflow.branch
   git fetch origin <base> && git worktree add -b "$B" ../sigma-pr origin/<base>
   ```
3. **Files:** `$S changeset prepare <id> <project> --to ../sigma-pr/<project path in the repo>`. It applies the
   changeset to the Sigma files (only its changes), writes the code for tokens and icons (CSS directly; for
   other stacks it lists what to change: do it like in SKILL.md step 3), copies the changeset and its
   pictures into the branch, and checks the result. For changed library components it writes the CSS and
   code it can write exactly and lists the rest "For you": do that, then capture and compare, following
   `design-to-code.md`, before committing.
4. **Checks:** run the project's own checks in the worktree (tests, lint, type check, build: whatever CI runs;
   look at `.github/workflows/`, `package.json` scripts). Fix what fails. Never skip hooks or checks.
5. **Commit and push:** one commit (or the team's convention, e.g. Conventional Commits:
   `feat(design): <title>`), with the changeset id in the body. Push the branch.
6. **Pull request:** a draft, against `workflow.base`, with `workflow.labels` and `workflow.reviewers`, and the
   body in the repo's template if there is one (`workflow.prTemplate`, or `.github/pull_request_template.md`):
   fill its sections from `$S changeset pr-body <id> <project> --images-base https://github.com/<owner>/<repo>/raw/<branch>/<project path>`
   (pictures show from the branch). Link the ticket.

   ```bash
   gh pr create --draft --base <base> --head "$B" --title "<title>" --body-file /tmp/pr-body.md --label design
   # GitLab (workflow.git "gitlab"): a draft merge request
   glab mr create --draft --target-branch <base> --source-branch "$B" --title "<title>" --description "$(cat /tmp/pr-body.md)" --label design
   # Azure DevOps (workflow.git "azure"): a draft pull request
   az repos pr create --draft --target-branch <base> --source-branch "$B" --title "<title>" --description "$(cat /tmp/pr-body.md)"
   ```

   On GitLab, `--images-base` is `https://<gitlab host>/<group>/<project>/-/raw/<branch>/<project path>`.

   Then: `$S changeset status <id> in-review <project> --pr <url> --pr-number <n> --branch "$B"`, and add the
   pull request's link to the ticket.
7. **Clean up:** `git worktree remove ../sigma-pr`.

## Keeping statuses current

```bash
$S changeset sync <project>
```

reads each open proposal's pull request with `gh` (a GitLab merge request with `glab`, an Azure DevOps pull request with `az`) and sets its status: **In review**, **Changes requested**
(a reviewer asked for changes: tell the designer what they said), **Merged** or **Closed**. Sigma's Project
section shows them. When one is merged, move its ticket to Done (`workflow.notion.done`, `workflow.linear.done` or
`workflow.jira.done`; GitHub and GitLab issues close from the pull request with "Closes #12"), and tell the person
to pull: Sigma reloads the files, and the merged edits stop showing as changes.

## When review asks for changes

The designer changes the design in Sigma and proposes again (the new proposal includes the edits since the
last commit that aren't in an open proposal; edited items show again). Update the same branch: run step 3 into
its worktree with the new changeset, commit, push, and mark the old changeset `closed`.
