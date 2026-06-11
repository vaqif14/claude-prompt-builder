Use a fresh context per independent task; provide only its task card, relevant file-map rows, invariants, required evidence, and verification command.
After each task, run specification-compliance review first and code-quality review second; both must pass.
Dispatch independent domains concurrently. Serialize coupled files, shared state, and dependent tasks.
Continue through approved tasks without asking whether to continue; stop only for a real blocker, user-owned ambiguity, required approval, or completion.
If subagents are unavailable, execute the same lanes sequentially and keep their evidence separate.
