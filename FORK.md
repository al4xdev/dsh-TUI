# al4xdev fork of dsh-TUI

Branch `custom` is upstream `ccch1mneyyy/dsh-TUI` `main` plus a short stack of
atomic commits. Each commit owns one feature so it can be dropped when upstream
absorbs it. Keep fork notes here, not in `README.md`/`README_ZH.md`: those files
change upstream on every release and would conflict.

Previous history (before the v0.19 rebuild): `backup/custom-20261109`, and the
same tree as one commit: `backup/custom-squash-20261109`.

## Updating from upstream

```sh
git fetch upstream
git rebase upstream/main custom
pnpm install --frozen-lockfile && pnpm compile
git push --force-with-lease origin custom
```

Then bump the TUI pin in dsh-customs `tools/clean-install/forks-manifest.json`.

## Fork features

### Background question ownership

On DSH, questionnaires from sessions whose background handles belong to this TUI
remain answerable after `/bg`. Other terminals' agents are not claimed.
Upstream candidate (bug fix).
