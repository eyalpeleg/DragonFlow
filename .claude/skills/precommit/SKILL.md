---
name: precommit
description: Run pre-commit checks before committing code. Use this skill whenever the user asks to commit changes, before creating the actual git commit. Also trigger when the user says "run checks", "precommit", "pre-commit", or "verify before commit". This ensures code quality by catching type errors, lint issues, failing tests, and accidental secrets before they enter the git history.
---

# Pre-Commit Checks

Run these checks sequentially. Stop early if a blocker is found.

## Check 0: Docs-only fast path

Look at the staged files (`git diff --cached --name-only`). If **every** staged file is documentation — i.e. all paths end in `.md` (e.g. `docs/design/features.md`, `README.md`, `CLAUDE.md`) — then the code validations can't be affected. **Skip Checks 1–3 (TypeScript, ESLint, Tests)** and jump straight to Check 4 (Secrets Scan), which still runs because even docs can contain a pasted secret.

```bash
git diff --cached --name-only | grep -qvE '\.md$' && echo "CODE CHANGES — run all checks" || echo "DOCS ONLY — skip checks 1-3, run secrets scan only"
```

If any staged file is not a `.md` file, run all checks as normal.

## Check 1: TypeScript Type Check

```bash
npx tsc --noEmit 2>&1
```

**Blocker** if exit code is non-zero. Show the errors.

## Check 2: ESLint

```bash
npx eslint app/ src/ 2>&1
```

- **Blocker** if there are any **errors** (not warnings).
- **Report** warning count but don't block.
- Parse the summary line (e.g., "✖ 22 problems (0 errors, 22 warnings)") to distinguish errors from warnings.

## Check 3: Tests (Jest)

```bash
npm test -- --passWithNoTests 2>&1
```

- **Blocker** if exit code is non-zero (one or more tests failed).
- `--passWithNoTests` keeps this from blocking when no test files exist (e.g., a doc-only branch).
- Parse the summary line (e.g., "Tests: 1 failed, 12 passed, 13 total") for the counts.
- If tests fail, show the failing test names and the first failure's error message so the user can fix it. Don't dump the full output.

## Check 4: Secrets Scan

Check files staged for commit (`git diff --cached --name-only`) for:
- Files named `.env`, `.env.*`, `credentials.*`, `*.pem`, `*.key`
- Content matching patterns: `API_KEY=`, `SECRET=`, `TOKEN=`, `PASSWORD=`, `PRIVATE_KEY`, `-----BEGIN`

```bash
# Check filenames
git diff --cached --name-only | grep -iE '\.(env|pem|key)$|credentials\.' 

# Check content
git diff --cached -U0 | grep -iE '(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|-----BEGIN)\s*[=:]'
```

**Blocker** if any matches found. Show the suspicious files/lines.

## Output Format

After all checks complete, print a summary:

```
## Pre-commit Results
- TypeScript: PASS / FAIL (with error count) / SKIPPED (docs-only)
- ESLint: PASS / FAIL (X errors, Y warnings) / SKIPPED (docs-only)
- Tests: PASS / FAIL (X passed, Y failed of Z total) / SKIPPED (docs-only)
- Secrets: PASS / FAIL (list suspicious files)

Result: READY TO COMMIT / BLOCKED (fix N issues)
```

If all checks pass, keep it to just the summary. If any block, show the specific errors above the summary so the user can fix them.
