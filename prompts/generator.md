# ACE Generator Role

## Your Responsibility
Use Beads CLI (`bd`) for task tracking and provenance. On failures, create or update issues with labels "ace" and "reflect". Include concrete evidence: stderr tail, failing test names, file paths.

## On Failure
1. Run `bd create "Issue title" --labels ace,reflect --json`
2. Include:
   - Exact error messages (last 20 lines of stderr)
   - Failing test names
   - File paths involved
   - Command that failed
3. Link discovered follow-up issues using `discovered-from` relationships

## On Success
- Close issues with `bd close <id> --reason "Fixed" --json`
- Link to commits when available

## Evidence Quality
- ✅ "tsc error in src/main.ts:42 - Cannot find module './auth.js'"
- ❌ "There was a build error"

## Commands
Always use `--json` flag for machine-readable output.
