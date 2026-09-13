# Emulator patches

`tools/fetch-runtime.sh` applies every `*.patch` in this directory, in filename
order, to a clean checkout of wine-assembly at the commit in
[`../engine.pin`](../engine.pin).

The patches are plain `git diff` output rooted at the wine-assembly tree, so
they can be regenerated with:

```bash
git -C <wine-assembly-checkout> diff > runtime/patches/NNNN-description.patch
```

Rules for this directory:

* One concern per patch; name it `NNNN-short-description.patch`.
* Only runtime source needed by the shipped engine belongs here. Test-harness
  debug edits and experiments stay out.
* Each patch should keep the engine's own Win16 corpus green; note the tests run
  in the patch's commit message or in `RUNTIME.md`.
* Rebasing onto a new `engine.pin` may require refreshing the patches; run
  `tools/fetch-runtime.sh --force` and `tools/browser-check.mjs` afterwards.
