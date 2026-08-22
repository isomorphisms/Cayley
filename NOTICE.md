# Provenance and license notice

Cayley is a modified distribution of Nathan Carter's Group Explorer:
https://github.com/nathancarter/group-explorer

Canonical source for this modified distribution:
https://github.com/isomorphisms/Cayley

The upstream project identifies Ray Ellis as the developer of most of the web version and Nathan Carter as the developer of the original version, the author of the built-in help system, and a contributor to the web version. Upstream `README.md` and `package.json` identify Group Explorer as GNU LGPL version 3 software.

This fork contains modifications made by the isomorphisms project in 2026, including Android packaging and symmetry-pattern work. Group Explorer-derived code remains under GNU LGPL version 3. `COPYING.LESSER` and `COPYING` contain the LGPL v3 and incorporated GPL v3 license texts. Files with separate license notices retain their own terms.

## Bundled third-party code

`lib/three-146/` contains three.js r146. Its included `LICENSE` file identifies it as MIT-licensed and carries the copyright notice for the three.js authors. That license file remains with redistributed copies.

Some inherited HTML pages load jQuery and Font Awesome from cdnjs at runtime. They are not copied into this repository's Android asset bundle as separate vendored packages; their own upstream licenses continue to apply when they are retrieved. Those pages therefore use network access for those CDN-hosted UI assets.

## F-Droid metadata

Upstream uses the legacy SPDX expression `LGPL-3.0`. The F-Droid recipe in this fork uses `LGPL-3.0-only`, the current SPDX form for version 3 without adding an `or-later` grant. This is a metadata normalization, not a relicensing claim.
