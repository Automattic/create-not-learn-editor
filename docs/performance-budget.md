# Performance budget

The editor is built from large WordPress packages, and it's easy for a route to pick up a few hundred kilobytes without anyone noticing. The budget is a cheap guard against that. It looks only at the build, so it needs no WordPress site, no browser and no timings that vary between runs.

## What it measures

`scripts/performance-budget.mjs` reads `build/` and measures what WordPress serves with `SCRIPT_DEBUG` off.

| Indicator | What it is |
|---|---|
| `routes/home/content.js`, `styles/app-init/style.css` and so on | The gzipped size of each minified script and style sheet. Right-to-left sheets are left out, as they match their counterparts |
| `routes/home/content.dependencies` and so on | How many WordPress scripts and script modules the entry asks for, from its `.min.asset.php` |
| `total.js`, `total.css` | The gzipped size of every script, and of every style sheet |

The build is the same on every run of the same code, so every number is exact and a budget can be tight.

## The budgets

`tests/performance/budgets.json` holds the most each indicator may be. Sizes are in bytes, gzipped. They were set at the build's size plus about 5%, rounded up to the next kilobyte. Dependency counts were set at exactly what each entry asked for, since adding a WordPress script to a route should be a choice someone makes, not a side effect.

A file without a budget is listed in the report and only the totals cover it. Give a new entry a budget of its own when it should have one.

## In CI

The `performance` job in `.github/workflows/ci.yml` builds the pull request and its base, and writes the report to the job summary.

- **Over budget** fails the job. So does a budget for a file the build no longer makes.
- **Changes against base** lists every size that moved by at least 1% and 500 bytes, every dependency added or dropped by name, and files that are new or gone. It doesn't fail the job.
- **Every indicator** is the full table, with the minified size beside the gzipped one.

On trunk, and when run by hand, there's no base, so the job only checks the budgets. If base fails to build, the job still checks head.

## When a number goes over

Look at what moved first. The usual causes are a new `@wordpress/*` import in a route, which brings the package and everything it imports into that route's bundle, or `@wordpress/dataviews` or `@wordpress/block-library` imported outside the places AGENTS.md allows.

If the rise is meant, raise the number in `budgets.json` in the same pull request and say why in its description. When something gets smaller, lower its budget too, so the room it freed isn't quietly taken up again.

## Running it locally

```sh
npm run build
npm run perf:budget
```

To compare with another build, give its folder: `npm run perf:budget -- --base ../other-checkout/build`.
