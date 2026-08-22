# Provenance and license notice

This repository is a fork of Nathan Carter's Group Explorer:
https://github.com/nathancarter/group-explorer

The upstream project identifies Ray Ellis as the developer of most of the web version and Nathan Carter as the developer of the original version, the author of the built-in help system, and a contributor to the web version. Upstream `README.md` and `package.json` identify Group Explorer as GNU LGPL version 3 software.

The `isomorphisms/group-explorer` fork preserves that attribution and license. Changes in this fork include mobile/Android packaging and additional symmetry-pattern work; those changes do not erase or replace the copyright or license of inherited Group Explorer code.

## Bundled third-party code

`lib/three-146/` contains three.js r146. Its included `LICENSE` file identifies it as MIT-licensed and carries the copyright notice for the three.js authors. That license file must remain with redistributed copies.

Some inherited HTML pages also load jQuery and Font Awesome from cdnjs at runtime. They are not copied into this repository's Android asset bundle as separate vendored packages; their own upstream licenses continue to apply when they are retrieved.

## F-Droid metadata

Upstream uses the legacy SPDX expression `LGPL-3.0`. The F-Droid recipe in this fork uses `LGPL-3.0-only`, the current SPDX form for version 3 without adding an `or-later` grant. This is a metadata normalization, not a relicensing claim.
