---
name: writing-comments
description: Use when writing or reviewing comments and doc comments, or when a diff adds explanatory prose alongside code.
metadata:
  mcpmarket-version: 1.0.0
---
# Writing comments

The default is **no comment**. Clear names and structure carry the meaning; a comment is what you add
when they provably cannot.

## The one test

A comment must answer **why**, and the why must be non-obvious from the code beside it.

If it describes *what* the code does, delete it. If a reader could recover it from the next three
lines, delete it. If the code needs a comment to be followed at all, the fix is usually a better name
or a smaller function — not a comment.

## Hard limits

| Kind | Limit |
|-|-|
| Line comment | **1 line.** No exceptions. |
| Member doc comment (function, property, case) | **1 line.** A second only for a genuinely subtle exception. |
| Type-level doc comment (class, struct, enum, protocol, module) | Several lines, to orient a reader about the whole type. |

Over the limit means **cut, not reflow**. Pick the single most important point and drop the rest —
the second sentence is almost always the one restating the first.

## Never

- **Narrate.** "loop over the items", "set the title", "returns nil when empty".
- **Restate the signature.** A parameter doc that repeats the parameter name and type.
- **Decorative dividers.** A structured section marker your language supports is fine; a hand-drawn
  bar of dashes is not.
- **Migration history.** No "moved from X", "was previously inline", "new in the refactor". Git
  already knows.
- **Ticket ids.** Worst in public API docs, where they leak an internal tracker to consumers.
- **Commentary on the change.** A comment describes the code as it stands, never how it got there.

## Always

- **Public declarations keep their doc comments.** They are the contract, and are exempt from the
  member limit where the contract genuinely needs the words.
- **Never delete an existing comment or TODO** unless explicitly asked. This rule constrains what you
  *write*, never what you remove.

## When a doc comment is warranted

| Declaration | Doc comment |
|-|-|
| Public or exported | **Yes** — always. It is the contract. |
| Internal helper with a non-obvious exception | Yes — one line naming the exception |
| Internal helper that is self-evident from its name | No |
| Override or conformance with no added behavior | No |
| A constant whose value encodes a decision | Yes — why *this* value |

**Never overwrite an existing doc comment.** Add where one is missing; reconcile only when the
contract it describes has actually changed.

## Self-check before finishing

Every added comment line that follows another added comment line — every multi-line block you just
wrote:

```bash
git diff -U0 | awk '/^\+ *(\/\/|#|--)/{n++; if (n>1) print; next} {n=0}'
```

Empty output, or only type-level overviews, is a pass. Anything else is over the limit until you can
name why that specific block earns a second line.
