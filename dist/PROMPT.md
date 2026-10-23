# Human Anatomy — illustration × open 3D atlas

Adapt the existing Car Anatomy Inspector interaction pattern to the supplied
"human body health GIF.gif". Prepare a standalone project suitable for the
GitHub repository human-anatomy-inspector. Keep website hosting local in
this iteration; uploading source to GitHub is separate from publishing a site.

Preserve the three original 233 × 480 anatomical illustrations: bones and
organs, a posterior nerve/vessel view, and a muscular view. Do not redraw them
or manufacture image detail. Provide two explicit modes:

## Original illustration

Create a 15-second, 15-fps loop with six stages: ACQUIRE, SILHOUETTE,
STRUCTURE, FEATURES, PALETTE, ATLAS. Use source-derived masks, outlines and
triangle overlays, then sequentially inspect skull, thoracic cage, vertebral
column, intestines and pelvis. Magnified insets must copy the actual pixels
of an appropriate original frame and preserve crop proportions. Keep all
text outside the head and main anatomical artwork.

Provide play/pause, timeline, loop and stage selection, plus manual selection
of five regions. A mini body map marks the selected region. The six-color
palette comes from k-means over the foreground of the three source views.
Export the illustration tour as an infinitely looping GIF and silent MP4.

## Separate 3D anatomy

Use the browser-ready Z-Anatomy / BodyParts3D-derived GLB exports from
JMK712/human-anatomy-online, pinned to commit
322ba39e96ea91ce08601caad2c0aaade1dc99f0. Download and vendor the five systems:
skeleton, muscles, cardiovascular, nervous and visceral. Keep all upstream
attribution and component-specific notices. This atlas is a separate
reference model and does not reconstruct the same body from the GIF.

Use local Three.js 0.186.1 modules, GLTFLoader, DRACOLoader and OrbitControls.
Load bones and organs first; lazily load other systems. Support drag rotation,
zoom, independent layer visibility, adjustable opacity, direct mesh picking,
regional selection, isolated view, front/back view and camera reset.
Preserve the model's original English structure names; translate known
regional and bone labels into Russian without inventing descriptions.

## Presentation and delivery

Use a quiet atlas style: warm paper, dark green accent, readable typography,
restrained grids and smooth component inset motion adapted from Anatomy.
Use a dark 3D stage for contrast. Provide responsive layouts, reduced-motion
support, and basic keyboard controls. Labels and controls are Russian.
Use educational descriptions; do not invent diagnoses, body measurements,
clinical scores, or patient-specific findings.

Deliver a standalone static website, local launch command/shortcut, source
assets, licensing/provenance, export files, and verification results. Include
them in human-anatomy-inspector. Do not register remote website hosting in
this iteration.
