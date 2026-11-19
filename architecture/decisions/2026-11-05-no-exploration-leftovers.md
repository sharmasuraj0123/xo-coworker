# Only the owner's picks reach `:3000`

- **Decided:** 5 Nov 2026, by the owner, who called the leftovers careless.
- **Rule:** once the owner has picked an option, the merge strips everything used to explore it: switchers, test flags, `?x=` debug parameters, demo pages, alternative looks.
- **Check:** before any merge to a release branch, search the diff for these. A test for this belongs in the check command.
