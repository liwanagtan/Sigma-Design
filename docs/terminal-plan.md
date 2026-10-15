# Phase 52: Built-in terminal

Status: **In progress**. Added 15 October 2026. Scope: Design and Tokens files.

## Purpose and UI

Run local development, token sync, validation, and build commands while working in a file. Use a real interactive shell with live output, rather than a simulated command log.

- Add a **Terminal** icon to the file tools rail in Design and Tokens. The panel is closed by default; opening it does not execute a command.
- Show a resizable bottom dock within the working area, keeping the file tools rail and editing controls accessible. Start around 240 px high, clamp it to the available viewport, and remember the user's dock size/visibility locally.
- Dock header: workspace name, shell/session name, session tabs, New terminal, Clear output, and Hide. Provide an explicit End session action for terminating a shell.
- Support Light/Dark, selectable text, copy/paste, scrolling, keyboard navigation, and an accessible output/connection status. Audit existing shortcuts before assigning a toggle shortcut.
- Terminal focus captures shell input; canvas drawing, deletion, zoom, token editing, and editor shortcuts must not fire while typing commands. The shell's Ctrl+C interrupts a command; hiding the dock leaves it running.

## Workspace and file context

A terminal session belongs to a local workspace, not to the design document.

- For a connected repository, start the shell in that repository's root. Display the workspace and active file context, including the repository path when available.
- Design and Tokens files in the same workspace can reuse its sessions. Changing files must not silently change a running shell's directory or terminate its command.
- Switching projects shows that project's sessions. Never attach the previous project's shell to a new project's label; reconnection requires matching workspace/session identity.
- Browser-only projects, Sigma/Optics examples, and Drafts have no implicit local filesystem directory. Show **Connect local workspace** guidance before enabling execution. A remote static page cannot launch the operating-system shell on its own.
- For the first release, connection uses Sigma's local project server. Define a deliberate workspace attachment flow for browser-only files; do not assume a folder from a project name or create a new backend service.
- Keep shell sessions, output, command history, and dock preferences out of `.sigma.json`, published libraries, sample reset logic, and design undo. Temporary example edits resetting must not reset an attached terminal session.

## Execution architecture

- Use a browser terminal renderer and an interactive pseudo-terminal (PTY) managed by Sigma's local Node server. Evaluate maintained renderer/PTY dependencies, their licenses, packaging, and macOS/Linux/Windows support before choosing them.
- Add a dedicated session service and authenticated bidirectional transport for create, attach, input, resize, output, exit, and terminate. Do not turn the existing named project-action endpoint into an arbitrary shell endpoint.
- Keep the service loopback-only. Validate Host and Origin, require a server-issued connection/session capability, and reject cross-origin or unauthenticated HTTP and WebSocket requests. A browser-generated terminal session ID is not authorization.
- Workspace root is the initial working directory, not an OS filesystem sandbox. Commands use the local user's permissions. Make the execution context clear; commands are entered/run by the user, and document text or terminal output never triggers commands automatically.
- Stream output with bounded buffers and backpressure, bounded scrollback, resize propagation, and exit/error status. Render output through the terminal renderer, never as arbitrary HTML; gate clipboard and link escape sequences.
- Integrate file-change results with existing repository polling/sync and conflict handling. Running a shell command must not overwrite unsaved editor changes or bypass the current save workflow.

## Session lifecycle

- Open or New terminal creates a shell only after a workspace is connected and execution is enabled. Shell selection follows supported server configuration, with a useful error if unavailable.
- Hiding the dock and switching files preserves live sessions. Closing/ending a session terminates its process group, with active-process status visible so users know what they are ending.
- A brief transport disconnect permits reattaching to the same server session; show reconnecting/disconnected state. Define a bounded idle retention policy and limits for concurrent sessions.
- Restarting the server ends its sessions; show that clearly. Never replay shell input automatically or imply that an old transcript is a live shell.
- Default output/history retention is memory-only. Do not persist transcripts or credentials in documents, IndexedDB, repository files, or routine server logs. Optional history persistence needs a separate explicit design.

## Implementation sequence

1. **Contract and dependency choice:** workspace binding, supported shells/platforms, transport authentication, session limits, and retention rules; review the dock design.
2. **Local session service:** PTY creation, streaming, resize, interrupt/exit/terminate, and authenticated reconnect. Verify it independently of the editor.
3. **Shared dock:** rail integration in Design and Tokens, focus/keyboard isolation, session tabs, local layout preferences, and clear disconnected guidance.
4. **Workflow integration:** run real token/build/check commands, preserve unsaved work and project identity across file/project switches, and connect generated-code validation from Phase 51 when available.
5. **Release validation:** dependency notices/package installation, documentation, responsive/appearance checks, platform coverage, process cleanup, and transport security tests.

## Done when

- A user opens Terminal in a Design file, runs a real command, and sees live output; a Tokens file in the same workspace can attach to that session without interrupting it.
- Interactive input, terminal resize, Ctrl+C, exit status, scrollback, copy/paste, and explicit session termination work.
- Hiding/reopening, switching files/projects, disconnect/reconnect, and server restart have predictable behavior and do not expose another workspace's session.
- Browser-only files explain how to connect a workspace; no fake execution or guessed folder is offered.
- Typing in the terminal cannot edit the canvas or tokens. Shell output cannot execute markup, write the clipboard unexpectedly, or initiate another command.
- Unauthorized/cross-origin connections are rejected, output/session limits are enforced, and terminated sessions leave no orphan processes.
- Package and platform tests pass for the declared supported scope; unsupported PTY/platform cases have useful guidance.

## Relationship to other phases

Code creation (Phase 51) can export or apply files independently; this terminal adds an integrated way to run their checks/builds. It also supports token sync and existing CLI commands. Future Assistant tool execution requires its own authorization/context design and is not implicit in adding a user-operated terminal. Icons files and Home are outside this phase's initial UI scope.

## Implementation progress

- Implemented: local PTY service with same-origin HTTP/WebSocket capabilities and workspace identity checks; shared Design/Tokens dock; explicit attachment for browser files; session tabs; resizer; keyboard isolation; copy/paste/clear; foreground process and exit status; hide/reopen; reconnect/server restart; shell/job cleanup.
- Limits: four sessions, twelve transports, 16 KiB input messages, 256 KiB recent server output, 512 KiB outstanding browser output with write acknowledgements, 2,000 scrollback lines, fifteen-minute detached retention. Transcripts, capabilities, and default shell history are memory-only.
- Pinned MIT dependencies: xterm.js 6.0.0, fit addon 0.11.0, node-pty 1.1.0, ws 8.22.0. `tools/build-terminal.mjs` reproduces checked-in browser assets/licenses. Postinstall repairs the packaged Unix PTY helper's executable bit.
- Supported shells: zsh/bash/sh/dash, selected from server `SHELL`. Interactive startup scripts are skipped to preserve memory-only history. The inherited environment/PATH is retained. Unsupported or missing shells give a panel error; there is no command-log fallback.
- Verified locally on macOS arm64: real Design/Tokens commands and shared environment, hide/reopen, server restart, Ctrl+C, resize, output limits, origin/capability rejection, concurrent session limits, stale-save protection, child cleanup, and fresh npm package installation. Browser regression covers event isolation, safe text rendering, project separation, and restart without automatic execution.
- Release gate remaining: Linux CI execution and broader platform validation. Node CI installs runtime dependencies; a macOS terminal job is added. Windows terminal execution is deliberately unavailable with guidance until its process lifecycle is validated.
- User instructions and operational limits are in the README. No terminal commands are initiated by document content or Assistant tools. Code-generation integration remains dependent on Phase 51.
