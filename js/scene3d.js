(function (global) {
  "use strict";

  var NS = (global.HardwareSim = global.HardwareSim || {});

  // =========================================================================
  // Estado interno del motor 3D Canvas 2D
  // =========================================================================

  var canvas = null;
  var ctx = null;
  var callbacks = {};

  var viewW = 960;
  var viewH = 600;
  var dpr = 1;

  var BG_COLOR = "#FAF9F5";
  var GRID_MINOR_COLOR = "#EAE7DF";
  var GRID_MAJOR_COLOR = "#D5D1C5";
  var GRID_AXIS_X = "rgba(0, 129, 132, 0.28)";
  var GRID_AXIS_Z = "rgba(155, 132, 98, 0.28)";
  var GRID_LABEL_COLOR = "#9D988B";

  var NEAR_CLIP = 6;
  var LIGHT_DIR = vecNorm({ x: 0.42, y: 0.85, z: 0.34 });

  var camera = {
    yaw: 0.28,
    pitch: 0.66,
    dist: 305,
    target: { x: 0, y: 4, z: 0 },
    anim: null
  };

  var state = {
    wireColor: "#D93025",
    pendingWireStart: null, // { compId, pinId }
    selected: null,         // { kind: "component"|"wire", id }
    hoveredPin: null,       // { compId, pinId, screenX, screenY }
    hoveredItem: null,      // { kind, id }
    mouseCanvas: { x: 0, y: 0, inside: false },
    mouseClient: { x: 0, y: 0 },
    drag: null,
    uploadFlashMs: 0,
    animTimeMs: 0,
    lastSimState: null,
    projectedPins: [],      // [{ comp, pin, sx, sy, depth, isBreadboard }]
    projectedWires: [],     // [{ wire, pts: [{x,y,depth}], midPt }]
    pinLookup: Object.create(null),
    breadboardSlices: null,
    colorRgbCache: Object.create(null),
    resizeObserver: null,
    listenersAttached: false
  };

  // =========================================================================
  // Utilidades matemáticas y de color
  // =========================================================================

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function vecSub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  function vecAdd(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  function vecDot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  function vecCross(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }

  function vecLen(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  function vecNorm(v) {
    var l = vecLen(v);
    if (l < 1e-8) return { x: 0, y: 1, z: 0 };
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  }

  function rotateLocal(lx, ly, lz, rotY) {
    if (!rotY) return { x: lx, y: ly, z: lz };
    var c = Math.cos(rotY);
    var s = Math.sin(rotY);
    return {
      x: lx * c + lz * s,
      y: ly,
      z: -lx * s + lz * c
    };
  }

  function localToWorld(comp, lx, ly, lz) {
    var p = (comp && comp.pos) || { x: 0, y: 0, z: 0 };
    var r = rotateLocal(lx, ly, lz, (comp && comp.rotY) || 0);
    return {
      x: (p.x || 0) + r.x,
      y: (p.y || 0) + r.y,
      z: (p.z || 0) + r.z
    };
  }

  function worldToLocal(comp, wx, wy, wz) {
    var p = (comp && comp.pos) || { x: 0, y: 0, z: 0 };
    var dx = wx - (p.x || 0);
    var dy = wy - (p.y || 0);
    var dz = wz - (p.z || 0);
    var rotY = (comp && comp.rotY) || 0;
    if (!rotY) return { x: dx, y: dy, z: dz };
    var c = Math.cos(rotY);
    var s = Math.sin(rotY);
    return {
      x: dx * c - dz * s,
      y: dy,
      z: dx * s + dz * c
    };
  }

  function parseColorRgb(color) {
    if (!color) return { r: 180, g: 180, b: 180, a: 1 };
    var cached = state.colorRgbCache[color];
    if (cached) return cached;

    var res = { r: 180, g: 180, b: 180, a: 1 };
    if (color.charAt(0) === "#") {
      var h = color.slice(1);
      if (h.length === 3) {
        res = {
          r: parseInt(h.charAt(0) + h.charAt(0), 16),
          g: parseInt(h.charAt(1) + h.charAt(1), 16),
          b: parseInt(h.charAt(2) + h.charAt(2), 16),
          a: 1
        };
      } else if (h.length >= 6) {
        res = {
          r: parseInt(h.slice(0, 2), 16),
          g: parseInt(h.slice(2, 4), 16),
          b: parseInt(h.slice(4, 6), 16),
          a: 1
        };
      }
    } else {
      var m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(color);
      if (m) {
        res = {
          r: Number(m[1]),
          g: Number(m[2]),
          b: Number(m[3]),
          a: m[4] !== undefined ? Number(m[4]) : 1
        };
      }
    }
    state.colorRgbCache[color] = res;
    return res;
  }

  function shadeColor(hexOrRgba, lightFactor, alphaOverride) {
    var rgb = parseColorRgb(hexOrRgba);
    var r = clamp(Math.round(rgb.r * lightFactor), 0, 255);
    var g = clamp(Math.round(rgb.g * lightFactor), 0, 255);
    var b = clamp(Math.round(rgb.b * lightFactor), 0, 255);
    var a = alphaOverride !== undefined ? alphaOverride : rgb.a;
    if (a < 0.999) {
      return "rgba(" + r + "," + g + "," + b + "," + a.toFixed(3) + ")";
    }
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function mixColor(hexA, hexB, t) {
    var a = parseColorRgb(hexA);
    var b = parseColorRgb(hexB);
    var r = Math.round(lerp(a.r, b.r, t));
    var g = Math.round(lerp(a.g, b.g, t));
    var bl = Math.round(lerp(a.b, b.b, t));
    return "rgb(" + r + "," + g + "," + bl + ")";
  }

  // =========================================================================
  // Acceso a pines y Datasheets
  // =========================================================================

  function getComponentPins(type) {
    var ds = NS.Datasheets;
    if (!ds) return [];
    if (typeof ds.getPinsForType === "function") {
      return ds.getPinsForType(type) || [];
    }
    var item = typeof ds.get === "function" ? ds.get(type) : ds.ITEMS && ds.ITEMS[type];
    return (item && item.pinout) || [];
  }

  function findPinDef(comp, pin) {
    if (!comp) return null;
    if (pin && typeof pin === "object" && pin.localPos) {
      return pin;
    }
    var pinId = typeof pin === "string" ? pin : pin && pin.id;
    if (!pinId) return null;

    var pins = getComponentPins(comp.type);
    for (var i = 0; i < pins.length; i++) {
      if (pins[i].id === pinId) return pins[i];
    }
    return null;
  }

  function getWorldPinPosition(comp, pin) {
    if (!comp) return { x: 0, y: 0, z: 0 };
    var pinDef = findPinDef(comp, pin);
    if (!pinDef || !pinDef.localPos) {
      var p = comp.pos || { x: 0, y: 0, z: 0 };
      return { x: p.x || 0, y: p.y || 0, z: p.z || 0 };
    }
    return localToWorld(comp, pinDef.localPos.x, pinDef.localPos.y, pinDef.localPos.z);
  }

  // =========================================================================
  // Cámara orbital 3D y proyección perspectiva
  // =========================================================================

  function getCameraBasis() {
    var cp = Math.cos(camera.pitch);
    var sp = Math.sin(camera.pitch);
    var cy = Math.cos(camera.yaw);
    var sy = Math.sin(camera.yaw);

    var camPos = {
      x: camera.target.x + camera.dist * cp * sy,
      y: camera.target.y + camera.dist * sp,
      z: camera.target.z + camera.dist * cp * cy
    };

    var forward = { x: -cp * sy, y: -sp, z: -cp * cy };
    var right = { x: cy, y: 0, z: -sy };
    var up = { x: -sp * sy, y: cp, z: -sp * cy };
    var fovFactor = Math.max(420, Math.min(viewW, viewH) * 1.15);

    return {
      camPos: camPos,
      forward: forward,
      right: right,
      up: up,
      fovFactor: fovFactor,
      halfW: viewW * 0.5,
      halfH: viewH * 0.5
    };
  }

  function projectPoint(basis, wx, wy, wz) {
    var dx = wx - basis.camPos.x;
    var dy = wy - basis.camPos.y;
    var dz = wz - basis.camPos.z;
    var cz = dx * basis.forward.x + dy * basis.forward.y + dz * basis.forward.z;
    if (cz <= NEAR_CLIP) return null;
    var cx = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
    var cy = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
    var s = basis.fovFactor / cz;
    return {
      x: basis.halfW + cx * s,
      y: basis.halfH - cy * s,
      z: cz,
      s: s
    };
  }

  function toCameraSpace(basis, p) {
    var dx = p.x - basis.camPos.x;
    var dy = p.y - basis.camPos.y;
    var dz = p.z - basis.camPos.z;
    return {
      x: dx * basis.right.x + dy * basis.right.y + dz * basis.right.z,
      y: dx * basis.up.x + dy * basis.up.y + dz * basis.up.z,
      z: dx * basis.forward.x + dy * basis.forward.y + dz * basis.forward.z
    };
  }

  function projectClippedSegment(basis, a, b) {
    var ca = toCameraSpace(basis, a);
    var cb = toCameraSpace(basis, b);
    if (ca.z <= NEAR_CLIP && cb.z <= NEAR_CLIP) return null;
    if (ca.z <= NEAR_CLIP) {
      var tA = (NEAR_CLIP - ca.z) / (cb.z - ca.z);
      ca = {
        x: lerp(ca.x, cb.x, tA),
        y: lerp(ca.y, cb.y, tA),
        z: NEAR_CLIP
      };
    } else if (cb.z <= NEAR_CLIP) {
      var tB = (NEAR_CLIP - cb.z) / (ca.z - cb.z);
      cb = {
        x: lerp(cb.x, ca.x, tB),
        y: lerp(cb.y, ca.y, tB),
        z: NEAR_CLIP
      };
    }
    var sa = basis.fovFactor / ca.z;
    var sb = basis.fovFactor / cb.z;
    return {
      ax: basis.halfW + ca.x * sa,
      ay: basis.halfH - ca.y * sa,
      bx: basis.halfW + cb.x * sb,
      by: basis.halfH - cb.y * sb,
      depth: (ca.z + cb.z) * 0.5
    };
  }

  function screenToRay(basis, sx, sy) {
    var nx = (sx - basis.halfW) / basis.fovFactor;
    var ny = (basis.halfH - sy) / basis.fovFactor;
    var dir = vecNorm({
      x: basis.forward.x + nx * basis.right.x + ny * basis.up.x,
      y: basis.forward.y + nx * basis.right.y + ny * basis.up.y,
      z: basis.forward.z + nx * basis.right.z + ny * basis.up.z
    });
    return { origin: basis.camPos, dir: dir };
  }

  function screenToGroundPlane(basis, sx, sy, planeY) {
    var ray = screenToRay(basis, sx, sy);
    if (Math.abs(ray.dir.y) < 1e-5) return null;
    var t = (planeY - ray.origin.y) / ray.dir.y;
    if (t <= 0) return null;
    return {
      x: ray.origin.x + t * ray.dir.x,
      y: planeY,
      z: ray.origin.z + t * ray.dir.z
    };
  }

  // =========================================================================
  // Bounding Boxes 3D exactas (para hit-testing Ray-OBB, sombras y centrado)
  // =========================================================================

  function getComponentBounds(type) {
    switch (type) {
      case "arduino_uno_r3":
        return { minX: -39.0, maxX: 35.0, minY: 0, maxY: 13.0, minZ: -27.2, maxZ: 27.2, isBoard: true };
      case "breadboard_830":
        return { minX: -83.0, maxX: 83.0, minY: 0, maxY: 9.5, minZ: -28.0, maxZ: 28.0, isBoard: true };
      case "led":
        return { minX: -3.2, maxX: 3.2, minY: 0, maxY: 13.2, minZ: -3.2, maxZ: 3.2, isBoard: false };
      case "resistor":
        return { minX: -5.8, maxX: 5.8, minY: 0, maxY: 5.0, minZ: -2.2, maxZ: 2.2, isBoard: false };
      case "pushbutton":
        return { minX: -3.6, maxX: 3.6, minY: 0, maxY: 6.5, minZ: -4.4, maxZ: 4.4, isBoard: false };
      case "potentiometer":
        return { minX: -6.2, maxX: 6.2, minY: 0, maxY: 15.6, minZ: -6.2, maxZ: 6.2, isBoard: false };
      case "servo_sg90":
        return { minX: -16.8, maxX: 16.8, minY: 0, maxY: 26.5, minZ: -12.0, maxZ: 12.0, isBoard: false };
      case "ultrasonic_hcsr04":
        return { minX: -23.0, maxX: 23.0, minY: 0, maxY: 22.5, minZ: -2.5, maxZ: 13.5, isBoard: false };
      case "lcd_1602":
        return { minX: -40.5, maxX: 40.5, minY: 0, maxY: 8.6, minZ: -18.5, maxZ: 18.5, isBoard: true };
      case "ldr":
        return { minX: -3.2, maxX: 3.2, minY: 0, maxY: 6.6, minZ: -2.6, maxZ: 2.6, isBoard: false };
      case "tmp36":
        return { minX: -3.2, maxX: 3.2, minY: 0, maxY: 9.2, minZ: -2.6, maxZ: 2.6, isBoard: false };
      case "buzzer":
        return { minX: -6.4, maxX: 6.4, minY: 0, maxY: 9.8, minZ: -6.4, maxZ: 6.4, isBoard: false };
      default:
        return { minX: -6, maxX: 6, minY: 0, maxY: 10, minZ: -6, maxZ: 6, isBoard: false };
    }
  }

  function intersectRayOBB(ray, comp) {
    var b = getComponentBounds(comp.type);
    var p = comp.pos || { x: 0, y: 0, z: 0 };
    var rotY = comp.rotY || 0;
    var c = Math.cos(rotY);
    var s = Math.sin(rotY);

    var ox = ray.origin.x - (p.x || 0);
    var oy = ray.origin.y - (p.y || 0);
    var oz = ray.origin.z - (p.z || 0);

    var lo = {
      x: ox * c - oz * s,
      y: oy,
      z: ox * s + oz * c
    };
    var ld = {
      x: ray.dir.x * c - ray.dir.z * s,
      y: ray.dir.y,
      z: ray.dir.x * s + ray.dir.z * c
    };

    var tmin = -Infinity;
    var tmax = Infinity;
    var axes = [
      [lo.x, ld.x, b.minX, b.maxX],
      [lo.y, ld.y, b.minY, b.maxY],
      [lo.z, ld.z, b.minZ, b.maxZ]
    ];

    for (var i = 0; i < 3; i++) {
      var o = axes[i][0];
      var d = axes[i][1];
      var mn = axes[i][2];
      var mx = axes[i][3];
      if (Math.abs(d) < 1e-7) {
        if (o < mn || o > mx) return null;
      } else {
        var t1 = (mn - o) / d;
        var t2 = (mx - o) / d;
        if (t1 > t2) {
          var tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return null;
      }
    }

    if (tmax < 0) return null;
    var hitT = tmin >= 0 ? tmin : tmax;
    return { t: hitT, isBoard: b.isBoard };
  }

  // =========================================================================
  // Cola de primitivas 3D e iluminación por caras
  // =========================================================================

  function computeFaceShade(normal, unlit) {
    if (unlit) return 1.0;
    var ndotl = vecDot(normal, LIGHT_DIR);
    var ambient = 0.62;
    var diffuse = 0.38 * Math.max(0, ndotl);
    var rim = 0.06 * Math.max(0, -ndotl);
    return ambient + diffuse + rim;
  }

  function pushFace(drawList, basis, worldPts, baseColor, opts) {
    opts = opts || {};
    var nPts = worldPts.length;
    if (nPts < 3) return;

    var e1 = vecSub(worldPts[1], worldPts[0]);
    var e2 = vecSub(worldPts[2], worldPts[0]);
    var normal = vecNorm(vecCross(e1, e2));

    var cx = 0;
    var cy = 0;
    var cz = 0;
    for (var i = 0; i < nPts; i++) {
      cx += worldPts[i].x;
      cy += worldPts[i].y;
      cz += worldPts[i].z;
    }
    cx /= nPts;
    cy /= nPts;
    cz /= nPts;

    if (!opts.doubleSided) {
      var toCam = {
        x: basis.camPos.x - cx,
        y: basis.camPos.y - cy,
        z: basis.camPos.z - cz
      };
      if (vecDot(normal, toCam) <= 0) return;
    }

    var proj = [];
    var depthSum = 0;
    for (var j = 0; j < nPts; j++) {
      var pr = projectPoint(basis, worldPts[j].x, worldPts[j].y, worldPts[j].z);
      if (!pr) return;
      proj.push(pr);
      depthSum += pr.z;
    }

    var shade = opts.shadeOverride !== undefined ? opts.shadeOverride : computeFaceShade(normal, opts.unlit);
    var fill = shadeColor(baseColor, shade, opts.alpha);

    drawList.push({
      kind: "poly",
      proj: proj,
      fill: fill,
      stroke: opts.stroke !== undefined ? opts.stroke : null,
      strokeWidth: opts.strokeWidth || 0.7,
      depth: depthSum / nPts + (opts.depthBias || 0),
      postDraw: opts.postDraw || null,
      postData: opts.postData || null,
      worldCenter: { x: cx, y: cy, z: cz }
    });
  }

  function addBox(drawList, basis, comp, x0, x1, y0, y1, z0, z1, color, opts) {
    opts = opts || {};
    var p000 = localToWorld(comp, x0, y0, z0);
    var p100 = localToWorld(comp, x1, y0, z0);
    var p110 = localToWorld(comp, x1, y1, z0);
    var p010 = localToWorld(comp, x0, y1, z0);
    var p001 = localToWorld(comp, x0, y0, z1);
    var p101 = localToWorld(comp, x1, y0, z1);
    var p111 = localToWorld(comp, x1, y1, z1);
    var p011 = localToWorld(comp, x0, y1, z1);

    var topOpts = (opts.topPostDraw || opts.topDepthBias !== undefined || opts.topStroke !== undefined)
      ? {
          stroke: opts.topStroke !== undefined ? opts.topStroke : opts.stroke,
          strokeWidth: opts.strokeWidth,
          alpha: opts.alpha,
          unlit: opts.unlit,
          depthBias: opts.topDepthBias !== undefined ? opts.topDepthBias : opts.depthBias,
          postDraw: opts.topPostDraw,
          postData: opts.topPostData || null
        }
      : opts;

    // +Y Top
    pushFace(drawList, basis, [p011, p111, p110, p010], opts.topColor || color, topOpts);
    // -Y Bottom
    if (!opts.skipBottom) {
      pushFace(drawList, basis, [p000, p100, p101, p001], color, opts);
    }
    // +Z Front
    if (!opts.skipFront) {
      pushFace(drawList, basis, [p001, p101, p111, p011], color, opts);
    }
    // -Z Back
    if (!opts.skipBack) {
      pushFace(drawList, basis, [p100, p000, p010, p110], color, opts);
    }
    // +X Right
    if (!opts.skipRight) {
      pushFace(drawList, basis, [p101, p100, p110, p111], color, opts);
    }
    // -X Left
    if (!opts.skipLeft) {
      pushFace(drawList, basis, [p000, p001, p011, p010], color, opts);
    }
  }

  function addCylinderY(drawList, basis, comp, cx, y0, y1, cz, r0, r1, segs, color, opts) {
    opts = opts || {};
    var topRing = [];
    var botRing = [];
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      botRing.push(localToWorld(comp, cx + r0 * ca, y0, cz + r0 * sa));
      topRing.push(localToWorld(comp, cx + r1 * ca, y1, cz + r1 * sa));
    }

    for (var s = 0; s < segs; s++) {
      var n = (s + 1) % segs;
      // En XZ con ángulo a=0..2PI: (cos a, sin a) va en sentido horario visto desde +Y,
      // por lo que lado exterior usa [bot[n], bot[s], top[s], top[n]]
      pushFace(drawList, basis, [botRing[n], botRing[s], topRing[s], topRing[n]], color, opts);
    }

    if (!opts.skipTop && r1 > 0.05) {
      var topCap = [];
      for (var t = segs - 1; t >= 0; t--) topCap.push(topRing[t]);
      pushFace(drawList, basis, topCap, opts.topColor || color, {
        stroke: opts.capStroke !== undefined ? opts.capStroke : opts.stroke,
        alpha: opts.alpha,
        unlit: opts.unlit,
        depthBias: opts.depthBias,
        postDraw: opts.topPostDraw,
        postData: opts.topPostData || null
      });
    }
    if (!opts.skipBottom && r0 > 0.05) {
      pushFace(drawList, basis, botRing, color, opts);
    }
  }

  function addCylinderX(drawList, basis, comp, x0, x1, cy, cz, r0, r1, segs, color, opts) {
    opts = opts || {};
    var leftRing = [];
    var rightRing = [];
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      leftRing.push(localToWorld(comp, x0, cy + r0 * ca, cz + r0 * sa));
      rightRing.push(localToWorld(comp, x1, cy + r1 * ca, cz + r1 * sa));
    }
    for (var s = 0; s < segs; s++) {
      var n = (s + 1) % segs;
      pushFace(drawList, basis, [leftRing[s], leftRing[n], rightRing[n], rightRing[s]], color, opts);
    }
    if (!opts.skipCaps) {
      var lCap = [];
      for (var k = segs - 1; k >= 0; k--) lCap.push(leftRing[k]);
      pushFace(drawList, basis, lCap, color, opts);
      pushFace(drawList, basis, rightRing, color, opts);
    }
  }

  function addCylinderZ(drawList, basis, comp, cx, cy, z0, z1, r0, r1, segs, color, opts) {
    opts = opts || {};
    var backRing = [];
    var frontRing = [];
    for (var i = 0; i < segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      backRing.push(localToWorld(comp, cx + r0 * ca, cy + r0 * sa, z0));
      frontRing.push(localToWorld(comp, cx + r1 * ca, cy + r1 * sa, z1));
    }
    for (var s = 0; s < segs; s++) {
      var n = (s + 1) % segs;
      pushFace(drawList, basis, [backRing[n], backRing[s], frontRing[s], frontRing[n]], color, opts);
    }
    if (!opts.skipFront) {
      var fCap = [];
      for (var k = segs - 1; k >= 0; k--) fCap.push(frontRing[k]);
      pushFace(drawList, basis, fCap, opts.frontColor || color, {
        stroke: opts.stroke,
        alpha: opts.alpha,
        unlit: opts.unlit,
        depthBias: opts.depthBias,
        postDraw: opts.frontPostDraw
      });
    }
  }

  function addHemisphereY(drawList, basis, comp, cx, yBase, cz, radius, rings, segs, color, opts) {
    opts = opts || {};
    var ringPts = [];
    for (var r = 0; r <= rings; r++) {
      var phi = (r / rings) * (Math.PI * 0.5);
      var yr = yBase + radius * Math.sin(phi);
      var rr = radius * Math.cos(phi);
      var pts = [];
      for (var s = 0; s < segs; s++) {
        var a = (s / segs) * Math.PI * 2;
        pts.push(localToWorld(comp, cx + rr * Math.cos(a), yr, cz + rr * Math.sin(a)));
      }
      ringPts.push(pts);
    }

    for (var ri = 0; ri < rings; ri++) {
      var cur = ringPts[ri];
      var nxt = ringPts[ri + 1];
      for (var si = 0; si < segs; si++) {
        var ni = (si + 1) % segs;
        if (ri === rings - 1) {
          pushFace(drawList, basis, [cur[ni], cur[si], nxt[si]], color, opts);
        } else {
          pushFace(drawList, basis, [cur[ni], cur[si], nxt[si], nxt[ni]], color, opts);
        }
      }
    }
  }

  function addLine3D(drawList, basis, w0, w1, color, width, depthBias) {
    var seg = projectClippedSegment(basis, w0, w1);
    if (!seg) return;
    drawList.push({
      kind: "line",
      ax: seg.ax,
      ay: seg.ay,
      bx: seg.bx,
      by: seg.by,
      color: color,
      width: width || 1.4,
      depth: seg.depth + (depthBias || 0)
    });
  }

  function beginLocalTransform(basis, comp, lx0, ly, lz0, lx1, lz1, lx2, lz2, w, h) {
    var p0 = projectPointObj(basis, localToWorld(comp, lx0, ly, lz0));
    var p1 = projectPointObj(basis, localToWorld(comp, lx1, ly, lz1));
    var p2 = projectPointObj(basis, localToWorld(comp, lx2, ly, lz2));
    if (!p0 || !p1 || !p2) return false;
    ctx.save();
    ctx.transform(
      (p1.x - p0.x) / w,
      (p1.y - p0.y) / w,
      (p2.x - p0.x) / h,
      (p2.y - p0.y) / h,
      p0.x,
      p0.y
    );
    return true;
  }

  function projectPointObj(basis, wp) {
    return projectPoint(basis, wp.x, wp.y, wp.z);
  }

  // =========================================================================
  // Suelo: Cuadrícula 3D (-240..+240 mm) y sombras suaves
  // =========================================================================

  function drawGridAndGround(basis, simState) {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, viewW, viewH);

    // Superficie sutil de papel técnico (-240..+240 mm)
    var c0 = projectPoint(basis, -240, 0, -240);
    var c1 = projectPoint(basis, 240, 0, -240);
    var c2 = projectPoint(basis, 240, 0, 240);
    var c3 = projectPoint(basis, -240, 0, 240);
    if (c0 && c1 && c2 && c3) {
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y);
      ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(c3.x, c3.y);
      ctx.closePath();
      ctx.fillStyle = "#FCFBF8";
      ctx.fill();
    }

    // Líneas menores cada 10 mm
    ctx.beginPath();
    for (var m = -240; m <= 240; m += 10) {
      if (m % 50 === 0 || m === -240 || m === 240) continue;
      var sx1 = projectClippedSegment(basis, { x: m, y: 0, z: -240 }, { x: m, y: 0, z: 240 });
      if (sx1) {
        ctx.moveTo(sx1.ax, sx1.ay);
        ctx.lineTo(sx1.bx, sx1.by);
      }
      var sz1 = projectClippedSegment(basis, { x: -240, y: 0, z: m }, { x: 240, y: 0, z: m });
      if (sz1) {
        ctx.moveTo(sz1.ax, sz1.ay);
        ctx.lineTo(sz1.bx, sz1.by);
      }
    }
    ctx.strokeStyle = GRID_MINOR_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Líneas principales cada 50 mm y borde exterior
    ctx.beginPath();
    for (var M = -240; M <= 240; M += 10) {
      if (M % 50 !== 0 && M !== -240 && M !== 240) continue;
      if (M === 0) continue;
      var mx = projectClippedSegment(basis, { x: M, y: 0, z: -240 }, { x: M, y: 0, z: 240 });
      if (mx) {
        ctx.moveTo(mx.ax, mx.ay);
        ctx.lineTo(mx.bx, mx.by);
      }
      var mz = projectClippedSegment(basis, { x: -240, y: 0, z: M }, { x: 240, y: 0, z: M });
      if (mz) {
        ctx.moveTo(mz.ax, mz.ay);
        ctx.lineTo(mz.bx, mz.by);
      }
    }
    ctx.strokeStyle = GRID_MAJOR_COLOR;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Ejes X / Z sutiles en el origen
    var axX = projectClippedSegment(basis, { x: -240, y: 0, z: 0 }, { x: 240, y: 0, z: 0 });
    if (axX) {
      ctx.beginPath();
      ctx.moveTo(axX.ax, axX.ay);
      ctx.lineTo(axX.bx, axX.by);
      ctx.strokeStyle = GRID_AXIS_X;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    var axZ = projectClippedSegment(basis, { x: 0, y: 0, z: -240 }, { x: 0, y: 0, z: 240 });
    if (axZ) {
      ctx.beginPath();
      ctx.moveTo(axZ.ax, axZ.ay);
      ctx.lineTo(axZ.bx, axZ.by);
      ctx.strokeStyle = GRID_AXIS_Z;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    // Marcas discretas de coordenadas (mm)
    ctx.font = "500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = GRID_LABEL_COLOR;
    for (var coord = -200; coord <= 200; coord += 50) {
      var lx = projectPoint(basis, coord, 0, 249);
      if (lx && lx.s > 1.2) {
        ctx.fillText(coord + (coord === 0 ? " mm" : ""), lx.x, lx.y);
      }
      if (coord !== 0) {
        var lz = projectPoint(basis, -252, 0, coord);
        if (lz && lz.s > 1.2) {
          ctx.fillText(String(coord), lz.x, lz.y);
        }
      }
    }

    var xTag = projectPoint(basis, 252, 0, 0);
    if (xTag) {
      ctx.fillStyle = "rgba(0, 129, 132, 0.7)";
      ctx.fillText("X+", xTag.x, xTag.y);
    }
    var zTag = projectPoint(basis, 0, 0, 255);
    if (zTag) {
      ctx.fillStyle = "rgba(140, 118, 86, 0.7)";
      ctx.fillText("Z+", zTag.x, zTag.y);
    }

    // Sombras suaves en el suelo bajo cada placa y componente
    var comps = (simState && simState.components) || [];
    for (var i = 0; i < comps.length; i++) {
      drawComponentGroundShadow(basis, comps[i]);
    }
  }

  function drawComponentGroundShadow(basis, comp) {
    var b = getComponentBounds(comp.type);
    var p = comp.pos || { x: 0, y: 0, z: 0 };
    var lift = Math.max(0, p.y || 0);
    var heightSpan = b.maxY - b.minY;
    var offX = -0.28 * (heightSpan + lift * 0.45) - 1.2;
    var offZ = -0.22 * (heightSpan + lift * 0.45) - 1.0;
    var pad = b.isBoard ? 2.2 : 1.5;

    var corners = [
      localToWorld(comp, b.minX - pad, 0, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0, b.maxZ + pad),
      localToWorld(comp, b.minX - pad, 0, b.maxZ + pad)
    ];

    var pts = [];
    for (var i = 0; i < 4; i++) {
      var pr = projectPoint(basis, corners[i].x + offX, 0.02, corners[i].z + offZ);
      if (!pr) return;
      pts.push(pr);
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    ctx.fillStyle = b.isBoard ? "rgba(38, 35, 28, 0.11)" : "rgba(38, 35, 28, 0.09)";
    ctx.fill();

    // Penumbra suave exterior
    var pad2 = pad + 2.4;
    var outer = [
      localToWorld(comp, b.minX - pad2, 0, b.minZ - pad2),
      localToWorld(comp, b.maxX + pad2, 0, b.minZ - pad2),
      localToWorld(comp, b.maxX + pad2, 0, b.maxZ + pad2),
      localToWorld(comp, b.minX - pad2, 0, b.maxZ + pad2)
    ];
    var opts2 = [];
    for (var j = 0; j < 4; j++) {
      var pr2 = projectPoint(basis, outer[j].x + offX * 1.15, 0.01, outer[j].z + offZ * 1.15);
      if (!pr2) return;
      opts2.push(pr2);
    }
    ctx.beginPath();
    ctx.moveTo(opts2[0].x, opts2[0].y);
    ctx.lineTo(opts2[1].x, opts2[1].y);
    ctx.lineTo(opts2[2].x, opts2[2].y);
    ctx.lineTo(opts2[3].x, opts2[3].y);
    ctx.closePath();
    ctx.fillStyle = "rgba(38, 35, 28, 0.045)";
    ctx.fill();
  }

  // =========================================================================
  // Registro de pines proyectados (para hover/click y anillos)
  // =========================================================================

  function recordProjectedPin(basis, comp, pin, isBreadboard) {
    var wp = getWorldPinPosition(comp, pin);
    var pr = projectPoint(basis, wp.x, wp.y, wp.z);
    if (!pr) return null;
    var entry = {
      comp: comp,
      pin: pin,
      sx: pr.x,
      sy: pr.y,
      depth: pr.z,
      s: pr.s,
      isBreadboard: !!isBreadboard
    };
    state.projectedPins.push(entry);
    state.pinLookup[comp.id + "::" + pin.id] = entry;
    return entry;
  }

  // =========================================================================
  // Modelos 3D Detallados
  // =========================================================================

  function buildArduinoUno(drawList, overlays, basis, comp, simState) {
    var mcu = (simState && simState.mcuState) || {};
    var pins = getComponentPins("arduino_uno_r3");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // PCB 68.6 x 53.4 x 1.6 mm subdividida 3x2 para evitar inversión de profundidad
    var xs = [-34.3, -11.4, 11.4, 34.3];
    var zs = [-26.7, 0, 26.7];
    var txFlash = state.uploadFlashMs > 0 ? Math.floor(state.animTimeMs / 75) % 2 === 0 : !!(mcu.txActive || (mcu.txPulseMs && mcu.txPulseMs > 0));
    var rxFlash = state.uploadFlashMs > 0 ? Math.floor(state.animTimeMs / 75) % 2 === 1 : !!(mcu.rxActive || (mcu.rxPulseMs && mcu.rxPulseMs > 0));
    var ledLOn = Boolean(
      mcu.ledL ||
      (mcu.pins && (mcu.pins.D13 || mcu.pins[13])) ||
      (mcu.pwm && ((mcu.pwm.D13 || 0) > 20 || (mcu.pwm[13] || 0) > 20))
    );
    var powerOn = mcu.vcc === undefined || mcu.vcc > 0;

    for (var ix = 0; ix < 3; ix++) {
      for (var iz = 0; iz < 2; iz++) {
        var isCenterTile = ix === 1 && iz === 0;
        addBox(drawList, basis, comp, xs[ix], xs[ix + 1], 0.2, 1.8, zs[iz], zs[iz + 1], "#008184", {
          topColor: "#008C8F",
          stroke: "rgba(0, 82, 84, 0.28)",
          strokeWidth: 0.6,
          topPostDraw: isCenterTile ? postDrawArduinoSilkscreen : null,
          topPostData: isCenterTile
            ? { basis: basis, comp: comp, powerOn: powerOn, ledLOn: ledLOn, txFlash: txFlash, rxFlash: rxFlash }
            : null
        });
      }
    }

    // Conector USB-B metálico
    addBox(drawList, basis, comp, -39.5, -22.5, 1.8, 12.6, -15.5, -4.5, "#C7CDD4", {
      topColor: "#DCE1E7",
      stroke: "rgba(60, 68, 78, 0.45)"
    });
    addBox(drawList, basis, comp, -39.8, -38.8, 3.6, 10.6, -13.6, -6.4, "#2B2F36", {
      unlit: true,
      stroke: "#111317"
    });

    // Jack DC negro
    addBox(drawList, basis, comp, -36.8, -23.0, 1.8, 12.2, 10.5, 19.5, "#23262B", {
      topColor: "#2F343B",
      stroke: "rgba(15, 18, 22, 0.6)"
    });
    addCylinderX(drawList, basis, comp, -37.2, -36.2, 7.0, 15.0, 3.3, 3.3, 10, "#141619", {
      unlit: true,
      stroke: "#444952"
    });

    // Botón RESET rojo con marco metálico
    addBox(drawList, basis, comp, -29.2, -23.4, 1.8, 3.8, -23.8, -18.0, "#B8C0C8", {
      stroke: "rgba(60,65,70,0.45)"
    });
    addCylinderY(drawList, basis, comp, -26.3, 3.8, 5.4, -20.9, 1.6, 1.5, 10, "#DC2626", {
      topColor: "#EF4444",
      stroke: "rgba(127, 29, 29, 0.5)"
    });

    // Chip USB ATmega16U2
    addBox(drawList, basis, comp, -20.0, -14.0, 1.8, 2.9, -16.2, -10.2, "#22252A", {
      stroke: "rgba(0,0,0,0.5)"
    });

    // Cristal de cuarzo 16 MHz metálico
    addBox(drawList, basis, comp, -18.5, -10.5, 1.8, 4.2, -5.2, -1.2, "#CFD5DC", {
      topColor: "#E4E9EF",
      stroke: "rgba(80, 90, 100, 0.45)"
    });

    // Regulador de tensión AMS1117
    addBox(drawList, basis, comp, -22.5, -16.5, 1.8, 3.2, 4.0, 9.0, "#25282D", {
      stroke: "rgba(0,0,0,0.45)"
    });
    addBox(drawList, basis, comp, -21.0, -18.0, 1.8, 3.0, 2.5, 4.2, "#C4CBD3", {
      stroke: "rgba(80,85,90,0.4)"
    });

    // ATmega328P DIP-28 con zócalo y muesca en -X
    addBox(drawList, basis, comp, -2.5, 31.5, 1.8, 4.0, 5.2, 13.8, "#1E2126", {
      stroke: "rgba(0,0,0,0.55)"
    });
    addBox(drawList, basis, comp, -1.5, 30.5, 4.0, 6.2, 6.0, 13.0, "#2B2F36", {
      topColor: "#353A42",
      stroke: "rgba(15,17,20,0.65)",
      topPostDraw: postDrawAtmegaLabel,
      topPostData: { basis: basis, comp: comp }
    });

    // Patillas metálicas DIP-28 (14 por lado)
    for (var icp = 0; icp < 14; icp++) {
      var ixPin = -0.3 + icp * 2.26;
      addBox(drawList, basis, comp, ixPin - 0.35, ixPin + 0.35, 2.2, 4.4, 5.1, 6.0, "#C9D0D8", { stroke: null });
      addBox(drawList, basis, comp, ixPin - 0.35, ixPin + 0.35, 2.2, 4.4, 13.0, 13.9, "#C9D0D8", { stroke: null });
    }

    // 4 Headers negros hembra alineados con pines reales de Datasheets
    var headers = [
      { x0: -9.15, x1: 11.17, z0: -25.4, z1: -22.86 }, // AREF..D8
      { x0: 12.69, x1: 33.01, z0: -25.4, z1: -22.86 }, // D7..D0
      { x0: -2.55, x1: 15.23, z0: 22.86, z1: 25.4 },   // IOREF..VIN
      { x0: 17.77, x1: 33.01, z0: 22.86, z1: 25.4 }    // A0..A5
    ];
    for (var hi = 0; hi < headers.length; hi++) {
      var h = headers[hi];
      addBox(drawList, basis, comp, h.x0, h.x1, 1.8, 10.1, h.z0, h.z1, "#22252A", {
        topColor: "#2C3037",
        stroke: "rgba(10, 12, 16, 0.55)"
      });
    }

    // Agujeros individuales en los headers
    for (var hp = 0; hp < pins.length; hp++) {
      var lp = pins[hp].localPos;
      addBox(drawList, basis, comp, lp.x - 0.65, lp.x + 0.65, 10.11, 10.14, lp.z - 0.65, lp.z + 0.65, "#101215", {
        unlit: true,
        stroke: "rgba(180, 190, 200, 0.28)",
        strokeWidth: 0.5,
        skipBottom: true,
        depthBias: -0.15
      });
    }

    // Cabezal ICSP de 6 pines
    for (var icspx = 0; icspx < 2; icspx++) {
      for (var icspz = -1; icspz <= 1; icspz++) {
        var px = 29.2 + icspx * 2.54;
        var pz = icspz * 2.54;
        addBox(drawList, basis, comp, px - 0.3, px + 0.3, 1.8, 6.2, pz - 0.3, pz + 0.3, "#D4AF37", { stroke: null });
      }
    }

    // Halo radial luminoso sobre LED 'L' (D13) y destello TX/RX
    if (ledLOn) {
      var lPos = projectPointObj(basis, localToWorld(comp, -10.5, 2.5, -14.2));
      if (lPos) {
        overlays.push({
          kind: "halo",
          x: lPos.x,
          y: lPos.y,
          radius: 11 * lPos.s,
          color: "#FF9F1C",
          coreColor: "#FFF3D1",
          intensity: 0.95,
          depth: lPos.z - 2
        });
      }
    }
    if (powerOn) {
      var onPos = projectPointObj(basis, localToWorld(comp, 20.5, 2.5, -10.5));
      if (onPos) {
        overlays.push({
          kind: "halo",
          x: onPos.x,
          y: onPos.y,
          radius: 7 * onPos.s,
          color: "#22C55E",
          coreColor: "#DCFCE7",
          intensity: 0.65,
          depth: onPos.z - 2
        });
      }
    }
    if (txFlash) {
      var txPos = projectPointObj(basis, localToWorld(comp, -13.0, 2.5, -8.5));
      if (txPos) {
        overlays.push({
          kind: "halo",
          x: txPos.x,
          y: txPos.y,
          radius: 8 * txPos.s,
          color: "#F59E0B",
          coreColor: "#FEF3C7",
          intensity: 0.9,
          depth: txPos.z - 2
        });
      }
    }
    if (rxFlash) {
      var rxPos = projectPointObj(basis, localToWorld(comp, -13.0, 2.5, -11.5));
      if (rxPos) {
        overlays.push({
          kind: "halo",
          x: rxPos.x,
          y: rxPos.y,
          radius: 8 * rxPos.s,
          color: "#F59E0B",
          coreColor: "#FEF3C7",
          intensity: 0.9,
          depth: rxPos.z - 2
        });
      }
    }
  }

  function postDrawAtmegaLabel(_pts, d) {
    if (!beginLocalTransform(d.basis, d.comp, -1.0, 6.25, 6.5, 30.0, 6.5, -1.0, 12.5, 100, 22)) return;
    ctx.fillStyle = "#171A1E";
    ctx.beginPath();
    ctx.arc(0, 11, 4.2, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.fillStyle = "rgba(218, 224, 232, 0.72)";
    ctx.font = "600 6.8px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ATMEGA328P-PU", 52, 11);
    ctx.restore();
  }

  function postDrawArduinoSilkscreen(_pts, d) {
    drawArduinoSilkscreenAndLeds(d.basis, d.comp, d.powerOn, d.ledLOn, d.txFlash, d.rxFlash);
  }

  function drawArduinoSilkscreenAndLeds(basis, comp, powerOn, ledLOn, txFlash, rxFlash) {
    // Mapea toda la placa PCB (-34.3..34.3 x -26.7..26.7) a un lienzo 2D 686x534 (10px/mm)
    if (!beginLocalTransform(basis, comp, -34.3, 1.84, -26.7, 34.3, -26.7, -34.3, 26.7, 686, 534)) return;
    var px = function (mmX) { return (mmX + 34.3) * 10; };
    var pz = function (mmZ) { return (mmZ + 26.7) * 10; };

    // Contorno serigrafiado blanco
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 662, 510);

    // Marca ARDUINO UNO
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.font = "700 28px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("ARDUINO", px(-1.5), pz(-6.5));

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(px(14.5), pz(-9.5), 76, 36);
    ctx.fillStyle = "#008184";
    ctx.font = "800 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("UNO", px(18.3), pz(-7.7));

    // Etiquetas de pines superiores
    ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
    ctx.font = "700 12px ui-monospace, monospace";
    ctx.textAlign = "center";
    var topLabels = [
      [-7.88, "AREF"], [-5.34, "GND"], [-2.80, "13"], [-0.26, "12"],
      [2.28, "~11"], [4.82, "~10"], [7.36, "~9"], [9.90, "8"],
      [13.96, "7"], [16.50, "~6"], [19.04, "~5"], [21.58, "4"],
      [24.12, "~3"], [26.66, "2"], [29.20, "1"], [31.74, "0"]
    ];
    for (var i = 0; i < topLabels.length; i++) {
      ctx.save();
      ctx.translate(px(topLabels[i][0]), pz(-20.4));
      ctx.rotate(-Math.PI * 0.5);
      ctx.fillText(topLabels[i][1], 0, 0);
      ctx.restore();
    }

    // Etiquetas de pines inferiores
    var botLabels = [
      [-1.28, "IOR"], [1.26, "RST"], [3.80, "3.3"], [6.34, "5V"],
      [8.88, "GND"], [11.42, "GND"], [13.96, "VIN"],
      [19.04, "A0"], [21.58, "A1"], [24.12, "A2"],
      [26.66, "A3"], [29.20, "A4"], [31.74, "A5"]
    ];
    for (var j = 0; j < botLabels.length; j++) {
      ctx.save();
      ctx.translate(px(botLabels[j][0]), pz(20.1));
      ctx.rotate(-Math.PI * 0.5);
      ctx.fillText(botLabels[j][1], 0, 0);
      ctx.restore();
    }

    // LEDs SMD integrados en la PCB: ON, L, TX, RX
    var smds = [
      [20.5, -10.5, "ON", "#4ADE80", "#166534", !!powerOn],
      [-10.5, -14.2, "L", "#FBBF24", "#78350F", !!ledLOn],
      [-13.0, -8.5, "TX", "#FBBF24", "#78350F", !!txFlash],
      [-13.0, -11.5, "RX", "#FBBF24", "#78350F", !!rxFlash]
    ];
    for (var s = 0; s < smds.length; s++) {
      var cx = px(smds[s][0]);
      var cz = pz(smds[s][1]);
      ctx.fillStyle = "#CFD6DF";
      ctx.fillRect(cx - 12, cz - 6, 24, 12);
      ctx.fillStyle = smds[s][5] ? smds[s][3] : smds[s][4];
      ctx.fillRect(cx - 7, cz - 5, 14, 10);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "700 13px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(smds[s][2], cx + 15, cz);
    }
    ctx.restore();
  }

  // Protoboard 830 puntos pre-particionada en cuadrícula 6x5 para profundidad exacta
  function ensureBreadboardSlices() {
    if (state.breadboardSlices) return state.breadboardSlices;
    var pins = getComponentPins("breadboard_830");
    var xBounds = [-82.5, -55, -27.5, 0, 27.5, 55, 82.5];
    var zBounds = [-27.5, -16.5, -2.5, 2.5, 16.5, 27.5];
    var slices = [];
    for (var ix = 0; ix < 6; ix++) {
      for (var iz = 0; iz < 5; iz++) {
        slices.push({
          ix: ix,
          iz: iz,
          x0: xBounds[ix],
          x1: xBounds[ix + 1],
          z0: zBounds[iz],
          z1: zBounds[iz + 1],
          pins: []
        });
      }
    }
    for (var i = 0; i < pins.length; i++) {
      var lx = pins[i].localPos.x;
      var lz = pins[i].localPos.z;
      var colIdx = 5;
      for (var kx = 0; kx < 6; kx++) {
        if (lx < xBounds[kx + 1] - 0.01) {
          colIdx = kx;
          break;
        }
      }
      var rowIdx = 4;
      for (var kz = 0; kz < 5; kz++) {
        if (lz < zBounds[kz + 1] - 0.01) {
          rowIdx = kz;
          break;
        }
      }
      slices[colIdx * 5 + rowIdx].pins.push(pins[i]);
    }
    state.breadboardSlices = slices;
    return slices;
  }

  function postDrawBreadboardTile(_pts, d) {
    drawBreadboardTileSurface(d.basis, d.comp, d.tile);
  }

  function buildBreadboard830(drawList, basis, comp) {
    var slices = ensureBreadboardSlices();
    var bodyColor = "#F7F5EE";

    for (var i = 0; i < slices.length; i++) {
      var tile = slices[i];
      var isChannel = tile.iz === 2;
      var topCol = isChannel ? "#EAE5D8" : "#FAF8F2";
      var borderCol = tile.ix === 0 || tile.ix === 5 || tile.iz === 0 || tile.iz === 4
        ? "rgba(130, 124, 108, 0.32)"
        : null;
      addBox(drawList, basis, comp, tile.x0, tile.x1, 0, 9.2, tile.z0, tile.z1, bodyColor, {
        topColor: topCol,
        stroke: borderCol,
        topStroke: isChannel ? "rgba(160, 152, 134, 0.35)" : null,
        strokeWidth: 0.7,
        skipBottom: true,
        skipLeft: tile.ix > 0,
        skipRight: tile.ix < 5,
        skipBack: tile.iz > 0,
        skipFront: tile.iz < 4,
        topDepthBias: 5.5,
        topPostDraw: postDrawBreadboardTile,
        topPostData: { basis: basis, comp: comp, tile: tile }
      });
    }
  }

  function drawBreadboardTileSurface(basis, comp, tile) {
    var zSpan = tile.z1 - tile.z0;
    var xSpan = tile.x1 - tile.x0;
    var w = xSpan * 10;
    var h = zSpan * 10;

    if (tile.iz === 0 || tile.iz === 4) {
      // Buses de alimentación: líneas continua roja (+) y azul (-)
      if (beginLocalTransform(basis, comp, tile.x0, 9.21, tile.z0, tile.x1, tile.z0, tile.x0, tile.z1, w, h)) {
        var padL = tile.ix === 0 ? 10 : 0;
        var padR = tile.ix === 5 ? 10 : 0;
        var lineW = w - padL - padR;

        if (tile.iz === 0) {
          ctx.fillStyle = "#DC2626";
          ctx.fillRect(padL, (-24.8 - tile.z0) * 10, lineW, 4.5);
          ctx.fillStyle = "#2563EB";
          ctx.fillRect(padL, (-18.5 - tile.z0) * 10, lineW, 4.5);
          if (tile.ix === 0) {
            ctx.font = "700 18px ui-monospace, monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#DC2626";
            ctx.fillText("+", 10, (-22.86 - tile.z0) * 10);
            ctx.fillStyle = "#2563EB";
            ctx.fillText("-", 10, (-20.32 - tile.z0) * 10);
          }
        } else {
          ctx.fillStyle = "#DC2626";
          ctx.fillRect(padL, (18.1 - tile.z0) * 10, lineW, 4.5);
          ctx.fillStyle = "#2563EB";
          ctx.fillRect(padL, (24.4 - tile.z0) * 10, lineW, 4.5);
          if (tile.ix === 0) {
            ctx.font = "700 18px ui-monospace, monospace";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#DC2626";
            ctx.fillText("+", 10, (20.32 - tile.z0) * 10);
            ctx.fillStyle = "#2563EB";
            ctx.fillText("-", 10, (22.86 - tile.z0) * 10);
          }
        }
        ctx.restore();
      }
    }

    // Dibujar agujeros de esta celda sobre el plano y=9.2
    var pins = tile.pins;
    for (var p = 0; p < pins.length; p++) {
      var pin = pins[p];
      var entry = recordProjectedPin(basis, comp, pin, true);
      if (!entry) continue;
      var sz = clamp(entry.s * 0.68, 1.4, 5.2);
      ctx.fillStyle = "#C9C3B4";
      ctx.fillRect(entry.sx - sz * 0.65, entry.sy - sz * 0.65, sz * 1.3, sz * 1.3);
      ctx.fillStyle = "#25282C";
      ctx.fillRect(entry.sx - sz * 0.48, entry.sy - sz * 0.48, sz * 0.96, sz * 0.96);
    }
  }

  function buildLed(drawList, overlays, basis, comp) {
    var pins = getComponentPins("led");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    var colorId = (comp.props && comp.props.color) || "red";
    var dsColors = NS.Datasheets && NS.Datasheets.LED_COLORS;
    var colorSpec = (dsColors && dsColors[colorId]) || { hex: "#EF4444", glowHex: "#FF6B6B" };
    var st = comp.state || {};
    var isLit = !!st.lit;
    var brightness = isLit ? clamp(st.brightness !== undefined ? st.brightness : 1.0, 0.08, 1.0) : 0;
    var isOvercurrent = !!st.overcurrent;

    // Patillas metálicas: Ánodo (-1.27) más largo visualmente con pequeño quiebre
    addBox(drawList, basis, comp, -1.52, -1.02, 0, 4.3, -0.25, 0.25, "#B8C0C8", { stroke: "rgba(60,65,72,0.4)" });
    addBox(drawList, basis, comp, 1.02, 1.52, 0.3, 4.3, -0.25, 0.25, "#B8C0C8", { stroke: "rgba(60,65,72,0.4)" });

    var bodyColor = isLit ? mixColor(colorSpec.hex, colorSpec.glowHex || "#FFFFFF", 0.35 + 0.45 * brightness) : colorSpec.hex;
    var bodyAlpha = isLit ? 0.94 : 0.72;

    // Reflejo luminoso suave sobre la superficie bajo el LED
    if (isLit && brightness > 0.03) {
      var groundCenter = projectPointObj(basis, localToWorld(comp, 0, 0.16, 0));
      var groundEdgeX = projectPointObj(basis, localToWorld(comp, 13 + 9 * brightness, 0.16, 0));
      var groundEdgeZ = projectPointObj(basis, localToWorld(comp, 0, 0.16, 13 + 9 * brightness));
      if (groundCenter && groundEdgeX && groundEdgeZ) {
        drawList.push({
          kind: "groundGlow",
          center: groundCenter,
          ex: groundEdgeX,
          ez: groundEdgeZ,
          color: colorSpec.glowHex || colorSpec.hex,
          intensity: brightness,
          depth: groundCenter.z + 0.8
        });
      }
    }

    // Collarín base epoxi
    addCylinderY(drawList, basis, comp, 0, 4.2, 5.1, 0, 2.85, 2.85, 10, bodyColor, {
      alpha: Math.min(0.95, bodyAlpha + 0.1),
      unlit: isLit,
      stroke: shadeColor(colorSpec.hex, 0.65, 0.55)
    });

    // Cápsula cilíndrica
    addCylinderY(drawList, basis, comp, 0, 5.1, 10.1, 0, 2.5, 2.5, 10, bodyColor, {
      alpha: bodyAlpha,
      unlit: isLit,
      skipTop: true,
      skipBottom: true,
      stroke: shadeColor(colorSpec.hex, 0.7, 0.4)
    });

    // Domo semisférico 3D
    addHemisphereY(drawList, basis, comp, 0, 10.1, 0, 2.5, 3, 10, bodyColor, {
      alpha: bodyAlpha,
      unlit: isLit,
      stroke: shadeColor(colorSpec.hex, 0.75, 0.35)
    });

    // Halo radial luminoso multicapa
    var domeCenter = projectPointObj(basis, localToWorld(comp, 0, 9.8, 0));
    if (domeCenter) {
      if (isLit && brightness > 0.02) {
        overlays.push({
          kind: "ledGlow",
          x: domeCenter.x,
          y: domeCenter.y,
          scale: domeCenter.s,
          color: colorSpec.glowHex || colorSpec.hex,
          baseHex: colorSpec.hex,
          brightness: brightness,
          depth: domeCenter.z - 5
        });
      }
      if (isOvercurrent) {
        overlays.push({
          kind: "overcurrent",
          x: domeCenter.x,
          y: domeCenter.y,
          scale: domeCenter.s,
          depth: domeCenter.z - 6
        });
      }
    }
  }

  function buildResistor(drawList, basis, comp) {
    var pins = getComponentPins("resistor");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // Patillas metálicas dobladas desde (-5.08, 0) y (+5.08, 0)
    addBox(drawList, basis, comp, -5.3, -4.86, 0, 3.1, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });
    addBox(drawList, basis, comp, -5.08, -3.5, 2.65, 3.1, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });
    addBox(drawList, basis, comp, 4.86, 5.3, 0, 3.1, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });
    addBox(drawList, basis, comp, 3.5, 5.08, 2.65, 3.1, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });

    var ohms = (comp.props && comp.props.ohms) || 220;
    var bandInfo = NS.Datasheets && typeof NS.Datasheets.getResistorBands === "function"
      ? NS.Datasheets.getResistorBands(ohms)
      : { bands: [{ hex: "#DC2626" }, { hex: "#DC2626" }, { hex: "#78350F" }, { hex: "#D4AF37" }] };
    var bands = bandInfo.bands || [];
    var ceramic = "#E7D2AE";
    var segs = 10;

    // Forma "hueso" cilíndrica + 4 bandas reales EIA
    addCylinderX(drawList, basis, comp, -3.6, -2.55, 2.9, 0, 1.48, 1.55, segs, ceramic, { stroke: "rgba(120,95,60,0.25)" });
    addCylinderX(drawList, basis, comp, -2.55, -2.1, 2.9, 0, 1.55, 1.28, segs, bands[0] ? bands[0].hex : ceramic, { skipCaps: true, stroke: "rgba(0,0,0,0.22)" });
    addCylinderX(drawList, basis, comp, -2.1, -1.25, 2.9, 0, 1.26, 1.26, segs, ceramic, { skipCaps: true, stroke: "rgba(120,95,60,0.2)" });
    addCylinderX(drawList, basis, comp, -1.25, -0.65, 2.9, 0, 1.28, 1.28, segs, bands[1] ? bands[1].hex : ceramic, { skipCaps: true, stroke: "rgba(0,0,0,0.22)" });
    addCylinderX(drawList, basis, comp, -0.65, 0.15, 2.9, 0, 1.26, 1.26, segs, ceramic, { skipCaps: true, stroke: "rgba(120,95,60,0.2)" });
    addCylinderX(drawList, basis, comp, 0.15, 0.75, 2.9, 0, 1.28, 1.28, segs, bands[2] ? bands[2].hex : ceramic, { skipCaps: true, stroke: "rgba(0,0,0,0.22)" });
    addCylinderX(drawList, basis, comp, 0.75, 2.0, 2.9, 0, 1.26, 1.32, segs, ceramic, { skipCaps: true, stroke: "rgba(120,95,60,0.2)" });
    addCylinderX(drawList, basis, comp, 2.0, 2.55, 2.9, 0, 1.36, 1.52, segs, bands[3] ? bands[3].hex : "#D4AF37", { skipCaps: true, stroke: "rgba(0,0,0,0.22)" });
    addCylinderX(drawList, basis, comp, 2.55, 3.6, 2.9, 0, 1.55, 1.48, segs, ceramic, { stroke: "rgba(120,95,60,0.25)" });
  }

  function buildPushbutton(drawList, basis, comp) {
    var pins = getComponentPins("pushbutton");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    var pressed = !!((comp.state && comp.state.pressed) || (comp.props && comp.props.pressed));

    // 4 patillas metálicas
    var legCoords = [[-2.54, -3.81], [2.54, -3.81], [-2.54, 3.81], [2.54, 3.81]];
    for (var i = 0; i < legCoords.length; i++) {
      var lx = legCoords[i][0];
      var lz = legCoords[i][1];
      addBox(drawList, basis, comp, lx - 0.35, lx + 0.35, 0, 1.5, lz - 0.35, lz + 0.35, "#BCC4CC", { stroke: "rgba(60,65,72,0.4)" });
      addBox(drawList, basis, comp, lx - 0.35, lx + 0.35, 1.0, 1.5, Math.min(lz, 0), Math.max(lz, 0), "#BCC4CC", { stroke: null });
    }

    // Carcasa 6x6 mm gris/negra + placa metálica superior
    addBox(drawList, basis, comp, -3.0, 3.0, 0.7, 3.6, -3.0, 3.0, "#2C3036", {
      topColor: "#3A3F47",
      stroke: "rgba(10,12,15,0.55)"
    });
    addBox(drawList, basis, comp, -2.85, 2.85, 3.6, 4.15, -2.85, 2.85, "#C7CED6", {
      topColor: "#DCE1E8",
      stroke: "rgba(60,65,72,0.4)"
    });

    // Émbolo que baja físicamente en Y cuando pressed===true
    var plungerTop = pressed ? 4.55 : 6.1;
    addCylinderY(drawList, basis, comp, 0, 4.1, plungerTop, 0, 1.65, 1.55, 12, pressed ? "#1E2228" : "#282D34", {
      topColor: pressed ? "#008184" : "#353B44",
      stroke: "rgba(10,12,16,0.5)"
    });
  }

  function postDrawPotKnob(_pts, d) {
    var rIn = 1.0;
    var rOut = 3.55;
    var sinA = Math.sin(d.knobAngle);
    var cosA = -Math.cos(d.knobAngle);
    var p0 = projectPointObj(d.basis, localToWorld(d.comp, sinA * rIn, 14.86, -0.4 + cosA * rIn));
    var p1 = projectPointObj(d.basis, localToWorld(d.comp, sinA * rOut, 14.86, -0.4 + cosA * rOut));
    if (p0 && p1) {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = "#F8FAFC";
      ctx.lineWidth = Math.max(2, p1.s * 0.65);
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function buildPotentiometer(drawList, basis, comp) {
    var pins = getComponentPins("potentiometer");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // 3 patillas hacia +Z (z=5.08)
    var xs = [-2.54, 0, 2.54];
    for (var i = 0; i < 3; i++) {
      addBox(drawList, basis, comp, xs[i] - 0.35, xs[i] + 0.35, 0, 2.2, 4.75, 5.4, "#C2C9D2", { stroke: "rgba(60,65,72,0.4)" });
      addBox(drawList, basis, comp, xs[i] - 0.35, xs[i] + 0.35, 1.6, 2.2, 2.5, 5.4, "#C2C9D2", { stroke: null });
    }

    // Base azul 3D
    addBox(drawList, basis, comp, -5.6, 5.6, 0.8, 5.8, -5.4, 4.2, "#195FA8", {
      topColor: "#2472C4",
      stroke: "rgba(15, 52, 96, 0.45)"
    });

    // Cuello metálico roscado
    addCylinderY(drawList, basis, comp, 0, 5.8, 8.0, -0.4, 3.4, 3.4, 12, "#C6CDD5", {
      topColor: "#DCE2E8",
      stroke: "rgba(70,78,88,0.4)"
    });

    // Perilla rotatoria (-135° a +135° según props.value 0..1)
    var val = clamp(comp.props && comp.props.value !== undefined ? Number(comp.props.value) : 0.5, 0, 1);
    var knobAngle = (val - 0.5) * (270 * Math.PI / 180);

    addCylinderY(drawList, basis, comp, 0, 8.0, 14.8, -0.4, 4.2, 3.85, 14, "#25292E", {
      topColor: "#333840",
      stroke: "rgba(10,12,15,0.5)",
      topPostDraw: postDrawPotKnob,
      topPostData: { basis: basis, comp: comp, knobAngle: knobAngle }
    });
  }

  function buildServoSG90(drawList, basis, comp) {
    var pins = getComponentPins("servo_sg90");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    var angleDeg = clamp(
      comp.state && comp.state.currentAngle !== undefined
        ? Number(comp.state.currentAngle)
        : comp.props && comp.props.angle !== undefined
          ? Number(comp.props.angle)
          : 90,
      0,
      180
    );

    // Cuerpo azul traslúcido 3D (22.5 x 12 x 22 mm)
    addBox(drawList, basis, comp, -11.2, 11.2, 0.2, 21.8, -6.0, 6.0, "rgba(28, 112, 224, 0.84)", {
      topColor: "rgba(54, 134, 240, 0.88)",
      stroke: "rgba(18, 72, 148, 0.55)"
    });
    // Silueta interna de motor/engranajes
    addBox(drawList, basis, comp, -8.5, 6.5, 2.0, 18.0, -4.2, 4.2, "rgba(18, 50, 96, 0.45)", {
      stroke: null,
      skipBottom: true
    });

    // Pestañas de montaje laterales
    addBox(drawList, basis, comp, -16.2, -11.2, 14.2, 16.4, -6.0, 6.0, "rgba(38, 122, 232, 0.88)", {
      stroke: "rgba(18, 72, 148, 0.5)"
    });
    addBox(drawList, basis, comp, 11.2, 16.2, 14.2, 16.4, -6.0, 6.0, "rgba(38, 122, 232, 0.88)", {
      stroke: "rgba(18, 72, 148, 0.5)"
    });

    // Cable plano 3 hilos + conector Dupont en x=14.5
    var wireColors = ["#78350F", "#DC2626", "#EA580C"];
    var wireZs = [-2.54, 0, 2.54];
    for (var w = 0; w < 3; w++) {
      var wa = localToWorld(comp, 11.2, 3.0, wireZs[w]);
      var wb = localToWorld(comp, 14.5, 3.0, wireZs[w]);
      addLine3D(drawList, basis, wa, wb, wireColors[w], 2.2, 0);
    }
    addBox(drawList, basis, comp, 13.3, 15.8, 0.6, 4.4, -3.9, 3.9, "#22252A", {
      stroke: "rgba(0,0,0,0.5)"
    });

    // Engranaje superior y brazo (horn) blanco que rota a state.currentAngle
    addCylinderY(drawList, basis, comp, -5.2, 21.8, 24.4, 0, 5.2, 5.0, 12, "rgba(42, 128, 240, 0.9)", {
      stroke: "rgba(18, 72, 148, 0.45)"
    });
    addCylinderY(drawList, basis, comp, -5.2, 24.4, 25.8, 0, 2.4, 2.4, 10, "#F4F5F7", {
      stroke: "rgba(120,126,134,0.5)"
    });

    // Brazo blanco giratorio
    var hornRad = ((angleDeg - 90) * Math.PI) / 180;
    var hx = Math.cos(hornRad);
    var hz = -Math.sin(hornRad);
    var px = -hz;
    var pz = hx;
    var len = 14.0;
    var wTip = 1.25;
    var wBase = 2.45;
    var yBot = 25.0;
    var yTop = 26.4;
    var cx = -5.2;

    function hPt(along, side, y) {
      return localToWorld(comp, cx + hx * along + px * side, y, hz * along + pz * side);
    }
    var b0 = hPt(-2.8, -wBase, yBot), b1 = hPt(len, -wTip, yBot), b2 = hPt(len, wTip, yBot), b3 = hPt(-2.8, wBase, yBot);
    var t0 = hPt(-2.8, -wBase, yTop), t1 = hPt(len, -wTip, yTop), t2 = hPt(len, wTip, yTop), t3 = hPt(-2.8, wBase, yTop);
    pushFace(drawList, basis, [t3, t2, t1, t0], "#F8FAFC", { stroke: "rgba(110,118,128,0.55)" });
    pushFace(drawList, basis, [b0, b1, t1, t0], "#E5E7EB", { stroke: "rgba(110,118,128,0.45)" });
    pushFace(drawList, basis, [b1, b2, t2, t1], "#E5E7EB", { stroke: "rgba(110,118,128,0.45)" });
    pushFace(drawList, basis, [b2, b3, t3, t2], "#E5E7EB", { stroke: "rgba(110,118,128,0.45)" });
    pushFace(drawList, basis, [b3, b0, t0, t3], "#E5E7EB", { stroke: "rgba(110,118,128,0.45)" });
  }

  function buildUltrasonicHCSR04(drawList, overlays, basis, comp, simState) {
    var pins = getComponentPins("ultrasonic_hcsr04");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // 4 patillas inferiores
    var xs = [-3.81, -1.27, 1.27, 3.81];
    for (var i = 0; i < 4; i++) {
      addBox(drawList, basis, comp, xs[i] - 0.32, xs[i] + 0.32, 0, 2.4, -0.32, 0.32, "#C6CDD5", { stroke: "rgba(70,75,82,0.4)" });
    }

    // PCB azul vertical
    addBox(drawList, basis, comp, -22.5, 22.5, 2.0, 22.0, -0.8, 0.8, "#165DA8", {
      topColor: "#1F6FC4",
      stroke: "rgba(12, 50, 96, 0.5)"
    });
    // Cristal metálico superior
    addBox(drawList, basis, comp, -4.5, 4.5, 17.5, 20.5, 0.8, 2.8, "#D4DAE0", {
      stroke: "rgba(80,88,96,0.45)"
    });

    // Dos cilindros metálicos T y R hacia +Z con malla
    var cylXs = [-13.0, 13.0];
    for (var c = 0; c < 2; c++) {
      var cx = cylXs[c];
      addCylinderZ(drawList, basis, comp, cx, 12.0, 0.8, 12.2, 7.6, 7.6, 14, "#CFD5DC", {
        frontColor: "#DFE4EA",
        stroke: "rgba(75, 82, 92, 0.4)",
        frontPostDraw: function (polyProj) {
          // Dibujar malla oscura interior del transductor
          var centerX = 0;
          var centerY = 0;
          for (var k = 0; k < polyProj.length; k++) {
            centerX += polyProj[k].x;
            centerY += polyProj[k].y;
          }
          centerX /= polyProj.length;
          centerY /= polyProj.length;
          ctx.beginPath();
          for (var m = 0; m < polyProj.length; m++) {
            var vx = lerp(centerX, polyProj[m].x, 0.8);
            var vy = lerp(centerY, polyProj[m].y, 0.8);
            if (m === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.fillStyle = "#24292F";
          ctx.fill();
          ctx.strokeStyle = "rgba(160, 172, 185, 0.38)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      });
    }

    var st = comp.state || {};
    var isActive = Boolean(st.active);
    if (isActive) {
      var frontPt = projectPointObj(basis, localToWorld(comp, 0, 12.0, 14.0));
      var dirPt = projectPointObj(basis, localToWorld(comp, 0, 12.0, 38.0));
      if (frontPt && dirPt) {
        overlays.push({
          kind: "ultrasonic",
          x0: frontPt.x,
          y0: frontPt.y,
          x1: dirPt.x,
          y1: dirPt.y,
          scale: frontPt.s,
          depth: frontPt.z - 2
        });
      }
    }
  }

  function postDrawLcdScreen(_pts, d) {
    drawLcd1602Characters(d.basis, d.comp, d.line1, d.line2, d.isBacklit, d.isPowered);
  }

  function buildLcd1602(drawList, basis, comp) {
    var pins = getComponentPins("lcd_1602");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // PCB verde (80 x 36 x 1.8 mm)
    addBox(drawList, basis, comp, -40.0, 40.0, 0.2, 2.0, -18.0, 18.0, "#1D7A43", {
      topColor: "#228B4E",
      stroke: "rgba(15, 72, 38, 0.5)"
    });

    // Tira de pines superiores en z=-15.5
    addBox(drawList, basis, comp, -31.8, 9.0, 2.0, 3.6, -16.8, -14.2, "#23262B", {
      stroke: "rgba(10,12,15,0.5)"
    });
    for (var i = 0; i < pins.length; i++) {
      var lp = pins[i].localPos;
      addBox(drawList, basis, comp, lp.x - 0.32, lp.x + 0.32, 3.5, 4.4, lp.z - 0.32, lp.z + 0.32, "#D4AF37", { stroke: null });
    }

    // Bisel negro
    addBox(drawList, basis, comp, -35.5, 35.5, 2.0, 7.6, -11.5, 12.5, "#1E2228", {
      topColor: "#282D34",
      stroke: "rgba(10,12,16,0.65)"
    });

    // Pantalla retroiluminada con texto en tiempo real (2x16)
    var st = comp.state || {};
    var isPowered = Boolean(st.powered);
    var isBacklit = isPowered && st.backlight !== false && (!comp.props || comp.props.backlight !== false);
    var bgHex = isBacklit ? "#176BC4" : isPowered ? "#6E8B5B" : "#2D3B32";
    var topHex = isBacklit ? "#1E82E8" : isPowered ? "#809F6B" : "#34443A";
    var line1 = String(st.line1 !== undefined ? st.line1 : "");
    var line2 = String(st.line2 !== undefined ? st.line2 : "");

    addBox(drawList, basis, comp, -32.0, 32.0, 7.4, 7.75, -7.8, 8.8, bgHex, {
      topColor: topHex,
      unlit: isBacklit,
      stroke: "#0F172A",
      depthBias: -0.1,
      topPostDraw: postDrawLcdScreen,
      topPostData: { basis: basis, comp: comp, line1: line1, line2: line2, isBacklit: isBacklit, isPowered: isPowered }
    });
  }

  function drawLcd1602Characters(basis, comp, line1, line2, isBacklit, isPowered) {
    var rows = [line1, line2];
    var textColor = isBacklit ? "#F0F8FF" : isPowered ? "#1E2E18" : "rgba(180, 205, 190, 0.35)";
    var cellBg = isBacklit ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.14)";
    var y = 7.78;

    for (var r = 0; r < 2; r++) {
      var str = rows[r];
      var z0 = -6.3 + r * 6.9;
      var z1 = z0 + 5.7;
      for (var c = 0; c < 16; c++) {
        var x0 = -30.2 + c * 3.8;
        var x1 = x0 + 3.3;
        var p00 = projectPointObj(basis, localToWorld(comp, x0, y, z0));
        var p10 = projectPointObj(basis, localToWorld(comp, x1, y, z0));
        var p11 = projectPointObj(basis, localToWorld(comp, x1, y, z1));
        var p01 = projectPointObj(basis, localToWorld(comp, x0, y, z1));
        if (!p00 || !p10 || !p11 || !p01) continue;

        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fillStyle = cellBg;
        ctx.fill();

        var ch = c < str.length ? str.charAt(c) : " ";
        if (ch !== " ") {
          ctx.save();
          ctx.transform(
            (p10.x - p00.x) / 10,
            (p10.y - p00.y) / 10,
            (p01.x - p00.x) / 16,
            (p01.y - p00.y) / 16,
            p00.x,
            p00.y
          );
          ctx.fillStyle = textColor;
          ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ch, 5, 8.6);
          ctx.restore();
        }
      }
    }
  }

  function postDrawLdrCoil(_pts, d) {
    if (!beginLocalTransform(d.basis, d.comp, -2.2, 5.85, -2.2, 2.2, -2.2, -2.2, 2.2, 44, 44)) return;
    ctx.strokeStyle = "#A94420";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(8, 12);
    ctx.lineTo(36, 12);
    ctx.lineTo(36, 18);
    ctx.lineTo(8, 18);
    ctx.lineTo(8, 24);
    ctx.lineTo(36, 24);
    ctx.lineTo(36, 30);
    ctx.lineTo(8, 30);
    ctx.stroke();
    ctx.restore();
  }

  function buildLdr(drawList, basis, comp) {
    var pins = getComponentPins("ldr");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // 2 patillas
    addBox(drawList, basis, comp, -1.5, -1.04, 0, 4.5, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });
    addBox(drawList, basis, comp, 1.04, 1.5, 0, 4.5, -0.22, 0.22, "#BFC6CE", { stroke: "rgba(60,65,70,0.4)" });

    // Disco cerámico con serpentín CdS
    addCylinderY(drawList, basis, comp, 0, 4.5, 5.8, 0, 2.75, 2.75, 12, "#E5CFA9", {
      topColor: "#EFE0BE",
      stroke: "rgba(130, 100, 62, 0.45)",
      topPostDraw: postDrawLdrCoil,
      topPostData: { basis: basis, comp: comp }
    });
  }

  function buildTmp36(drawList, basis, comp) {
    var pins = getComponentPins("tmp36");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    // 3 patas
    var xs = [-2.54, 0, 2.54];
    for (var i = 0; i < 3; i++) {
      addBox(drawList, basis, comp, xs[i] - 0.25, xs[i] + 0.25, 0, 4.1, -0.22, 0.22, "#C2C9D2", { stroke: "rgba(60,65,72,0.35)" });
    }

    // Encapsulado D TO-92 negro (cara plana en +Z, arco atrás en -Z)
    var segs = 8;
    var ringBot = [];
    var ringTop = [];
    for (var s = 0; s <= segs; s++) {
      var a = Math.PI + (s / segs) * Math.PI; // PI -> 2PI (z <= 0)
      var rx = 2.4 * Math.cos(a);
      var rz = 2.1 * Math.sin(a);
      ringBot.push(localToWorld(comp, rx, 4.0, rz));
      ringTop.push(localToWorld(comp, rx, 8.8, rz));
    }
    // Cara plana delantera (+Z) en z = +1.1
    ringBot.push(localToWorld(comp, 2.4, 4.0, 1.1));
    ringBot.push(localToWorld(comp, -2.4, 4.0, 1.1));
    ringTop.push(localToWorld(comp, 2.4, 8.8, 1.1));
    ringTop.push(localToWorld(comp, -2.4, 8.8, 1.1));

    var nPts = ringBot.length;
    for (var k = 0; k < nPts; k++) {
      var nk = (k + 1) % nPts;
      pushFace(drawList, basis, [ringBot[nk], ringBot[k], ringTop[k], ringTop[nk]], "#23262C", {
        stroke: "rgba(10,12,15,0.5)"
      });
    }
    var topCap = [];
    for (var t = nPts - 1; t >= 0; t--) topCap.push(ringTop[t]);
    pushFace(drawList, basis, topCap, "#2F343C", { stroke: "rgba(10,12,15,0.5)" });
  }

  function postDrawBuzzerTop(_pts, d) {
    if (!beginLocalTransform(d.basis, d.comp, -5.5, 9.26, -5.5, 5.5, -5.5, -5.5, 5.5, 110, 110)) return;
    ctx.fillStyle = "#C9A23F";
    ctx.beginPath();
    ctx.arc(55, 55, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111317";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Marca '+' en lado POS (-X)
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(16, 55);
    ctx.lineTo(26, 55);
    ctx.moveTo(21, 50);
    ctx.lineTo(21, 60);
    ctx.stroke();
    ctx.restore();
  }

  function buildBuzzer(drawList, overlays, basis, comp) {
    var pins = getComponentPins("buzzer");
    for (var p = 0; p < pins.length; p++) {
      recordProjectedPin(basis, comp, pins[p], false);
    }

    addBox(drawList, basis, comp, -4.06, -3.56, 0, 1.0, -0.25, 0.25, "#C2C9D2", { stroke: null });
    addBox(drawList, basis, comp, 3.56, 4.06, 0, 1.0, -0.25, 0.25, "#C2C9D2", { stroke: null });

    // Cilindro negro con orificio acústico central y marca +
    addCylinderY(drawList, basis, comp, 0, 0.6, 9.2, 0, 6.0, 6.0, 16, "#22252A", {
      topColor: "#2C3037",
      stroke: "rgba(10,12,15,0.55)",
      topPostDraw: postDrawBuzzerTop,
      topPostData: { basis: basis, comp: comp }
    });

    var st = comp.state || {};
    if (st.active) {
      var topCenter = projectPointObj(basis, localToWorld(comp, 0, 9.6, 0));
      if (topCenter) {
        overlays.push({
          kind: "buzzer",
          x: topCenter.x,
          y: topCenter.y,
          scale: topCenter.s,
          depth: topCenter.z - 3
        });
      }
    }
  }

  // =========================================================================
  // Cables 3D (curvas Bezier cúbicas elevadas en Y + sombra + capuchones Dupont)
  // =========================================================================

  function computeWirePoints(compMap, wire) {
    var fromComp = compMap[wire.from && wire.from.compId];
    var toComp = compMap[wire.to && wire.to.compId];
    if (!fromComp || !toComp) return null;

    var p0 = getWorldPinPosition(fromComp, wire.from.pinId);
    var p3 = getWorldPinPosition(toComp, wire.to.pinId);
    var dx = p3.x - p0.x;
    var dz = p3.z - p0.z;
    var distXZ = Math.sqrt(dx * dx + dz * dz);
    var arch = clamp(14 + distXZ * 0.24, 15, 42);
    var topY = Math.max(p0.y, p3.y) + arch;

    var p1 = { x: lerp(p0.x, p3.x, 0.22), y: topY, z: lerp(p0.z, p3.z, 0.22) };
    var p2 = { x: lerp(p0.x, p3.x, 0.78), y: topY, z: lerp(p0.z, p3.z, 0.78) };

    return { p0: p0, p1: p1, p2: p2, p3: p3 };
  }

  function evalCubicBezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var tt = t * t;
    var uu = u * u;
    var uuu = uu * u;
    var ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
      z: uuu * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + ttt * p3.z
    };
  }

  function drawDupontCap(drawList, basis, wp) {
    var pseudoComp = { pos: wp, rotY: 0 };
    addBox(drawList, basis, pseudoComp, -1.1, 1.1, 0.2, 6.4, -1.1, 1.1, "#22252A", {
      topColor: "#32373F",
      stroke: "rgba(10,12,16,0.5)",
      skipBottom: true
    });
  }

  function buildWire(drawList, basis, compMap, wire) {
    var pts = computeWirePoints(compMap, wire);
    if (!pts) return;

    // Capuchones Dupont negros en los extremos
    drawDupontCap(drawList, basis, pts.p0);
    drawDupontCap(drawList, basis, pts.p3);

    var steps = 16;
    var worldCurve = [];
    var screenCurve = [];
    var shadowPts = [];

    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var wp = evalCubicBezier(pts.p0, pts.p1, pts.p2, pts.p3, t);
      // Empieza/termina en la parte superior del capuchón Dupont
      if (i === 0) wp.y += 6.0;
      if (i === steps) wp.y += 6.0;
      worldCurve.push(wp);

      var pr = projectPoint(basis, wp.x, wp.y, wp.z);
      if (pr) screenCurve.push({ x: pr.x, y: pr.y, depth: pr.z });

      var sp = projectPoint(basis, wp.x - wp.y * 0.26, 0.03, wp.z - wp.y * 0.2);
      if (sp) shadowPts.push(sp);
    }

    // Sombra suave en el suelo
    if (shadowPts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(shadowPts[0].x, shadowPts[0].y);
      for (var s = 1; s < shadowPts.length; s++) {
        ctx.lineTo(shadowPts[s].x, shadowPts[s].y);
      }
      ctx.strokeStyle = "rgba(38, 35, 28, 0.11)";
      ctx.lineWidth = 3.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    var isSelected = state.selected && state.selected.kind === "wire" && state.selected.id === wire.id;
    var isHovered = state.hoveredItem && state.hoveredItem.kind === "wire" && state.hoveredItem.id === wire.id;
    var wireColor = wire.color || "#D93025";

    for (var j = 0; j < steps; j++) {
      var seg = projectClippedSegment(basis, worldCurve[j], worldCurve[j + 1]);
      if (!seg) continue;
      var sScale = clamp(basis.fovFactor / seg.depth, 0.8, 3.2);
      drawList.push({
        kind: "wireSeg",
        ax: seg.ax,
        ay: seg.ay,
        bx: seg.bx,
        by: seg.by,
        color: wireColor,
        width: clamp(sScale * 1.45, 2.0, 5.0),
        selected: isSelected,
        hovered: isHovered,
        depth: seg.depth - 0.1
      });
    }

    if (screenCurve.length >= 2) {
      state.projectedWires.push({
        wire: wire,
        pts: screenCurve
      });
    }
  }

  // =========================================================================
  // Overlays: Halos LED, Ondas Buzzer/Ultrasónico, Sobrecorriente, Selección
  // =========================================================================

  function drawGroundGlow(item) {
    ctx.save();
    ctx.transform(
      item.ex.x - item.center.x,
      item.ex.y - item.center.y,
      item.ez.x - item.center.x,
      item.ez.y - item.center.y,
      item.center.x,
      item.center.y
    );
    var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    var rgb = parseColorRgb(item.color);
    var a0 = (0.36 * item.intensity).toFixed(3);
    var a1 = (0.14 * item.intensity).toFixed(3);
    grad.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a0 + ")");
    grad.addColorStop(0.55, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + a1 + ")");
    grad.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOverlayEffect(ov) {
    if (ov.kind === "halo") {
      var r = Math.max(4, ov.radius);
      var rgb = parseColorRgb(ov.color);
      var grad = ctx.createRadialGradient(ov.x, ov.y, 0, ov.x, ov.y, r);
      grad.addColorStop(0, ov.coreColor || "#FFFFFF");
      grad.addColorStop(0.35, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + (0.72 * ov.intensity).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ov.x, ov.y, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (ov.kind === "ledGlow") {
      var b = ov.brightness;
      var sc = ov.scale;
      var rgbL = parseColorRgb(ov.color);

      // Capa exterior atmosférica
      var rOuter = clamp((13 + 12 * b) * sc, 16, 120);
      var gOuter = ctx.createRadialGradient(ov.x, ov.y, 0, ov.x, ov.y, rOuter);
      gOuter.addColorStop(0, "rgba(" + rgbL.r + "," + rgbL.g + "," + rgbL.b + "," + (0.52 * b).toFixed(3) + ")");
      gOuter.addColorStop(0.45, "rgba(" + rgbL.r + "," + rgbL.g + "," + rgbL.b + "," + (0.22 * b).toFixed(3) + ")");
      gOuter.addColorStop(1, "rgba(" + rgbL.r + "," + rgbL.g + "," + rgbL.b + ",0)");
      ctx.fillStyle = gOuter;
      ctx.beginPath();
      ctx.arc(ov.x, ov.y, rOuter, 0, Math.PI * 2);
      ctx.fill();

      // Capa media saturada
      var rMid = clamp((6.5 + 4.5 * b) * sc, 9, 55);
      var gMid = ctx.createRadialGradient(ov.x, ov.y, 0, ov.x, ov.y, rMid);
      gMid.addColorStop(0, "rgba(255,255,255," + (0.85 * b).toFixed(3) + ")");
      gMid.addColorStop(0.35, "rgba(" + rgbL.r + "," + rgbL.g + "," + rgbL.b + "," + (0.78 * b).toFixed(3) + ")");
      gMid.addColorStop(1, "rgba(" + rgbL.r + "," + rgbL.g + "," + rgbL.b + ",0)");
      ctx.fillStyle = gMid;
      ctx.beginPath();
      ctx.arc(ov.x, ov.y, rMid, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (ov.kind === "overcurrent") {
      var pulse = 0.5 + 0.5 * Math.sin(state.animTimeMs * 0.014);
      var rWarn = clamp((9 + 3 * pulse) * ov.scale, 14, 48);
      var gWarn = ctx.createRadialGradient(ov.x, ov.y, 0, ov.x, ov.y, rWarn);
      gWarn.addColorStop(0, "rgba(239, 68, 68, " + (0.35 + 0.2 * pulse).toFixed(3) + ")");
      gWarn.addColorStop(0.7, "rgba(220, 38, 38, 0.25)");
      gWarn.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = gWarn;
      ctx.beginPath();
      ctx.arc(ov.x, ov.y, rWarn, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(ov.x, ov.y, rWarn * 0.72, 0, Math.PI * 2);
      ctx.strokeStyle = "#DC2626";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();

      // Etiqueta "¡SOBRECORRIENTE!"
      var labelY = ov.y - rWarn * 0.8 - 18;
      var text = "¡SOBRECORRIENTE!";
      ctx.font = "700 11px system-ui, -apple-system, sans-serif";
      var tw = ctx.measureText(text).width + 14;
      var rx = ov.x - tw * 0.5;
      var ry = labelY - 10;

      ctx.fillStyle = "#B91C1C";
      roundRect(ctx, rx, ry, tw, 20, 6);
      ctx.fill();
      ctx.strokeStyle = "#FEE2E2";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, ov.x, labelY);
      return;
    }

    if (ov.kind === "buzzer") {
      var phase = (state.animTimeMs * 0.0022) % 1;
      for (var w = 0; w < 3; w++) {
        var t = (phase + w / 3) % 1;
        var rad = (4 + t * 14) * ov.scale;
        var alpha = (1 - t) * 0.65;
        ctx.beginPath();
        ctx.ellipse(ov.x, ov.y - t * 18 * ov.scale, rad, rad * 0.45, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 129, 132, " + alpha.toFixed(3) + ")";
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      return;
    }

    if (ov.kind === "ultrasonic") {
      var dx = ov.x1 - ov.x0;
      var dy = ov.y1 - ov.y0;
      var ang = Math.atan2(dy, dx);
      var dist = Math.sqrt(dx * dx + dy * dy);
      var uPhase = (state.animTimeMs * 0.0018) % 1;
      for (var u = 0; u < 3; u++) {
        var ut = (uPhase + u / 3) % 1;
        var rArc = Math.max(8, ut * Math.max(24, dist));
        var uAlpha = (1 - ut) * 0.52;
        ctx.beginPath();
        ctx.arc(ov.x0, ov.y0, rArc, ang - 0.52, ang + 0.52);
        ctx.strokeStyle = "rgba(14, 165, 233, " + uAlpha.toFixed(3) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function roundRect(c2d, x, y, w, h, r) {
    c2d.beginPath();
    c2d.moveTo(x + r, y);
    c2d.lineTo(x + w - r, y);
    c2d.quadraticCurveTo(x + w, y, x + w, y + r);
    c2d.lineTo(x + w, y + h - r);
    c2d.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c2d.lineTo(x + r, y + h);
    c2d.quadraticCurveTo(x, y + h, x, y + h - r);
    c2d.lineTo(x, y + r);
    c2d.quadraticCurveTo(x, y, x + r, y);
    c2d.closePath();
  }

  function drawSelectionOutline(basis, comp) {
    var b = getComponentBounds(comp.type);
    var pad = 1.5;
    var corners = [
      localToWorld(comp, b.minX - pad, 0.25, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0.25, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0.25, b.maxZ + pad),
      localToWorld(comp, b.minX - pad, 0.25, b.maxZ + pad)
    ];
    var pts = [];
    for (var i = 0; i < 4; i++) {
      var pr = projectPoint(basis, corners[i].x, corners[i].y, corners[i].z);
      if (!pr) return;
      pts.push(pr);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.closePath();
    ctx.strokeStyle = "#008184";
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
  }

  function drawPinHighlightsAndPendingWire(basis, simState) {
    // Pin origen pendiente
    if (state.pendingWireStart) {
      var startEntry = state.pinLookup[state.pendingWireStart.compId + "::" + state.pendingWireStart.pinId];
      if (startEntry) {
        ctx.beginPath();
        ctx.arc(startEntry.sx, startEntry.sy, 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = state.wireColor || "#D93025";
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(startEntry.sx, startEntry.sy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Cable guía en tiempo real siguiendo al ratón
        var endX = state.mouseCanvas.x;
        var endY = state.mouseCanvas.y;
        if (state.hoveredPin) {
          var hovEntry = state.pinLookup[state.hoveredPin.compId + "::" + state.hoveredPin.pinId];
          if (hovEntry) {
            endX = hovEntry.sx;
            endY = hovEntry.sy;
          }
        }
        var liftPx = Math.min(90, 28 + Math.hypot(endX - startEntry.sx, endY - startEntry.sy) * 0.25);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startEntry.sx, startEntry.sy);
        ctx.bezierCurveTo(startEntry.sx, startEntry.sy - liftPx, endX, endY - liftPx, endX, endY);
        ctx.strokeStyle = state.wireColor || "#D93025";
        ctx.lineWidth = 3.0;
        ctx.setLineDash([7, 5]);
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }
    }

    // Anillo cian en pin bajo hover
    if (state.hoveredPin) {
      var hEntry = state.pinLookup[state.hoveredPin.compId + "::" + state.hoveredPin.pinId];
      if (hEntry) {
        ctx.beginPath();
        ctx.arc(hEntry.sx, hEntry.sy, hEntry.isBreadboard ? 4.8 : 6.2, 0, Math.PI * 2);
        ctx.strokeStyle = "#06B6D4";
        ctx.lineWidth = 2.3;
        ctx.stroke();
        ctx.fillStyle = "rgba(6, 182, 212, 0.22)";
        ctx.fill();
      }
    }
  }

  // =========================================================================
  // Pipeline principal de renderizado
  // =========================================================================

  function addBreadboardContactShadow(drawList, basis, comp) {
    var b = getComponentBounds(comp.type);
    var pad = 0.8;
    var offX = -1.6;
    var offZ = -1.2;
    var corners = [
      localToWorld(comp, b.minX - pad, 0.04, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0.04, b.minZ - pad),
      localToWorld(comp, b.maxX + pad, 0.04, b.maxZ + pad),
      localToWorld(comp, b.minX - pad, 0.04, b.maxZ + pad)
    ];
    var pts = [];
    var depthSum = 0;
    for (var i = 0; i < 4; i++) {
      var pr = projectPoint(basis, corners[i].x + offX, corners[i].y, corners[i].z + offZ);
      if (!pr) return;
      pts.push(pr);
      depthSum += pr.z;
    }
    drawList.push({
      kind: "poly",
      proj: pts,
      fill: "rgba(38, 35, 28, 0.12)",
      stroke: null,
      strokeWidth: 0,
      depth: depthSum * 0.25 + 2.5
    });
  }

  function isBreadboardMountable(type) {
    return (
      type === "led" ||
      type === "resistor" ||
      type === "pushbutton" ||
      type === "potentiometer" ||
      type === "ldr" ||
      type === "tmp36" ||
      type === "buzzer"
    );
  }

  function snapDraggedComponentPos(basis, sx, sy, drag, altKey) {
    var comp = drag.comp;
    var bounds = getComponentBounds(comp.type);
    var step = altKey ? 5.0 : bounds.isBoard ? 5.0 : 2.54;

    if (isBreadboardMountable(comp.type)) {
      var comps = (state.lastSimState && state.lastSimState.components) || [];
      for (var i = 0; i < comps.length; i++) {
        var bb = comps[i];
        if (bb.type !== "breadboard_830") continue;
        var bbY = (bb.pos && bb.pos.y ? bb.pos.y : 0) + 9.2;
        var ptOnBB = screenToGroundPlane(basis, sx, sy, bbY);
        if (!ptOnBB) continue;

        var rawX = ptOnBB.x + drag.grabOffsetX;
        var rawZ = ptOnBB.z + drag.grabOffsetZ;
        var loc = worldToLocal(bb, rawX, bbY, rawZ);
        if (Math.abs(loc.x) <= 80.5 && Math.abs(loc.z) <= 25.0) {
          var cPins = getComponentPins(comp.type);
          var p0Local = cPins.length && cPins[0].localPos ? cPins[0].localPos : { x: 0, y: 0, z: 0 };
          var p0Rot = rotateLocal(p0Local.x, 0, p0Local.z, comp.rotY || 0);
          var targetPinWorld = { x: rawX + p0Rot.x, y: bbY, z: rawZ + p0Rot.z };
          var targetPinInBB = worldToLocal(bb, targetPinWorld.x, bbY, targetPinWorld.z);

          var bbPins = getComponentPins("breadboard_830");
          var bestPin = null;
          var bestD2 = Infinity;
          for (var h = 0; h < bbPins.length; h++) {
            var hl = bbPins[h].localPos;
            var dx = targetPinInBB.x - hl.x;
            var dz = targetPinInBB.z - hl.z;
            var d2 = dx * dx + dz * dz;
            if (d2 < bestD2) {
              bestD2 = d2;
              bestPin = hl;
            }
          }
          if (bestPin) {
            var holeW = localToWorld(bb, bestPin.x, 9.2, bestPin.z);
            return {
              x: Number((holeW.x - p0Rot.x).toFixed(3)),
              y: Number(bbY.toFixed(3)),
              z: Number((holeW.z - p0Rot.z).toFixed(3))
            };
          }
        }
      }
    }

    var groundPt = screenToGroundPlane(basis, sx, sy, 0);
    if (!groundPt) return null;
    var nx = clamp(snapCoord(groundPt.x + drag.grabOffsetX, step), -230, 230);
    var nz = clamp(snapCoord(groundPt.z + drag.grabOffsetZ, step), -230, 230);
    var baseY = isBreadboardMountable(comp.type) ? 0 : drag.origPos.y;
    return {
      x: Number(nx.toFixed(2)),
      y: baseY,
      z: Number(nz.toFixed(2))
    };
  }

  function render(simState, dtMs) {
    if (!canvas || !ctx) return;

    var dt = clamp(Number(dtMs) || 16, 0, 100);
    state.animTimeMs += dt;
    state.lastSimState = simState || state.lastSimState;
    if (state.uploadFlashMs > 0) {
      state.uploadFlashMs = Math.max(0, state.uploadFlashMs - dt);
    }

    // Interpolación suave de cámara si hay animación activa
    if (camera.anim) {
      var t = 1 - Math.exp(-dt * 0.014);
      camera.yaw = lerp(camera.yaw, camera.anim.yaw, t);
      camera.pitch = lerp(camera.pitch, camera.anim.pitch, t);
      camera.dist = lerp(camera.dist, camera.anim.dist, t);
      camera.target.x = lerp(camera.target.x, camera.anim.target.x, t);
      camera.target.y = lerp(camera.target.y, camera.anim.target.y, t);
      camera.target.z = lerp(camera.target.z, camera.anim.target.z, t);
      if (
        Math.abs(camera.yaw - camera.anim.yaw) < 0.002 &&
        Math.abs(camera.pitch - camera.anim.pitch) < 0.002 &&
        Math.abs(camera.dist - camera.anim.dist) < 0.3 &&
        Math.abs(camera.target.x - camera.anim.target.x) < 0.2 &&
        Math.abs(camera.target.z - camera.anim.target.z) < 0.2
      ) {
        camera.yaw = camera.anim.yaw;
        camera.pitch = camera.anim.pitch;
        camera.dist = camera.anim.dist;
        camera.target = { x: camera.anim.target.x, y: camera.anim.target.y, z: camera.anim.target.z };
        camera.anim = null;
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var basis = getCameraBasis();
    state.projectedPins = [];
    state.projectedWires = [];
    state.pinLookup = Object.create(null);

    drawGridAndGround(basis, state.lastSimState);

    var drawList = [];
    var overlays = [];
    var comps = (state.lastSimState && state.lastSimState.components) || [];
    var wires = (state.lastSimState && state.lastSimState.wires) || [];
    var compMap = Object.create(null);

    for (var i = 0; i < comps.length; i++) {
      var comp = comps[i];
      compMap[comp.id] = comp;

      if ((comp.pos && comp.pos.y) >= 8.5) {
        addBreadboardContactShadow(drawList, basis, comp);
      }

      switch (comp.type) {
        case "arduino_uno_r3":
          buildArduinoUno(drawList, overlays, basis, comp, state.lastSimState);
          break;
        case "breadboard_830":
          buildBreadboard830(drawList, basis, comp);
          break;
        case "led":
          buildLed(drawList, overlays, basis, comp);
          break;
        case "resistor":
          buildResistor(drawList, basis, comp);
          break;
        case "pushbutton":
          buildPushbutton(drawList, basis, comp);
          break;
        case "potentiometer":
          buildPotentiometer(drawList, basis, comp);
          break;
        case "servo_sg90":
          buildServoSG90(drawList, basis, comp);
          break;
        case "ultrasonic_hcsr04":
          buildUltrasonicHCSR04(drawList, overlays, basis, comp, state.lastSimState);
          break;
        case "lcd_1602":
          buildLcd1602(drawList, basis, comp);
          break;
        case "ldr":
          buildLdr(drawList, basis, comp);
          break;
        case "tmp36":
          buildTmp36(drawList, basis, comp);
          break;
        case "buzzer":
          buildBuzzer(drawList, overlays, basis, comp);
          break;
        default:
          addBox(drawList, basis, comp, -5, 5, 0, 6, -5, 5, "#94A3B8", { stroke: "#475569" });
      }
    }

    for (var w = 0; w < wires.length; w++) {
      buildWire(drawList, basis, compMap, wires[w]);
    }

    // Ordenar de más lejano a más cercano (Painter's Algorithm)
    drawList.sort(function (a, b) {
      return b.depth - a.depth;
    });

    for (var d = 0; d < drawList.length; d++) {
      var item = drawList[d];
      if (item.kind === "poly") {
        var pts = item.proj;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var k = 1; k < pts.length; k++) {
          ctx.lineTo(pts[k].x, pts[k].y);
        }
        ctx.closePath();
        ctx.fillStyle = item.fill;
        ctx.fill();
        if (item.stroke) {
          ctx.strokeStyle = item.stroke;
          ctx.lineWidth = item.strokeWidth;
          ctx.lineJoin = "round";
          ctx.stroke();
        }
        if (item.postDraw) {
          item.postDraw(pts, item.postData);
        }
      } else if (item.kind === "line") {
        ctx.beginPath();
        ctx.moveTo(item.ax, item.ay);
        ctx.lineTo(item.bx, item.by);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.lineCap = "round";
        ctx.stroke();
      } else if (item.kind === "wireSeg") {
        if (item.selected || item.hovered) {
          ctx.beginPath();
          ctx.moveTo(item.ax, item.ay);
          ctx.lineTo(item.bx, item.by);
          ctx.strokeStyle = item.selected ? "rgba(0, 129, 132, 0.48)" : "rgba(6, 182, 212, 0.35)";
          ctx.lineWidth = item.width + 5;
          ctx.lineCap = "round";
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(item.ax, item.ay);
        ctx.lineTo(item.bx, item.by);
        ctx.strokeStyle = "rgba(18, 20, 24, 0.25)";
        ctx.lineWidth = item.width + 1.1;
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(item.ax, item.ay);
        ctx.lineTo(item.bx, item.by);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.width;
        ctx.lineCap = "round";
        ctx.stroke();
      } else if (item.kind === "groundGlow") {
        drawGroundGlow(item);
      }
    }

    // Selección del componente actual
    if (state.selected && state.selected.kind === "component" && compMap[state.selected.id]) {
      drawSelectionOutline(basis, compMap[state.selected.id]);
    }

    // Halos luminosos, ondas y alertas ordenados de atrás hacia delante
    overlays.sort(function (a, b) {
      return b.depth - a.depth;
    });
    for (var o = 0; o < overlays.length; o++) {
      drawOverlayEffect(overlays[o]);
    }

    drawPinHighlightsAndPendingWire(basis, state.lastSimState);
  }

  // =========================================================================
  // Hit-testing exacto en 3D (Pines, Componentes pequeños/placas, Cables)
  // =========================================================================

  function hitTestPin(sx, sy) {
    var best = null;
    var bestScore = Infinity;
    var pins = state.projectedPins;

    for (var i = 0; i < pins.length; i++) {
      var p = pins[i];
      var maxR = p.isBreadboard ? clamp(p.s * 1.15, 4.2, 7.2) : clamp(p.s * 1.5, 7.0, 12.0);
      var d = Math.hypot(sx - p.sx, sy - p.sy);
      if (d <= maxR) {
        // Priorizar pines de componentes discretos/Arduino frente a agujeros de protoboard debajo
        var score = p.isBreadboard ? d + 2.2 : d;
        if (score < bestScore) {
          bestScore = score;
          best = p;
        }
      }
    }
    return best;
  }

  function distPointToSegment(px, py, ax, ay, bx, by) {
    var vx = bx - ax;
    var vy = by - ay;
    var wx = px - ax;
    var wy = py - ay;
    var len2 = vx * vx + vy * vy;
    var t = len2 > 1e-6 ? clamp((wx * vx + wy * vy) / len2, 0, 1) : 0;
    var cx = ax + t * vx;
    var cy = ay + t * vy;
    return { dist: Math.hypot(px - cx, py - cy), t: t };
  }

  function hitTestWire(sx, sy) {
    var best = null;
    var bestDist = 7.5;
    var wires = state.projectedWires;
    for (var i = 0; i < wires.length; i++) {
      var w = wires[i];
      var pts = w.pts;
      for (var j = 0; j < pts.length - 1; j++) {
        var res = distPointToSegment(sx, sy, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
        if (res.dist < bestDist) {
          bestDist = res.dist;
          best = {
            wire: w.wire,
            dist: res.dist,
            depth: lerp(pts[j].depth, pts[j + 1].depth, res.t)
          };
        }
      }
    }
    return best;
  }

  function hitTestComponent(sx, sy) {
    var basis = getCameraBasis();
    var ray = screenToRay(basis, sx, sy);
    var comps = (state.lastSimState && state.lastSimState.components) || [];

    var bestSmall = null;
    var bestSmallT = Infinity;
    var bestBoard = null;
    var bestBoardT = Infinity;

    for (var i = 0; i < comps.length; i++) {
      var comp = comps[i];
      var hit = intersectRayOBB(ray, comp);
      if (!hit) continue;
      if (!hit.isBoard) {
        if (hit.t < bestSmallT) {
          bestSmallT = hit.t;
          bestSmall = comp;
        }
      } else {
        if (hit.t < bestBoardT) {
          bestBoardT = hit.t;
          bestBoard = comp;
        }
      }
    }

    if (bestSmall && (!bestBoard || bestSmallT <= bestBoardT + 6)) {
      return { comp: bestSmall, t: bestSmallT, isBoard: false };
    }
    if (bestBoard) {
      return { comp: bestBoard, t: bestBoardT, isBoard: true };
    }
    return null;
  }

  function hitTestRightClickItem(sx, sy) {
    var compHit = hitTestComponent(sx, sy);
    var wireHit = hitTestWire(sx, sy);

    // Priorizar componentes pequeños sobre cables y placas
    if (compHit && !compHit.isBoard) {
      return { kind: "component", item: compHit.comp };
    }
    if (wireHit && (!compHit || wireHit.depth <= compHit.t + 4)) {
      return { kind: "wire", item: wireHit.wire };
    }
    if (compHit) {
      return { kind: "component", item: compHit.comp };
    }
    return null;
  }

  // =========================================================================
  // Interacción con ratón / teclado
  // =========================================================================

  function getLocalCoords(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function snapCoord(val, step) {
    return Math.round(val / step) * step;
  }

  function updateHoverState(sx, sy, clientX, clientY) {
    var pinHit = hitTestPin(sx, sy);
    var prevKey = state.hoveredPin ? state.hoveredPin.compId + "::" + state.hoveredPin.pinId : null;
    var nextKey = pinHit ? pinHit.comp.id + "::" + pinHit.pin.id : null;

    if (pinHit) {
      state.hoveredPin = {
        compId: pinHit.comp.id,
        pinId: pinHit.pin.id,
        screenX: clientX,
        screenY: clientY
      };
      state.hoveredItem = null;
      canvas.style.cursor = "crosshair";

      var sim = NS.Simulator;
      var voltageInfo = sim && typeof sim.getPinVoltage === "function"
        ? sim.getPinVoltage(pinHit.comp.id, pinHit.pin.id)
        : null;

      if (typeof callbacks.onHoverPin === "function") {
        callbacks.onHoverPin({
          comp: pinHit.comp,
          pin: pinHit.pin,
          voltageInfo: voltageInfo,
          screenX: clientX,
          screenY: clientY
        });
      }
      return;
    }

    if (prevKey !== null || nextKey !== null) {
      state.hoveredPin = null;
      if (typeof callbacks.onHoverPin === "function") {
        callbacks.onHoverPin(null);
      }
    }

    var compHit = hitTestComponent(sx, sy);
    if (compHit && !compHit.isBoard) {
      state.hoveredItem = { kind: "component", id: compHit.comp.id };
      canvas.style.cursor = compHit.comp.type === "pushbutton" ? "pointer" : "grab";
      return;
    }

    var wireHit = hitTestWire(sx, sy);
    if (wireHit) {
      state.hoveredItem = { kind: "wire", id: wireHit.wire.id };
      canvas.style.cursor = "pointer";
      return;
    }

    if (compHit) {
      state.hoveredItem = { kind: "component", id: compHit.comp.id };
      canvas.style.cursor = "grab";
      return;
    }

    state.hoveredItem = null;
    canvas.style.cursor = "default";
  }

  function onMouseDown(e) {
    if (!canvas) return;
    var pt = getLocalCoords(e);
    state.mouseCanvas = { x: pt.x, y: pt.y, inside: true };
    state.mouseClient = { x: e.clientX, y: e.clientY };

    // Botón central o Shift+click izquierdo -> Pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      camera.anim = null;
      state.drag = {
        mode: "pan",
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y
      };
      canvas.style.cursor = "move";
      return;
    }

    if (e.button !== 0) return;

    // 1. Click en pin -> iniciar o completar cableado
    var pinHit = hitTestPin(pt.x, pt.y);
    if (pinHit) {
      if (typeof callbacks.onSelect === "function") callbacks.onSelect(null);
      if (!state.pendingWireStart) {
        state.pendingWireStart = { compId: pinHit.comp.id, pinId: pinHit.pin.id };
      } else if (
        state.pendingWireStart.compId === pinHit.comp.id &&
        state.pendingWireStart.pinId === pinHit.pin.id
      ) {
        state.pendingWireStart = null;
      } else {
        var from = { compId: state.pendingWireStart.compId, pinId: state.pendingWireStart.pinId };
        var to = { compId: pinHit.comp.id, pinId: pinHit.pin.id };
        state.pendingWireStart = null;
        if (typeof callbacks.onPinConnect === "function") {
          callbacks.onPinConnect(from, to);
        }
      }
      updateHoverState(pt.x, pt.y, e.clientX, e.clientY);
      return;
    }

    // 2. Click en componente -> seleccionar / preparar arrastre XZ / toggle pushbutton
    var compHit = hitTestComponent(pt.x, pt.y);
    if (compHit) {
      var comp = compHit.comp;
      state.selected = { kind: "component", id: comp.id };
      if (typeof callbacks.onSelect === "function") {
        callbacks.onSelect({ kind: "component", id: comp.id });
      }
      var basis = getCameraBasis();
      var planeY = (comp.pos && comp.pos.y) || 0;
      var hitWorld = screenToGroundPlane(basis, pt.x, pt.y, planeY);
      state.drag = {
        mode: "comp",
        comp: comp,
        startX: pt.x,
        startY: pt.y,
        moved: false,
        planeY: planeY,
        origPos: { x: comp.pos.x || 0, y: comp.pos.y || 0, z: comp.pos.z || 0 },
        grabOffsetX: hitWorld ? (comp.pos.x || 0) - hitWorld.x : 0,
        grabOffsetZ: hitWorld ? (comp.pos.z || 0) - hitWorld.z : 0
      };
      canvas.style.cursor = "grabbing";
      return;
    }

    // 3. Click en cable -> seleccionar cable
    var wireHit = hitTestWire(pt.x, pt.y);
    if (wireHit) {
      state.selected = { kind: "wire", id: wireHit.wire.id };
      if (typeof callbacks.onSelect === "function") {
        callbacks.onSelect({ kind: "wire", id: wireHit.wire.id });
      }
      return;
    }

    // 4. Fondo vacío -> deseleccionar y orbitar 3D
    state.selected = null;
    if (typeof callbacks.onSelect === "function") {
      callbacks.onSelect(null);
    }
    camera.anim = null;
    state.drag = {
      mode: "orbit",
      startX: pt.x,
      startY: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      moved: false
    };
  }

  function onMouseMove(e) {
    if (!canvas) return;
    var pt = getLocalCoords(e);
    state.mouseCanvas = { x: pt.x, y: pt.y, inside: true };
    state.mouseClient = { x: e.clientX, y: e.clientY };

    if (!state.drag) {
      updateHoverState(pt.x, pt.y, e.clientX, e.clientY);
      return;
    }

    var dx = pt.x - state.drag.lastX;
    var dy = pt.y - state.drag.lastY;

    if (state.drag.mode === "orbit") {
      if (Math.hypot(pt.x - state.drag.startX, pt.y - state.drag.startY) > 2) {
        state.drag.moved = true;
      }
      camera.yaw -= dx * 0.0075;
      camera.pitch = clamp(camera.pitch + dy * 0.0075, 0.08, Math.PI * 0.5 - 0.01);
      state.drag.lastX = pt.x;
      state.drag.lastY = pt.y;
      canvas.style.cursor = "grabbing";
      return;
    }

    if (state.drag.mode === "pan") {
      var basisPan = getCameraBasis();
      var panSpeed = camera.dist * 0.00145;
      var fwdFlat = vecNorm({ x: basisPan.forward.x, y: 0, z: basisPan.forward.z });
      camera.target.x -= basisPan.right.x * dx * panSpeed - fwdFlat.x * dy * panSpeed;
      camera.target.z -= basisPan.right.z * dx * panSpeed - fwdFlat.z * dy * panSpeed;
      camera.target.x = clamp(camera.target.x, -220, 220);
      camera.target.z = clamp(camera.target.z, -220, 220);
      state.drag.lastX = pt.x;
      state.drag.lastY = pt.y;
      return;
    }

    if (state.drag.mode === "comp") {
      if (!state.drag.moved && Math.hypot(pt.x - state.drag.startX, pt.y - state.drag.startY) <= 4) {
        return;
      }
      state.drag.moved = true;
      var basisComp = getCameraBasis();
      var comp = state.drag.comp;
      var newPos = snapDraggedComponentPos(basisComp, pt.x, pt.y, state.drag, e.altKey);
      if (!newPos) return;

      comp.pos.x = newPos.x;
      comp.pos.y = newPos.y;
      comp.pos.z = newPos.z;
      if (typeof callbacks.onMoveComponent === "function") {
        callbacks.onMoveComponent(comp.id, newPos);
      }
    }
  }

  function onMouseUp() {
    if (!state.drag) return;
    var drag = state.drag;
    state.drag = null;

    if (drag.mode === "comp" && !drag.moved && drag.comp && drag.comp.type === "pushbutton") {
      var curPressed = !!((drag.comp.props && drag.comp.props.pressed) || (drag.comp.state && drag.comp.state.pressed));
      var nextPressed = !curPressed;
      if (NS.Simulator && typeof NS.Simulator.updateComponentProps === "function") {
        NS.Simulator.updateComponentProps(drag.comp.id, { pressed: nextPressed });
      }
    }

    if (state.mouseCanvas.inside) {
      updateHoverState(state.mouseCanvas.x, state.mouseCanvas.y, state.mouseClient.x, state.mouseClient.y);
    } else if (canvas) {
      canvas.style.cursor = "default";
    }
  }

  function onMouseLeave() {
    state.mouseCanvas.inside = false;
    if (state.hoveredPin) {
      state.hoveredPin = null;
      if (typeof callbacks.onHoverPin === "function") {
        callbacks.onHoverPin(null);
      }
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    if (!canvas) return;
    var pt = getLocalCoords(e);
    var hit = hitTestRightClickItem(pt.x, pt.y);
    if (!hit) return;

    state.selected = { kind: hit.kind, id: hit.item.id };
    if (typeof callbacks.onRightClick === "function") {
      callbacks.onRightClick({
        kind: hit.kind,
        item: hit.item,
        screenX: e.clientX,
        screenY: e.clientY
      });
    }
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoom(factor);
  }

  function attachEvents() {
    if (!canvas || state.listenersAttached) return;
    state.listenersAttached = true;

    canvas.addEventListener("mousedown", onMouseDown);
    global.addEventListener("mousemove", onMouseMove);
    global.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    if (typeof global.ResizeObserver === "function" && canvas.parentElement) {
      state.resizeObserver = new global.ResizeObserver(function () {
        resize();
      });
      state.resizeObserver.observe(canvas.parentElement);
    }
  }

  // =========================================================================
  // API pública de Scene3D
  // =========================================================================

  function init(canvasEl, cbs) {
    canvas = canvasEl;
    ctx = canvas ? canvas.getContext("2d") : null;
    callbacks = cbs || {};
    resize();
    attachEvents();
  }

  function resize() {
    if (!canvas) return;
    var rect = canvas.parentElement
      ? canvas.parentElement.getBoundingClientRect()
      : canvas.getBoundingClientRect();
    var w = Math.max(100, Math.floor(rect.width || canvas.clientWidth || 960));
    var h = Math.max(100, Math.floor(rect.height || canvas.clientHeight || 600));
    dpr = clamp(global.devicePixelRatio || 1, 1, 2);
    viewW = w;
    viewH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function computeComponentsFrame() {
    var comps = (state.lastSimState && state.lastSimState.components) || [];
    if (!comps.length) {
      return { cx: 0, cz: 0, dist: 305 };
    }
    var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i];
      var b = getComponentBounds(c.type);
      var p = c.pos || { x: 0, y: 0, z: 0 };
      minX = Math.min(minX, p.x + b.minX);
      maxX = Math.max(maxX, p.x + b.maxX);
      minZ = Math.min(minZ, p.z + b.minZ);
      maxZ = Math.max(maxZ, p.z + b.maxZ);
    }
    var span = Math.max(maxX - minX, maxZ - minZ, 120);
    return {
      cx: (minX + maxX) * 0.5,
      cz: (minZ + maxZ) * 0.5,
      dist: clamp(span * 1.12, 220, 480)
    };
  }

  function setView(preset) {
    var frame = computeComponentsFrame();
    if (preset === "top") {
      camera.anim = {
        yaw: 0.0,
        pitch: Math.PI * 0.5 - 0.015,
        dist: Math.max(280, frame.dist * 1.05),
        target: { x: frame.cx, y: 2, z: frame.cz }
      };
    } else if (preset === "center") {
      camera.anim = {
        yaw: camera.yaw,
        pitch: camera.pitch,
        dist: frame.dist,
        target: { x: frame.cx, y: 4, z: frame.cz }
      };
    } else {
      // "iso" o cualquier otro preset por defecto
      camera.anim = {
        yaw: 0.28,
        pitch: 0.66,
        dist: frame.dist,
        target: { x: frame.cx, y: 4, z: frame.cz }
      };
    }
  }

  function zoom(factor) {
    var f = Number(factor);
    if (!isFinite(f) || f <= 0) return;
    var baseDist = camera.anim ? camera.anim.dist : camera.dist;
    var nextDist = clamp(baseDist / f, 75, 760);
    if (camera.anim) {
      camera.anim.dist = nextDist;
    } else {
      camera.dist = nextDist;
    }
  }

  function setWireModeColor(hex) {
    if (hex) state.wireColor = hex;
  }

  function getPendingWireStart() {
    if (!state.pendingWireStart) return null;
    return {
      compId: state.pendingWireStart.compId,
      pinId: state.pendingWireStart.pinId
    };
  }

  function cancelWire() {
    state.pendingWireStart = null;
  }

  function triggerUploadEffect() {
    state.uploadFlashMs = 1400;
  }

  function setSelected(kind, id) {
    if (!kind || !id) {
      state.selected = null;
      return;
    }
    state.selected = { kind: kind, id: id };
  }

  NS.Scene3D = {
    init: init,
    render: render,
    setView: setView,
    zoom: zoom,
    setWireModeColor: setWireModeColor,
    getPendingWireStart: getPendingWireStart,
    cancelWire: cancelWire,
    getWorldPinPosition: getWorldPinPosition,
    triggerUploadEffect: triggerUploadEffect,
    resize: resize,
    setSelected: setSelected
  };
})(window);
