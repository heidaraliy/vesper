# Implementation Accuracy Review

Use before finalizing non-trivial work.

- Does the diff solve the user request directly?
- Did implementation follow existing Vesper module boundaries?
- Are Discord, worker, safety, artifact, and database state transitions still coherent?
- Are secrets, host paths, project roots, worktree roots, artifacts, and databases protected?
- Are errors persisted or surfaced with enough context to debug?
- Are tests focused on the behavior and risk that changed?
- Did validation run from the correct worktree and branch?
- Are residual risks concrete and documented?
