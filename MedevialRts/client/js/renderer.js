// Renderer switch.
//
// The game currently uses the 2D top-down renderer (render.js, PNG sprites —
// see assets/README-ART.md). The 3D Three.js renderer is SAVED in
// render3d.js + models.js: flip USE_3D to true to bring it back.

export const USE_3D = false;

const impl = await import(USE_3D ? './render3d.js' : './render.js');

export const initRender = impl.initRender;
export const setupWorld = impl.setupWorld;
export const draw = impl.draw;
export const addShot = impl.addShot;
export const addPoof = impl.addPoof;
export const screenToWorld = impl.screenToWorld;
export const viewports = impl.viewports;
export const vpForLocal = impl.vpForLocal;
export const camStateFor = impl.camStateFor;
