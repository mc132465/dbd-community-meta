# data/game

Canonical, version-controlled game-data files. The importer
(`pnpm import:game`) reads from here and upserts by `slug` (patches by
`version`).

Phase 1 ships a **small, original placeholder dataset** purely to exercise the
structure — fictional characters/perks/maps, all with `image_url: null`. None of
it is real or copyrighted game data.

```
patches.json  characters.json  perks.json
add-ons.json  items.json        maps.json
```

To add real content later: replace/extend these JSON files (referencing parents
by slug/version) and re-run `pnpm import:game`. No code changes required.
`offerings.json` and others can be added the same way.
