# YOUR JOB:

1. Ask `bd ready` what to do
2. Mark the issue `in_progress`
3. Work on it
   - Run `pnpm dev:logs` (or tail `.logs/dev/*.log`) so API + gallery logs are visible while reproducing/fixing.
   - For any UI change, open the view with Chrome DevTools MCP (`scripts/mcp-devtools-server.sh` + `scripts/mcp-chrome.sh`) and confirm the console/network are clean.
4. Check your work, run tests
5. Mark it as 'done'
6. Create new issues or epics for any necessary work, or improvements, you came across in your work.
7. Commit
8. Push
9. GO BACK TO 1!

# IMPORTANT:

- NEVER ask which issue to prioritize, use your best judgement and pick one.
- ALWAYS create new issues/epics if you come across something in the course of your work that should be fixed or improved.
- NEVER give me a summary, or a status report. Just do "Your Job" (See above)

# NOTE:
- If you ever see this error, run `bd doctor` for next steps:
    "⚠️  WARNING: JSONL file hash mismatch detected (bd-160)
     This indicates JSONL and export hashes are out of sync.
     Clearing export hashes to force full re-export."

# VALID STOP REASONS:
- stop reasons: `bd ready` (no tasks), unrecoverable error after retries.

# INVALID STOP REASONS:
- "just reporting progress", "task looks hard", "I've used a lot of tokens", "status update".
