---
name: precommit
description: Run pre-commit checks before committing code. Use this skill whenever the user asks to commit changes, before creating the actual git commit. Also trigger when the user says "run checks", "precommit", "pre-commit", or "verify before commit". This ensures code quality by catching type errors, lint issues, and accidental secrets before they enter the git history.
---

# Pre-Commit Checks

Run these checks sequentially. Stop early if a blocker is found.

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

## Check 3: Secrets Scan

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
- TypeScript: PASS / FAIL (with error count)
- ESLint: PASS / FAIL (X errors, Y warnings)  
- Secrets: PASS / FAIL (list suspicious files)

Result: READY TO COMMIT / BLOCKED (fix N issues)
```

If all checks pass, keep it to just the summary. If any block, show the specific errors above the summary so the user can fix them.
