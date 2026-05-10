---
name: add-idea
description: Add a new feature idea to the planned features list. Trigger when the user says "add idea", "new idea", "feature idea", "I have an idea", or describes a feature they want to build. Takes the idea text as input and appends it to the Planned table in docs/design/features.md.
---

# Add Feature Idea

When the user provides a feature idea:

1. Read `docs/design/features.md`
2. From the user's input, extract:
   - **Feature** — a short title (2-5 words)
   - **Notes** — a one-line description of the idea
3. Insert a new row into the **Planned** table, just before the empty `| | | |` row:
   ```
   | <Feature> | Idea | <Notes> |
   ```
4. Tell the user what was added (one line).
