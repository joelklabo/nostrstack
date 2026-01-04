# YOUR JOB

1. Ask `bd ready` what to do
2. Mark the issue `in_progress`
3. Work on it
   - Run `pnpm dev:logs` (or tail `.logs/dev/*.log`) so API + gallery logs are visible while reproducing/fixing.
   - For any UI change, open the view with Chrome DevTools MCP (`scripts/mcp-devtools-server.sh` + `scripts/mcp-chrome.sh`) and confirm the console/network are clean.
     - If Chrome DevTools MCP is unavailable (e.g. tool calls error with `Transport closed`), use the Playwright QA fallback instead: `pnpm qa:regtest-demo` (fails on console errors + local request failures).
4. Check your work, run tests
5. Mark it as 'done'
6. Create new issues or epics for any necessary work, or improvements, you came across in your work.
7. Commit
8. Push
9. GO BACK TO 1!

## IMPORTANT

- NEVER ask which issue to prioritize, use your best judgement and pick one.
- ALWAYS create new issues/epics if you come across something in the course of your work that should be fixed or improved.
- NEVER give me a summary, or a status report. Just do "Your Job" (See above)

## NOTE

- If you ever see this error, run `bd doctor` for next steps:
    "⚠️  WARNING: JSONL file hash mismatch detected (bd-160)
     This indicates JSONL and export hashes are out of sync.
     Clearing export hashes to force full re-export."

## VALID STOP REASONS

- stop reasons: `bd ready` (no tasks), unrecoverable error after retries.

## INVALID STOP REASONS

- "just reporting progress", "task looks hard", "I've used a lot of tokens", "status update".

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
