# Graphics log (AAA pass)

One entry per phase: what changed, before/after screenshots in `docs/screens/aaa/`, and an
honest critique of what is still weak.

## A0: technology spike

- Built the same test scene in Phaser Light2D and in Three.js; decision and numbers are in
  [graphics-decision.md](graphics-decision.md). Chosen: hybrid (Three.js battlefield, Phaser HUD).
- Screens: `a0-phaser.jpg`, `a0-three.jpg`.

**Self-critique.** The 3D spike proves the technology, not the art. The Bastion is a stack of
untextured primitives and reads as a white placeholder. The ground is blocky per-vertex colour
with a noise detail map that looks like carpet. The cliffs are soft lumps with no rock faces.
The units are tiny at this zoom and their capsule limbs look like toys. The lighting is too
orange and flat outside the point lights. None of this is acceptable as final; A2–A5 exist to
fix it. What *is* already better than the 2D game: contact shadows and cast shadows from
every object, real light falloff, and specular on armour.
