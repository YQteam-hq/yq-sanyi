# yq-sanyi Performance Harness

`bench/` drives the real render pipeline inside a small headless DOM and measures what the library costs. It needs no browser, no third-party package and no network, so the same numbers come out of a laptop and out of CI.

```bash
npm run bench
```

`npm run check:perf` runs the same entry point, and `npm run check:all` chains it after the dependency-graph, bundle-size and comment gates. The bench exits non-zero as soon as one budget is missed, which makes it the `Repo gates` step of the required `Build / Typecheck / Test` check.

## What is measured

| Metric | Budget | Rule | What is measured |
| --- | --- | --- | --- |
| `first-interactive` | `<= 1000 ms` | max | Cold boot of a 3000-row board: `define` plus template parsing, mounting, the first animation frame, and a click that has to reach the DOM. 10 samples after 2 warm-up runs. |
| `update-latency` | `<= 200 ms` | max | Time from a state write that replaces all 3000 rows to the moment the DOM shows the new revision. 60 samples after 10 warm-up updates. |
| `scroll-fps` | `>= 55 fps` | min | Scroll frames over a 2000-row list with a 200-row window that advances 4 rows per frame. The typical frame cost is converted into a frame rate. 3 runs of 100 measured frames after 20 warm-up frames. |
| `scroll-frame-ops` | `<= 900 ops/frame` | max | DOM mutations the renderer performs to move the same scroll window by one frame. Counted, not timed. |

## The verdict statistic

Every wall-clock metric reports a full set of percentiles but **asserts the typical case, the p50**. The p95 tail and the run-to-run spread are printed as diagnostics.

That choice follows from measurement, not from preference. The harness installs an operation counter in its own DOM, and the work the renderer does per scroll frame is exactly constant:

```
bench scroll-frame-ops target <= 900 ops/frame measured 705 ops/frame p50 705 distinct 1 frames 119 visible rows 200 created 20 inserted 216 removed 4 text 245 attribute 20 listener 200 -> PASS
```

`distinct 1` means all 119 frames performed an identical `705` operations. The wall-clock cost of that same, unchanged work is not constant at all:

| statistic | frame cost |
| --- | --- |
| p0 | 2.364 ms |
| p50 | 3.108 ms |
| p90 | 22.488 ms |
| p95 | 46.928 ms |
| p99 | 81.221 ms |
| max | 103.675 ms |

68% of frames land under 4 ms and about 10% land above 16 ms. The work is identical, so that 43x range is scheduler, garbage-collector and host noise, not rendering. The p95 is drawn entirely from the stall band, which is why asserting on it produced a coin flip: across 8 consecutive runs of the **unmodified** harness on an unmodified `main`, 7 runs failed a budget, and the failures moved between metrics from run to run.

Recomputing the same 8 runs against the p50 sample passes all of them, because the p50 lands in the band where the real work lives. The p95 is still printed, so the tail stays visible and comparable between machines.

## The deterministic gate

Wall-clock numbers cannot be reproduced exactly, so they cannot be the only regression signal. `scroll-frame-ops` counts the DOM mutations the renderer issues per frame and is completely independent of machine speed and host load. A change that makes the renderer touch twice as many nodes fails the gate on a fast laptop and on a loaded runner alike.

An operation is one of:

| Counter | Incremented on |
| --- | --- |
| `created` | element construction |
| `attribute` | `setAttribute` |
| `attributeRemoved` | `removeAttribute` that removes an existing attribute |
| `inserted` | `appendChild` / `insertBefore` that changes the tree |
| `removed` | `removeChild` that changes the tree |
| `text` | a `textContent` write |
| `listener` | `addEventListener` |

Counting is **opt-in**. `enableRenderOpCounting(true)` turns it on and clears the counters; the default is off. The timing passes therefore run the original code path with a single predictable branch per mutation, so measuring the work does not change the thing being timed. The harness measures the frame cost first with counting off, and then drives one extra pass with counting on to read the work out.

The `900 ops/frame` limit is the measured `705` plus about 28% headroom. It is an upper bound on work, so a legitimate optimization that lowers the count keeps passing, while a regression that raises it fails. If the scroll scenario constants (`SCROLL_ROWS`, `SCROLL_VISIBLE`, `SCROLL_STEP`) change, the measured count changes and the limit has to be re-derived the same way.

## Reading the output

```
bench first-interactive target <= 1000 ms measured 590.06 ms p95 1103.43 ms best 469.93 ms spread 2.35x runs 10 -> PASS
bench update-latency target <= 200 ms measured 133.32 ms p95 274.35 ms best 75.78 ms spread 4.38x runs 60 -> PASS
bench scroll-fps target >= 55 fps measured 217.43 fps frame p50 4.599 ms worst run p50 6.363 ms run p50 4.246/4.599/6.363 ms runs 3 -> PASS
bench scroll-frame-ops target <= 900 ops/frame measured 705 ops/frame p50 705 distinct 1 frames 119 visible rows 200 created 20 inserted 216 removed 4 text 245 attribute 20 listener 200 -> PASS
```

- `measured` is the asserted value: the p50 for the millisecond metrics, the rate derived from the p50 frame cost for `scroll-fps`, and the p95 operation count for `scroll-frame-ops`.
- On a fast run both `p95` values above exceed their budget while `measured` does not. That is the intended reading: the typical case is asserted, the tail is reported.
- `scroll-fps` is **not capped at the display rate**. The value is `1000 / frame p50`, so a faster result keeps reading faster and a regression stays visible long before it reaches the 55 fps limit. A `frame p50` of 3 ms is `333 fps`, not `60`.
- `distinct` is the number of different per-frame operation counts seen. Any value above `1` means the renderer's work per frame is not constant, which is worth investigating on its own.
- `spread` is the max-over-min ratio inside one sample set. A large value together with a failing `measured` is the signature of a noisy host rather than a slow library.

## Extending the harness

- `bench/env.mjs` installs the headless DOM and owns the operation counters.
- `bench/app.mjs` defines the board component the scenarios drive.
- `bench/bench.mjs` owns the scenarios, the budgets and the reporting.
- `bench/stats.mjs` holds the pure helpers (`percentile`, `median`, `spread`, `round`, `rateFromCost`, `formatSeries`).

A new budget is one entry in `BUDGETS` plus a function that returns `{ name, unit, value, detail }`. `report` derives the comparison direction from `rule` and needs no change.

The harness tests live in `packages/core/test/bench-harness.test.mjs`. They sit there only because the root `test` script enumerates `packages/core/test/*.test.mjs`, which is the single entry point the runner expands; the file covers `bench/stats.mjs` and the operation counter directly and does not need a build. Move it next to the harness when the test glob is widened.

## Relationship to the README

The "Performance gate" section of `README.md` describes the budgets from the outside. It is updated in the same change that reworks the estimator; if the two ever disagree, this document and `bench/bench.mjs` are authoritative.
