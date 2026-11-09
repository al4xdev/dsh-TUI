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

### `updateCheck: false`

Plugin config `updateCheck: false` skips the startup "new version available"
notice and the launchpad update action. This fork is not the npm package, so a
newer upstream release is not an update for it. `/update` still checks on demand.
Default `true` keeps upstream behavior. Upstream candidate.

### Markdown for scenes

Full-screen scenes receive `ui.Markdown`, `ui.markdownSourceRange` and
`ui.markdownSourceBlocks`. `preserveSource` keeps prompt XML tags (alias of
`stripPromptTags: false`). Optional `sourceNavigation: { line, onSelect,
commentLines, scrollRef }` adds a block cursor and mouse selection; list items
are separate anchors, wrapped terminal rows are never source lines. Used by the
dsh-customs `managed-plans` scene.

### External `/plan` command

Plugin config `externalPlanCommand: true` (default `false`) treats the registry
`/plan` as an external command instead of native plan mode:

- `/plan …` runs the registered command verbatim (no on/off picker, no `on`
  normalization); the command owns its grammar and refusals.
- `/plan` completions come from the command's `tuiCommandTrees` provider.
- The Shift+Tab cycle drops plan-entering modes and strips the `plan` atom from
  the rest, so it never dispatches `/plan` or `/plan off`.

Disable native `plan-mode` in every preset. The flag does not filter native
plan-mode events. Regression (not in `package.json`, to avoid conflicts):
`node --import tsx/esm scripts/verify-external-plan.ts`.

### Managed-plan tool results as Markdown

Expanded, settled results of `plan_read`, `plan_stage`, `plan_reopen`,
`plan_close`, `plan_list` and `exit_plan_mode` render as Markdown. Other tools,
errors and machine JSON stay unchanged. Upstream has no tool-result renderer
seam for plugins.
