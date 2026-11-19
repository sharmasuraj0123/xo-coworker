# Quote a commit hash only after reading it from git

- **Decided:** 19 Nov 2026, after three invented hashes went out in messages.
- **Rule:** every hash in a message, commit or doc is copied from `git log`/`git rev-parse` output, never written from memory.
