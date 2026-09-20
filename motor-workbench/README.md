# Miniature BLDC motor workbench

This portfolio page is a static preview of the cylindrical wall-coil study. The downloadable `.blend` contains the generated motor and its two-second exploded timeline.

For the interactive calculator and Blender synchronization, use the full motor-workbench project from the design workspace, then run it from that project directory:

```sh
python3 server.py --port 8787
```

Open `http://localhost:8787/web/`. Blender must be running with the local bridge enabled on port `9876`; the webpage then uses **Send to Blender** to rebuild the `BLDC Motor Study` scene. `BLDC_BLENDER_BIN` can point to a Blender executable when rendering locally.

The GitHub Pages version cannot open a visitor's localhost Blender process. This local path is deliberately explicit so another Blender user can reproduce the connection instead of seeing a misleading online-only button.
