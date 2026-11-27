// The house: one L-shaped hallway you will walk again and again.
// Built from primitives with painted canvas textures and public-domain photographs in the frames.
// Everything that can change between laps is exposed on the returned object.

import * as THREE from '../../vendor/three/three.module.js';
import { drawWallpaper, drawWood, paint } from '../../js/underside/crt-room.js';

const W = 0.9; // half width of the corridor
const H = 2.6; // ceiling height
const LEG_X = 4.0; // end of the short leg (final door)
const END_Z = -10.5; // far wall
const TURN_Z = -8.7; // where the short leg begins

export const PHOTO_FILES = [
  ['../assets/underside/found/hope-couple-spirit.jpg', 'left', -1.3],
  ['../assets/underside/found/mumler-french.jpg', 'right', -1.9],
  ['../assets/underside/found/hidden-mother-1.jpg', 'left', -4.6],
  ['../assets/underside/found/dore-inferno.jpg', 'right', -6.3], // the host
  ['../assets/underside/found/bocklin-death.jpg', 'left', -7.6],
  ['../assets/underside/found/mumler-dow.jpg', 'right', -7.6]
];
export const HOST_PHOTO = 3;

export function createHouse() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020101);
  scene.fog = new THREE.FogExp2(0x050303, 0.09);
  const disposables = [];
  const keep = (x) => {
    disposables.push(x);
    return x;
  };
  const std = (o) => keep(new THREE.MeshStandardMaterial(o));
  const boxMesh = (w, h, d, m) => new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m);
  const interactives = [];

  // ---------- surfaces ----------
  const wallpaper = keep(paint(512, 512, drawWallpaper, [3, 1]));
  const wood = keep(paint(512, 256, drawWood, [2, 8]));
  wood.rotation = Math.PI / 2;
  const plaster = keep(paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a524c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    for (let i = 0; i < 5; i += 1) {
      const g = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 60);
      g.addColorStop(0, 'rgba(60,40,20,0.35)'); // water stains
      g.addColorStop(1, 'rgba(60,40,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }, [4, 4]));
  const wallMat = std({ map: wallpaper, color: 0xb09088, roughness: 0.95 });
  const floorMat = std({ map: wood, color: 0x8a6650, roughness: 0.55 });
  const ceilMat = std({ map: plaster, color: 0x9a9088, roughness: 1 });
  const trimMat = std({ color: 0x2a1a10, roughness: 0.5 });
  const panelMat = std({ color: 0x3a2618, roughness: 0.6 });

  const plane = (w, h, mat, pos, rot) => {
    const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  // floor and ceiling over the whole L
  const fw = LEG_X + W;
  const fd = 1 - END_Z;
  plane(fw, fd, floorMat, [(LEG_X - W) / 2, 0, (1 + END_Z) / 2], [-Math.PI / 2, 0, 0]);
  plane(fw, fd, ceilMat, [(LEG_X - W) / 2, H, (1 + END_Z) / 2], [Math.PI / 2, 0, 0]);
  // walls
  const wall = (len, pos, rotY) => {
    const m = plane(len, H, wallMat, [pos[0], H / 2, pos[1]], [0, rotY, 0]);
    // wainscot: dark panel band with a rail, and a skirting board
    const wain = new THREE.Mesh(keep(new THREE.PlaneGeometry(len, 0.95)), panelMat);
    wain.position.copy(m.position);
    wain.position.y = 0.475;
    wain.rotation.copy(m.rotation);
    wain.translateZ(0.004);
    scene.add(wain);
    const rail = new THREE.Mesh(keep(new THREE.BoxGeometry(len, 0.05, 0.03)), trimMat);
    rail.position.copy(m.position);
    rail.position.y = 0.97;
    rail.rotation.copy(m.rotation);
    rail.translateZ(0.015);
    scene.add(rail);
    return m;
  };
  wall(1 - END_Z, [-W, (1 + END_Z) / 2], Math.PI / 2); // left
  wall(1 - TURN_Z, [W, (1 + TURN_Z) / 2], -Math.PI / 2); // right, up to the turn
  wall(LEG_X + W, [(LEG_X - W) / 2, END_Z], 0); // far wall
  wall(LEG_X - W, [(LEG_X + W) / 2, TURN_Z], Math.PI); // inside wall of the short leg
  wall(2 * W, [0, 1], Math.PI); // behind you
  wall(-TURN_Z + END_Z + 3.6, [LEG_X, (TURN_Z + END_Z) / 2], -Math.PI / 2); // end of the leg

  // ---------- doors ----------
  function door({ x, z, rotY, id = null, label = '' }) {
    const frame = new THREE.Group();
    frame.position.set(x, 0, z);
    frame.rotation.y = rotY;
    const casing = boxMesh(1.0, 2.15, 0.06, trimMat);
    casing.position.set(0, 1.075, 0);
    const dark = boxMesh(0.86, 2.06, 0.02, std({ color: 0x000000 }));
    dark.position.set(0, 1.03, 0.02);
    const hinge = new THREE.Group();
    hinge.position.set(-0.43, 0, 0.04);
    const leaf = boxMesh(0.86, 2.04, 0.045, std({ color: 0x4a3222, roughness: 0.55 }));
    leaf.position.set(0.43, 1.02, 0);
    leaf.castShadow = true;
    // raised panels
    [[0.55, 0.62], [0.55, 1.45]].forEach(([w, y]) => {
      const p = boxMesh(w, 0.62, 0.02, std({ color: 0x3e2a1c, roughness: 0.5 }));
      p.position.set(0.43, y, 0.03);
      hinge.add(p);
    });
    const knob = new THREE.Mesh(keep(new THREE.SphereGeometry(0.03, 12, 8)), std({ color: 0xb08a40, metalness: 0.9, roughness: 0.3 }));
    knob.position.set(0.78, 1.0, 0.05);
    hinge.add(leaf, knob);
    frame.add(casing, dark, hinge);
    scene.add(frame);
    if (id) {
      leaf.userData = { id, label };
      interactives.push(leaf);
    }
    return { frame, hinge, leaf, open: (a) => (hinge.rotation.y = -a), worldPos: () => frame.getWorldPosition(new THREE.Vector3()) };
  }
  const doors = {
    left1: door({ x: -W + 0.005, z: -2.6, rotY: Math.PI / 2, id: 'hide', label: 'Hide' }),
    right1: door({ x: W - 0.005, z: -4.6, rotY: -Math.PI / 2, id: 'nursery', label: 'Open' }),
    left2: door({ x: -W + 0.005, z: -6.2, rotY: Math.PI / 2, id: 'hide', label: 'Hide' }),
    entrance: door({ x: 0, z: 0.995, rotY: Math.PI }),
    final: door({ x: LEG_X - 0.005, z: (TURN_Z + END_Z) / 2, rotY: -Math.PI / 2, id: 'final', label: 'Open' })
  };
  // Light leaking under the final door
  const leak = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.86, 0.04)), keep(new THREE.MeshBasicMaterial({ color: 0xffd9a0 })));
  leak.position.set(LEG_X - 0.03, 0.02, (TURN_Z + END_Z) / 2);
  leak.rotation.y = -Math.PI / 2;
  scene.add(leak);

  // ---------- photographs in heavy frames ----------
  const loader = new THREE.TextureLoader();
  const frames = PHOTO_FILES.map(([src, side, z], i) => {
    const tex = keep(loader.load(src));
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const x = side === 'left' ? -W + 0.03 : W - 0.03;
    g.position.set(x, 1.6 + (i % 2 ? 0.08 : -0.05), z);
    g.rotation.y = side === 'left' ? Math.PI / 2 : -Math.PI / 2;
    g.rotation.z = (i % 3 - 1) * 0.04; // never quite straight
    const w = 0.5;
    const h = 0.66;
    const back = boxMesh(w + 0.12, h + 0.12, 0.04, std({ color: 0x4a3418, metalness: 0.6, roughness: 0.35 }));
    const photoMat = std({ map: tex, color: 0xa8a092, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 });
    const photo = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, h)), photoMat);
    photo.position.z = 0.025;
    photo.userData = { id: 'photo', index: i, label: 'Look closer' };
    interactives.push(photo);
    g.add(back, photo);
    scene.add(g);
    return { group: g, photo, photoMat, tex, src };
  });

  // ---------- side table, radio, telephone ----------
  const table = new THREE.Group();
  table.position.set(W - 0.28, 0, -3.1);
  const top = boxMesh(0.42, 0.04, 0.8, std({ color: 0x3a2414, roughness: 0.45 }));
  top.position.y = 0.82;
  top.castShadow = true;
  table.add(top);
  [[-0.17, -0.35], [0.17, -0.35], [-0.17, 0.35], [0.17, 0.35]].forEach(([x, z]) => {
    const leg = boxMesh(0.035, 0.8, 0.035, std({ color: 0x2a1a0e }));
    leg.position.set(x, 0.4, z);
    table.add(leg);
  });
  scene.add(table);
  // Radio: wood case, cloth grille, glowing dial
  const radio = new THREE.Group();
  radio.position.set(W - 0.3, 0.84, -3.3);
  radio.rotation.y = -Math.PI / 2;
  const caseMesh = boxMesh(0.34, 0.2, 0.14, std({ color: 0x5a3a22, roughness: 0.4 }));
  caseMesh.position.y = 0.1;
  const grille = boxMesh(0.18, 0.13, 0.005, std({ color: 0x2a2218, roughness: 1 }));
  grille.position.set(-0.06, 0.1, 0.071);
  const dialMat = std({ color: 0x664422, emissive: 0xffa040, emissiveIntensity: 0 });
  const dial = boxMesh(0.1, 0.05, 0.005, dialMat);
  dial.position.set(0.1, 0.12, 0.071);
  radio.add(caseMesh, grille, dial);
  caseMesh.userData = { id: 'radio', label: 'Turn it off' };
  interactives.push(caseMesh);
  scene.add(radio);
  // Telephone: black base and handset
  const phone = new THREE.Group();
  phone.position.set(W - 0.28, 0.84, -2.85);
  const base = boxMesh(0.16, 0.07, 0.2, std({ color: 0x0c0c0c, roughness: 0.25 }));
  base.position.y = 0.035;
  const handset = new THREE.Group();
  handset.position.y = 0.085;
  const grip = boxMesh(0.05, 0.03, 0.22, std({ color: 0x0c0c0c, roughness: 0.25 }));
  const ear1 = boxMesh(0.07, 0.04, 0.05, std({ color: 0x0c0c0c, roughness: 0.25 }));
  ear1.position.set(0, -0.01, 0.1);
  const ear2 = ear1.clone();
  ear2.position.z = -0.1;
  handset.add(grip, ear1, ear2);
  phone.add(base, handset);
  base.userData = { id: 'phone', label: 'Answer' };
  grip.userData = { id: 'phone', label: 'Answer' };
  interactives.push(base, grip);
  scene.add(phone);

  // ---------- light ----------
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0, H, -4.2);
  const cord = boxMesh(0.01, 0.55, 0.01, std({ color: 0x111111 }));
  cord.position.y = -0.27;
  const shade = new THREE.Mesh(keep(new THREE.ConeGeometry(0.22, 0.2, 18, 1, true)), std({ color: 0xd8c8a8, side: THREE.DoubleSide, emissive: 0x8a5a20, emissiveIntensity: 0.4 }));
  shade.position.y = -0.62;
  const bulbMat = keep(new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  const bulb = new THREE.Mesh(keep(new THREE.SphereGeometry(0.05, 10, 8)), bulbMat);
  bulb.position.y = -0.7;
  const lamp = new THREE.PointLight(0xffd8a0, 9, 9, 1.6);
  lamp.position.y = -0.72;
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(512, 512);
  lamp.shadow.bias = -0.003;
  lampGroup.add(cord, shade, bulb, lamp);
  scene.add(lampGroup);
  // A wall sconce at the turn, and a dim fill so the dark isn't flat
  const sconce = new THREE.PointLight(0xffc890, 3, 5, 1.8);
  sconce.position.set(1.8, 2.0, END_Z + 0.2);
  scene.add(sconce);
  const ambient = new THREE.AmbientLight(0x2a1c16, 0.55);
  scene.add(ambient);

  return {
    scene,
    interactives,
    doors,
    frames,
    radio: { group: radio, dialMat },
    phone: { group: phone, handset },
    lamp: { group: lampGroup, light: lamp, bulbMat, base: 9 },
    sconce,
    ambient,
    leak,
    keep,
    std,
    dispose() {
      disposables.forEach((x) => x.dispose?.());
    }
  };
}
