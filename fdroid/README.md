# F-Droid release path

Cayley is a modified Android distribution of Group Explorer, not a replacement claim over the upstream project.

Upstream: https://github.com/nathancarter/group-explorer

Modified source: https://github.com/isomorphisms/Cayley

The upstream README credits Ray Ellis and Nathan Carter and declares LGPL v3. The fork preserves that attribution and license. See `NOTICE.md`, `COPYING.LESSER`, `COPYING`, and `lib/three-146/LICENSE` for provenance and bundled third-party licensing.

## Stack and first release

The release work is stacked as PR #2 -> PR #5 -> PR #7. Land the stack into `cayley` in this order:

1. Merge PR #2 into `cayley`.
2. Retarget PR #5 from `scriptable-symmetry-patterns` to `cayley`, confirm its checks and diff, then merge it.
3. Retarget PR #7 from `scriptable-symmetry-patterns-apk` to `cayley`, confirm its checks and diff, then merge it.

If a lower PR is squash-merged or rebased instead of merged with ancestry preserved, rebase the dependent branch before retargeting so the next PR contains only its intended layer.

Do not create the Android release tag on a branch-only commit. After PR #7 has landed on `cayley`, tag the exact integrated release commit `android-v0.1.0`.

Before submitting a third-party app to F-Droid, follow F-Droid's current inclusion guidance, including notifying the upstream app authors when the submitter is not the upstream author.

Release procedure:

1. Require the `Pattern tests` and `F-Droid release build` checks to pass after each retarget and on the integrated `cayley` release commit.
2. Confirm the Android package is `org.isomorphisms.groupexplorer`, the launcher/store name is `Cayley`, `versionName` is `0.1.0`, and `versionCode` is `1`.
3. Tag that exact commit `android-v0.1.0`.
4. Copy `fdroid/org.isomorphisms.groupexplorer.yml.template` to `metadata/org.isomorphisms.groupexplorer.yml` in fdroiddata and replace `REPLACE_WITH_FULL_RELEASE_COMMIT_SHA` with the 40-character SHA of that integrated release commit. F-Droid's initial build metadata should identify the exact source revision rather than a branch or tag name.
5. Keep `fastlane/metadata/android/en-US/` synchronized with the app.

The F-Droid build uses the Android project in `android-app/` and bundles the checked-in Group Explorer web source. F-Droid signs the resulting release APK with its own key. The current F-Droid Gradle selector maps Android Gradle Plugin 8.7.x to Gradle 8.9, and the release CI uses that same Gradle version.

## Version policy

`org.isomorphisms.groupexplorer` is the stable Android application ID. Android `versionName` and `versionCode` belong to this distribution and are independent of the inherited Group Explorer web version. Increment `versionCode` for every published Android release and tag releases as `android-v<versionName>`.

The initial Android release is `0.1.0` / `1`; the embedded inherited Group Explorer web code retains its upstream 3.6.1 identity. This avoids pretending the fork has issued a new upstream Group Explorer release.
