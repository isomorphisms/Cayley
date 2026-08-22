# Cayley

Native, touch-first Cayley explorer.

The inherited Group Explorer repository is preserved under `old/` as reference. New work should not depend on its application structure.

## Filesystem as a graph

Symlinks are intentional here. There is no single privileged hierarchy: a group should lead to its representations and symmetry objects, and those objects should lead back to the groups that use them.

`groups/raw` exposes the inherited `.group` library without copying it.

A5 is the first cross-linked example:

```text
groups/A5/
  source.group -> ../raw/A_5.group
  representations/{1,2,3} -> representations/A5/{1,2,3}
  symmetry_objects/{icosahedron,dodecahedron} -> symmetry_objects/...

representations/A5/1/group -> groups/A5
symmetry_objects/Icosahedron/group -> groups/A5
```

The paired symlinks are deliberately redundant navigation. The underlying mathematical data should still have one owner; links provide alternate ways to reach it.

## Direction

The active application will be a native Android app aimed at the phone first. High-level control belongs in Idriç. Painting should use the existing Idriç/GLSL path. The first APK goal is deliberately tiny: choose one bundled group at random, render one group page, and exit.
