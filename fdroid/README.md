# F-Droid release path

This Android package is a modified distribution of Group Explorer, not a replacement claim over the upstream project.

Upstream: https://github.com/nathancarter/group-explorer

The upstream README credits Ray Ellis and Nathan Carter and declares LGPL v3. The fork preserves that attribution and license. See `NOTICE.md` and `lib/three-146/LICENSE` for provenance and bundled third-party licensing.

Release procedure:

1. Run the `F-Droid release build` workflow and require it to pass.
2. Tag the exact release commit `v0.1.0`.
3. Replace `FULL_COMMIT_HASH` in `fdroid/org.isomorphisms.groupexplorer.yml.template` with the tagged commit hash.
4. Submit the metadata as `metadata/org.isomorphisms.groupexplorer.yml` to fdroiddata.
5. Keep the upstream Fastlane metadata under `fastlane/metadata/android/en-US/` synchronized with the app.

The F-Droid build uses the source-controlled Android wrapper in `android-app/` and bundles the checked-in Group Explorer web source. F-Droid signs the resulting release APK with its own key.

The Android package has its own distribution version (`0.1.0`) while the embedded inherited Group Explorer web code retains its upstream 3.6.1 identity. This avoids pretending the fork has issued a new upstream Group Explorer release.
