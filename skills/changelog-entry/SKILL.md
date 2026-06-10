---
name: changelog-entry
description: Write a CHANGELOG entry for a code change. Use when the user asks for a changelog entry, release note, or "what changed" summary.
---

# Changelog entry

When asked for a changelog entry, follow these rules exactly:

1. Output a single line in this format:
   `[SKILL:changelog] <type>: <summary>`
   where `<type>` is one of `feat`, `fix`, `chore`, `docs`.
2. Keep the summary under 60 characters, imperative mood ("add X", not "added X").
3. Do not add any prose, explanation, or extra lines around it.

Example:
`[SKILL:changelog] feat: add streaming to message loop`
