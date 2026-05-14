/* ============================================================
   EROĞLU İNŞAAT — VR / FPS İnterior Walkthrough
   Three.js tabanlı tam 3D daire gezinti sistemi
   ============================================================
   MOD 1 (orbit): Bina dışından döndürerek incele, daireye tıkla
   MOD 2 (fps):   Daire içinde FPS kamera ile oda oda gez
   ============================================================ */
;(function () {
  'use strict';

  if (!window.THREE) {
    console.warn('Three.js bulunamadı, VR turu devre dışı.');
    return;
  }
  const THREE = window.THREE;

  /* ─────────────────────────────────────────
     SABITLER
  ──────────────────────────────────────────*/
  const COLORS = {
    bg:        0x06060c,
    ground:    0x090912,
    gridA:     0x1a2540,
    gridB:     0x0d1520,
    wallLight: 0xf0ead6,
    wallDark:  0xd8d0c0,
    floor:     0xb8a888,
    ceiling:   0xf5f0e8,
    wood:      0x8b6040,
    fabric:    0x5a6680,
    white:     0xffffff,
    glass:     0x88ccff,
    gold:      0xd4a853,
    cyan:      0x00e5ff,
    buildingBase: 0x182030,
  };

  const ROOM_DEFS = [
    {
      id: 'giris',  label: 'Giriş',       w: 3,  d: 4,  x: 0,   z: -3,
      color: 0xe8e0d0, furniture: []
    },
    {
      id: 'salon',  label: 'Salon',        w: 7,  d: 6,  x: -4,  z: 2,
      color: 0xede6d8, furniture: [
        { name: 'Kanepe',      w: 3.5, h: 0.9, d: 1.0, x: -4.5, z: 0.5,  c: 0x4a5570 },
        { name: 'Sehpa',       w: 1.2, h: 0.4, d: 0.7, x: -4.5, z: 2.2,  c: 0x8b7040 },
        { name: 'TV Ünitesi',  w: 2.2, h: 0.6, d: 0.4, x: -4.5, z: 4.5,  c: 0x2a2020 },
        { name: 'Sandalye',    w: 0.8, h: 0.9, d: 0.8, x: -1.5, z: 0.8,  c: 0x445566 },
      ]
    },
    {
      id: 'mutfak', label: 'Mutfak',       w: 4,  d: 4,  x: 3,   z: 2,
      color: 0xf0ece0, furniture: [
        { name: 'Tezgah',      w: 3.5, h: 0.9, d: 0.6, x: 3.0,  z: 0.5,  c: 0xddd0b0 },
        { name: 'Masa',        w: 1.4, h: 0.75,d: 1.0, x: 3.5,  z: 3.0,  c: 0x7a6040 },
        { name: 'Sandalye',    w: 0.5, h: 0.8, d: 0.5, x: 2.6,  z: 3.0,  c: 0x555555 },
        { name: 'Sandalye',    w: 0.5, h: 0.8, d: 0.5, x: 4.4,  z: 3.0,  c: 0x555555 },
      ]
    },
    {
      id: 'yatak1', label: 'Yatak Odası',  w: 5,  d: 5,  x: -4,  z: -4,
      color: 0xe6e0f0, furniture: [
        { name: 'Karyola',     w: 2.0, h: 0.5, d: 2.2, x: -4.5, z: -5.5, c: 0x6a5040 },
        { name: 'Dolap',       w: 2.5, h: 2.2, d: 0.6, x: -2.0, z: -6.5, c: 0xc8c0b0 },
        { name: 'Komodin',     w: 0.6, h: 0.55,d: 0.5, x: -3.2, z: -5.5, c: 0x9a8060 },
      ]
    },
    {
      id: 'banyo',  label: 'Banyo',        w: 3,  d: 3,  x: 3.5, z: -3.5,
      color: 0xddeeff, furniture: [
        { name: 'Lavabo',      w: 0.7, h: 0.9, d: 0.5, x: 4.5,  z: -4.5, c: 0xffffff },
        { name: 'Duş',         w: 1.2, h: 2.1, d: 1.2, x: 2.8,  z: -4.5, c: 0xaaccee },
      ]
    },
    {
      id: 'balkon', label: 'Balkon',       w: 6,  d: 2,  x: -4,  z: 6.5,
      color: 0xd8e8f0, furniture: [
        { name: 'Masa',        w: 0.9, h: 0.75,d: 0.9, x: -4.0, z: 6.5,  c: 0x7a6040 },
        { name: 'Sandalye',    w: 0.5, h: 0.8, d: 0.5, x: -3.0, z: 6.5,  c: 0x445566 },
        { name: 'Saksı',       w: 0.4, h: 0.6, d: 0.4, x: -6.5, z: 7.0,  c: 0x558844 },
      ]
    },
  ];

  // Doorways between rooms [roomA, roomB, position_x, position_z, axis ('x'|'z')]
  const DOORS = [
    { a: 'giris',  b: 'salon',  x: -1.5, z: -0.5, axis: 'z' },
    { a: 'giris',  b: 'banyo',  x:  2.0, z: -2.5, axis: 'x' },
    { a: 'salon',  b: 'mutfak', x:  1.0, z:  2.0, axis: 'x' },
    { a: 'salon',  b: 'yatak1', x: -3.5, z: -1.5, axis: 'z' },
    { a: 'salon',  b: 'balkon', x: -3.5, z:  5.5, axis: 'z' },
  ];

  const WALL_H   = 2.8;
  const DOOR_W   = 1.0;
  const DOOR_H   = 2.2;
  const MOVE_SPD = 4.5;   // m/s
  const ROT_SPD  = 0.002;

  /* ─────────────────────────────────────────
     STATE
  ──────────────────────────────────────────*/
  let mode       = 'orbit';   // 'orbit' | 'fps'
  let renderer, scene, camera;
  let orbitTarget = new THREE.Vector3(0, 16, 0);
  let sph        = { theta: -0.4, phi: 1.15, radius: 68 };
  let isDragging = false;
  let lastMouse  = { x: 0, y: 0 };
  let autoRotate = true;
  let autoTimer  = null;
  let aptMeshes  = [];
  let hoveredApt = null;

  // FPS
  let yaw   = 0;
  let pitch = 0;
  let keys  = {};
  let isPointerLocked = false;
  let fpsClock;
  let fpsColliders = [];  // wall AABBs for collision
  let fpsPos = new THREE.Vector3(-1, 1.65, 0);

  /* ─────────────────────────────────────────
     ENTRY
  ──────────────────────────────────────────*/
  const section = document.getElementById('vr-tour');
  if (!section) return;

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { initScene(); }
  }, { threshold: 0.1 }).observe(section);

  /* ─────────────────────────────────────────
     SCENE INIT
  ──────────────────────────────────────────*/
  function initScene() {
    if (renderer) return;

    const container = document.getElementById('vrCanvasWrapper');
    const canvas    = document.getElementById('vrCanvas');
    const W = () => container.clientWidth;
    const H = () => Math.min(Math.round(W() * 0.58), 640);

    /* Renderer */
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    buildOrbitScene();
    startRenderLoop();

    window.addEventListener('resize', () => {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
    });

    /* Raycaster (orbit mode) */
    const raycaster = new THREE.Raycaster();
    const m2d = new THREE.Vector2();

    canvas.addEventListener('click', e => {
      if (mode !== 'orbit') return;
      const r = canvas.getBoundingClientRect();
      m2d.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      m2d.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
      raycaster.setFromCamera(m2d, camera);
      const hits = raycaster.intersectObjects(aptMeshes);
      if (hits.length > 0) enterFPS(hits[0].object.userData);
    });

    canvas.addEventListener('mousemove', e => {
      if (mode === 'orbit' && !isDragging) {
        const r = canvas.getBoundingClientRect();
        m2d.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        m2d.y = -((e.clientY - r.top)  / r.height) * 2 + 1;
        raycaster.setFromCamera(m2d, camera);
        const hits = raycaster.intersectObjects(aptMeshes);
        if (hoveredApt && hoveredApt !== hits[0]?.object) {
          hoveredApt.material.color.copy(hoveredApt.userData.defaultColor);
          hoveredApt.material.emissive.set(0);
          hoveredApt = null;
          canvas.style.cursor = 'grab';
          updateTooltip(null, 0, 0);
        }
        if (hits.length > 0) {
          hoveredApt = hits[0].object;
          hoveredApt.material.color.set(0xd4a853);
          hoveredApt.material.emissive.setHex(0x2a1500);
          canvas.style.cursor = 'pointer';
          updateTooltip(
            `Kat ${hoveredApt.userData.floor} — Daire ${hoveredApt.userData.apt}`,
            e.clientX - r.left, e.clientY - r.top
          );
        }
      }
    });

    /* Orbit drag */
    canvas.addEventListener('mousedown', e => {
      if (mode !== 'orbit') return;
      isDragging = true; autoRotate = false; clearTimeout(autoTimer);
      lastMouse = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (mode !== 'orbit' || !isDragging) return;
      sph.theta -= (e.clientX - lastMouse.x) * 0.007;
      sph.phi = Math.max(0.18, Math.min(1.35, sph.phi + (e.clientY - lastMouse.y) * 0.005));
      lastMouse = { x: e.clientX, y: e.clientY };
      updateOrbitCamera();
    });
    window.addEventListener('mouseup', () => {
      if (mode !== 'orbit' || !isDragging) return;
      isDragging = false; canvas.style.cursor = 'grab';
      autoTimer = setTimeout(() => { autoRotate = true; }, 3500);
    });
    canvas.addEventListener('wheel', e => {
      if (mode !== 'orbit') return;
      e.preventDefault();
      sph.radius = Math.max(28, Math.min(110, sph.radius + e.deltaY * 0.06));
      updateOrbitCamera(); autoRotate = false;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => { autoRotate = true; }, 2000);
    }, { passive: false });

    /* Touch orbit */
    let lastTD = 0;
    canvas.addEventListener('touchstart', e => {
      if (mode !== 'orbit') return;
      e.preventDefault(); autoRotate = false; clearTimeout(autoTimer);
      if (e.touches.length === 1) { isDragging = true; lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
      else if (e.touches.length === 2) lastTD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      if (mode !== 'orbit') return;
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        sph.theta -= (e.touches[0].clientX - lastMouse.x) * 0.009;
        sph.phi = Math.max(0.18, Math.min(1.35, sph.phi + (e.touches[0].clientY - lastMouse.y) * 0.007));
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        updateOrbitCamera();
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        sph.radius = Math.max(28, Math.min(110, sph.radius - (d - lastTD) * 0.12));
        lastTD = d; updateOrbitCamera();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
      isDragging = false;
      autoTimer = setTimeout(() => { autoRotate = true; }, 3500);
    });

    /* PointerLock for FPS */
    canvas.addEventListener('click', () => {
      if (mode === 'fps' && !isPointerLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === canvas;
      updateHUD();
    });
    document.addEventListener('mousemove', e => {
      if (mode !== 'fps' || !isPointerLocked) return;
      yaw   -= e.movementX * ROT_SPD;
      pitch  = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, pitch - e.movementY * ROT_SPD));
    });

    /* Keys */
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Escape' && mode === 'fps') exitFPS();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    fpsClock = new THREE.Clock();

    canvas.style.cursor = 'grab';
  }

  /* ─────────────────────────────────────────
     ORBIT SCENE — 3D Bina Dışı
  ──────────────────────────────────────────*/
  function buildOrbitScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.bg);
    scene.fog = new THREE.FogExp2(0x060610, 0.006);

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
    updateOrbitCamera();

    /* Lights */
    scene.add(new THREE.AmbientLight(0x1a2540, 3.0));
    const sun = new THREE.DirectionalLight(0xaabbd0, 4.0);
    sun.position.set(35, 70, 25); sun.castShadow = true;
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top  = 90;  sun.shadow.camera.bottom = -10;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.001;
    scene.add(sun);
    const gold = new THREE.PointLight(0xd4a853, 6, 80);
    gold.position.set(-18, 28, 18); scene.add(gold);
    const cyan = new THREE.PointLight(0x00e5ff, 4, 70);
    cyan.position.set(18, 6, 28); scene.add(cyan);

    /* Ground */
    const gGeo = new THREE.PlaneGeometry(300, 300);
    const gMat = new THREE.MeshPhongMaterial({ color: COLORS.ground });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    gMesh.rotation.x = -Math.PI / 2; gMesh.receiveShadow = true;
    scene.add(gMesh);
    scene.add(new THREE.GridHelper(200, 40, COLORS.gridA, COLORS.gridB));

    /* Building */
    const FLOORS = 10, FH = 3.4, GAP = 0.12, BW = 16, BD = 11;
    const AW = BW / 2, AD = BD / 2, AGAP = 0.1;
    aptMeshes = [];

    function floorColor(f) {
      const t = f / (FLOORS - 1);
      return new THREE.Color(0.08 + t * 0.06, 0.11 + t * 0.08, 0.22 + t * 0.12);
    }

    for (let f = 0; f < FLOORS; f++) {
      const y0 = f * (FH + GAP);
      /* slab */
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(BW + 0.3, GAP, BD + 0.3),
        new THREE.MeshPhongMaterial({ color: 0x080c18 })
      );
      slab.position.set(0, y0, 0); scene.add(slab);

      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const cx = (col - 0.5) * AW, cz = (row - 0.5) * AD, cy = y0 + GAP / 2 + FH / 2;
          const mat = new THREE.MeshPhongMaterial({ color: floorColor(f), shininess: 55, specular: new THREE.Color(0x223355) });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(AW - AGAP, FH, AD - AGAP), mat);
          mesh.position.set(cx, cy, cz); mesh.castShadow = true; mesh.receiveShadow = true;
          mesh.userData = { isApt: true, floor: f + 1, apt: ['A','B','C','D'][col + row * 2], defaultColor: floorColor(f).clone() };
          scene.add(mesh); aptMeshes.push(mesh);

          /* windows */
          addWindowsToApt(cx, cy, cz, AW - AGAP, FH, AD - AGAP, f);
        }
      }
    }
    /* top slab */
    const topY = FLOORS * (FH + GAP);
    scene.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(BW + 0.4, 0.22, BD + 0.4), new THREE.MeshPhongMaterial({ color: 0x070a16 })), { position: new THREE.Vector3(0, topY, 0) }));
    /* penthouse */
    const ph = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 6), new THREE.MeshPhongMaterial({ color: 0x0e1428 }));
    ph.position.set(-1, topY + 1.85, 0); ph.castShadow = true; scene.add(ph);
    /* core */
    const core = new THREE.Mesh(new THREE.BoxGeometry(2.5, topY + 5, 2.5), new THREE.MeshPhongMaterial({ color: 0x0b0e20 }));
    core.position.set(0, (topY + 5) / 2, 0); scene.add(core);
    /* antenna */
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), new THREE.MeshPhongMaterial({ color: 0x334466 }));
    ant.position.set(0, topY + 8.5, 0); scene.add(ant);
  }

  function addWindowsToApt(cx, cy, cz, w, h, d, floor) {
    const lit = Math.random() > 0.35;
    const winMat = new THREE.MeshPhongMaterial({
      color: lit ? 0x001833 : 0x000c1a,
      emissive: lit ? new THREE.Color(1, 0.82, 0.3).multiplyScalar(0.2) : new THREE.Color(0, 0, 0),
      shininess: 200, transparent: true, opacity: 0.85
    });
    const geo = new THREE.PlaneGeometry(w * 0.52, h * 0.55);
    [1, -1].forEach(s => {
      const m = new THREE.Mesh(geo, winMat.clone());
      m.position.set(cx, cy, cz + s * (d / 2 + 0.01));
      if (s === -1) m.rotation.y = Math.PI;
      scene.add(m);
    });
  }

  function updateOrbitCamera() {
    if (!camera) return;
    camera.position.set(
      orbitTarget.x + sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta),
      orbitTarget.y + sph.radius * Math.cos(sph.phi),
      orbitTarget.z + sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta)
    );
    camera.lookAt(orbitTarget);
  }

  /* ─────────────────────────────────────────
     FPS SCENE — Daire İçi
  ──────────────────────────────────────────*/
  function enterFPS(aptData) {
    mode = 'fps';
    autoRotate = false;
    fpsPos.set(-1, 1.65, 0);
    yaw = 0; pitch = 0;

    /* Rebuild scene for interior */
    scene.children.length = 0;  // clear
    fpsColliders = [];

    /* Fog */
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 12, 35);

    /* Interior lights */
    scene.add(new THREE.AmbientLight(0xfff5e0, 1.2));

    ROOM_DEFS.forEach(room => {
      /* Ceiling light per room */
      const pl = new THREE.PointLight(0xfff2d0, 2.0, room.w * 2.0);
      pl.position.set(room.x, WALL_H - 0.2, room.z);
      pl.castShadow = false;
      scene.add(pl);

      /* Soft fill */
      const fill = new THREE.PointLight(0xfff5e0, 0.5, room.w * 1.5);
      fill.position.set(room.x, 0.5, room.z);
      scene.add(fill);
    });

    /* Build all rooms */
    ROOM_DEFS.forEach(room => buildRoom(room));
    DOORS.forEach(door => buildDoorway(door));

    /* Floor plan connector strips */
    buildFloorConnectors();

    /* Camera */
    camera = new THREE.PerspectiveCamera(75, 1, 0.05, 60);
    camera.position.copy(fpsPos);

    /* HUD update */
    updateModeUI(aptData);

    /* Request pointer lock */
    const canvas = document.getElementById('vrCanvas');
    canvas.requestPointerLock();
    canvas.style.cursor = 'none';
  }

  function buildRoom(room) {
    const { w, d, x: rx, z: rz, color } = room;
    const hw = w / 2, hd = d / 2;
    const matWall    = new THREE.MeshLambertMaterial({ color: COLORS.wallLight });
    const matWallAlt = new THREE.MeshLambertMaterial({ color: COLORS.wallDark });
    const matFloor   = new THREE.MeshLambertMaterial({ color: color });
    const matCeil    = new THREE.MeshLambertMaterial({ color: COLORS.ceiling });

    /* Floor */
    addBox(w, 0.04, d, rx, 0.02, rz, matFloor);

    /* Ceiling */
    addBox(w, 0.04, d, rx, WALL_H + 0.02, rz, matCeil);

    /* Walls — each wall as a solid box; doorways cut by not rendering portions */
    // North wall (z = rz - hd)
    const nw = addBox(w, WALL_H, 0.12, rx, WALL_H / 2, rz - hd - 0.06, matWall);
    addCollider(nw);
    // South wall (z = rz + hd)
    const sw = addBox(w, WALL_H, 0.12, rx, WALL_H / 2, rz + hd + 0.06, matWallAlt);
    addCollider(sw);
    // West wall (x = rx - hw)
    const ww = addBox(0.12, WALL_H, d, rx - hw - 0.06, WALL_H / 2, rz, matWall);
    addCollider(ww);
    // East wall (x = rx + hw)
    const ew = addBox(0.12, WALL_H, d, rx + hw + 0.06, WALL_H / 2, rz, matWallAlt);
    addCollider(ew);

    /* Room label on ceiling */
    addRoomLabel(room.label, rx, WALL_H - 0.05, rz);

    /* Furniture */
    room.furniture.forEach(item => {
      const fMat = new THREE.MeshLambertMaterial({ color: item.c });
      const mesh = addBox(item.w, item.h, item.d, item.x, item.h / 2, item.z, fMat);
      addCollider(mesh);
    });

    /* Balkon: railing */
    if (room.id === 'balkon') {
      const railMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.7 });
      addBox(room.w, 1.1, 0.06, rx, 0.55, rz + hd, railMat);
      // Glass panels (decorative)
      const glassMat = new THREE.MeshLambertMaterial({ color: COLORS.glass, transparent: true, opacity: 0.3 });
      addBox(room.w - 0.2, 0.9, 0.03, rx, 0.5, rz + hd - 0.04, glassMat);
    }
  }

  function buildDoorway(door) {
    /* Carve doorway by adding door-arch trim (visual only — walls are solid boxes overlapping) */
    const archMat = new THREE.MeshLambertMaterial({ color: 0xc8bca0 });
    if (door.axis === 'z') {
      /* horizontal doorway (player moves in Z) */
      addBox(DOOR_W, DOOR_H, 0.15, door.x, DOOR_H / 2, door.z, archMat);
    } else {
      addBox(0.15, DOOR_H, DOOR_W, door.x, DOOR_H / 2, door.z, archMat);
    }
  }

  function buildFloorConnectors() {
    /* Thin strip connecting room floors at doorway thresholds */
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.floor });
    DOORS.forEach(d => {
      if (d.axis === 'z') addBox(DOOR_W, 0.05, 0.6, d.x, 0.025, d.z, mat);
      else                addBox(0.6, 0.05, DOOR_W, d.x, 0.025, d.z, mat);
    });
  }

  function addBox(w, h, d, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true; mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function addCollider(mesh) {
    /* Store AABB for wall collision */
    const box = new THREE.Box3().setFromObject(mesh);
    fpsColliders.push(box);
  }

  function addRoomLabel(text, x, y, z) {
    /* Three.js canvas texture label */
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(212,168,83,0.0)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.font = 'bold 28px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#d4a853';
    ctx.textAlign = 'center';
    ctx.fillText(text.toUpperCase(), 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.6), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);
  }

  function exitFPS() {
    if (document.pointerLockElement) document.exitPointerLock();
    isPointerLocked = false;
    mode = 'orbit';
    keys = {};
    buildOrbitScene();
    updateOrbitCamera();
    autoRotate = true;
    const canvas = document.getElementById('vrCanvas');
    canvas.style.cursor = 'grab';
    updateModeUI(null);
  }

  /* ─────────────────────────────────────────
     FPS MOVEMENT
  ──────────────────────────────────────────*/
  const _euler  = new THREE.Euler(0, 0, 0, 'YXZ');
  const _forward = new THREE.Vector3();
  const _right   = new THREE.Vector3();
  const _move    = new THREE.Vector3();
  const _playerBox = new THREE.Box3();

  function updateFPS(dt) {
    if (!isPointerLocked) return;

    _euler.set(pitch, yaw, 0, 'YXZ');
    camera.rotation.copy(_euler);

    const spd = MOVE_SPD * dt * (keys['ShiftLeft'] || keys['ShiftRight'] ? 1.8 : 1);
    _forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _move.set(0, 0, 0);

    if (keys['KeyW'] || keys['ArrowUp'])    _move.addScaledVector(_forward, -spd);
    if (keys['KeyS'] || keys['ArrowDown'])  _move.addScaledVector(_forward,  spd);
    if (keys['KeyA'] || keys['ArrowLeft'])  _move.addScaledVector(_right,   -spd);
    if (keys['KeyD'] || keys['ArrowRight']) _move.addScaledVector(_right,    spd);

    /* Move X then Z separately for sliding collision */
    const newPos = fpsPos.clone();
    const PLAYER_R = 0.3;

    newPos.x += _move.x;
    _playerBox.setFromCenterAndSize(newPos, new THREE.Vector3(PLAYER_R * 2, 1.5, PLAYER_R * 2));
    for (const box of fpsColliders) {
      if (_playerBox.intersectsBox(box)) { newPos.x = fpsPos.x; break; }
    }

    newPos.z += _move.z;
    _playerBox.setFromCenterAndSize(newPos, new THREE.Vector3(PLAYER_R * 2, 1.5, PLAYER_R * 2));
    for (const box of fpsColliders) {
      if (_playerBox.intersectsBox(box)) { newPos.z = fpsPos.z; break; }
    }

    fpsPos.copy(newPos);
    camera.position.copy(fpsPos);

    /* Update room indicator */
    updateRoomIndicator();
  }

  function updateRoomIndicator() {
    const indicator = document.getElementById('vrRoomIndicator');
    if (!indicator) return;
    let closest = null, minD = Infinity;
    ROOM_DEFS.forEach(r => {
      const d = Math.hypot(fpsPos.x - r.x, fpsPos.z - r.z);
      if (d < minD) { minD = d; closest = r; }
    });
    indicator.textContent = closest ? closest.label : '';
  }

  /* ─────────────────────────────────────────
     RENDER LOOP
  ──────────────────────────────────────────*/
  let clock2;
  function startRenderLoop() {
    clock2 = new THREE.Clock();
    const gold = scene.children.find(c => c.isLight && c.color?.r > 0.5 && c.color?.b < 0.1);
    const cyan = scene.children.find(c => c.isLight && c.color?.b > 0.5);

    (function loop() {
      requestAnimationFrame(loop);
      const dt = Math.min(clock2.getDelta(), 0.05);
      const t  = clock2.getElapsedTime();

      if (mode === 'orbit') {
        if (autoRotate) { sph.theta += 0.0025; updateOrbitCamera(); }
        if (gold) gold.position.x = -18 + Math.sin(t * 0.25) * 4;
        if (cyan) cyan.position.z =  28 + Math.sin(t * 0.4)  * 5;
      } else {
        updateFPS(dt);
      }

      renderer.render(scene, camera);
    })();
  }

  /* ─────────────────────────────────────────
     UI HELPERS
  ──────────────────────────────────────────*/
  function updateTooltip(text, px, py) {
    const tip = document.getElementById('vrTooltip');
    if (!tip) return;
    if (text) {
      tip.textContent = text;
      tip.style.display = 'block';
      tip.style.left = (px + 16) + 'px';
      tip.style.top  = (py - 38) + 'px';
    } else {
      tip.style.display = 'none';
    }
  }

  function updateModeUI(aptData) {
    const orbitUI = document.getElementById('vrOrbitUI');
    const fpsUI   = document.getElementById('vrFpsUI');
    const aptInfo = document.getElementById('vrAptInfo');
    if (!orbitUI || !fpsUI) return;

    if (mode === 'fps') {
      orbitUI.style.display = 'none';
      fpsUI.style.display   = 'flex';
      if (aptInfo && aptData) aptInfo.textContent = `Kat ${aptData.floor} — Daire ${aptData.apt}`;
    } else {
      orbitUI.style.display = 'flex';
      fpsUI.style.display   = 'none';
    }
  }

  function updateHUD() {
    const hud = document.getElementById('vrFpsHud');
    if (!hud) return;
    if (isPointerLocked) {
      hud.textContent = 'WASD / Ok Tuşları — Hareket  |  Fare — Bakış  |  ESC — Çık';
      hud.style.opacity = '1';
    } else {
      hud.textContent = 'Fareyi Kilitle — Tıkla';
      hud.style.opacity = '0.7';
    }
  }

  window.exitVRFPS = exitFPS;

})();
