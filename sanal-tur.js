/* ═══════════════════════════════════════════════════════════════
   EROĞLU — 3D Sanal Tur
   Skyline fotoğrafları ile 3D bina + 360° oda panoramaları
   ═══════════════════════════════════════════════════════════════ */
;(function () {
  'use strict';

  const THREE = window.TOUR;
  const { OrbitControls, RoomEnvironment } = window.TOUR;

  if (!THREE) { console.error('Three.js yüklenemedi'); return; }

  /* ─── ODA TANIMLARI ─── */
  const ROOMS = [
    { id: 'salon',  label: 'Salon',        img: 'assets/images/interior_salon.webp'  },
    { id: 'oturma', label: 'Oturma Odası', img: 'assets/images/interior_oturma.webp' },
    { id: 'mutfak', label: 'Mutfak',       img: 'assets/images/interior_mutfak.webp' },
    { id: 'yatak',  label: 'Yatak Odası',  img: 'assets/images/interior_yatak.webp'  },
    { id: 'cocuk',  label: 'Çocuk Odası',  img: 'assets/images/interior_cocuk.webp'  },
    { id: 'banyo',  label: 'Banyo',        img: 'assets/images/interior_banyo.webp'  },
    { id: 'balkon', label: 'Balkon',       img: 'assets/images/interior_balkon.webp' },
  ];

  const SKYLINES = {
    front:  'assets/images/skyline1.webp',
    right:  'assets/images/skyline2.webp',
    back:   'assets/images/skyline3.webp',
    left:   'assets/images/skyline4.webp',
    top:    'assets/images/skyline_top.webp',
    detail1:'assets/images/skyline_detail1.webp',
    detail2:'assets/images/skyline_detail2.webp',
  };

  /* ─── LOADING ─── */
  const loadBar = document.getElementById('loadBar');
  const loadPct = document.getElementById('loadPct');
  const loadScreen = document.getElementById('loadScreen');
  let loaded = 0, totalToLoad = 6; // 4 sides + top + ground

  function tick() {
    loaded++;
    const p = Math.round((loaded / totalToLoad) * 100);
    loadBar.style.width = p + '%';
    loadPct.textContent = p + '%';
    if (loaded >= totalToLoad) setTimeout(() => {
      loadScreen.classList.add('hidden');
      document.getElementById('roomPanel').classList.add('visible');
    }, 400);
  }

  /* ─── RENDERER ─── */
  const canvas = document.getElementById('tourCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* ─── SCENE ─── */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e14);
  scene.fog = new THREE.Fog(0x0a0e14, 80, 200);

  /* ─── CAMERA ─── */
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(35, 25, 40);

  /* ─── ENVIRONMENT (basit, çakışmayı önler) ─── */
  // Environment map yerine daha güçlü ışık kullanıyoruz

  /* ─── LIGHTS ─── */
  scene.add(new THREE.HemisphereLight(0xc0d4ee, 0x303020, 1.5));

  const sun = new THREE.DirectionalLight(0xfff0d0, 3);
  sun.position.set(50, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.near = 0.5; sc.far = 200; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8090c0, 0.4);
  fill.position.set(-40, 20, -40);
  scene.add(fill);

  /* ─── GROUND ─── */
  const groundGeo = new THREE.CircleGeometry(120, 64);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.9, metalness: 0.0 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // Decorative grid
  const grid = new THREE.GridHelper(100, 40, 0xc9a84c, 0x1a1e28);
  grid.material.opacity = 0.12;
  grid.material.transparent = true;
  scene.add(grid);

  /* ─── ORBIT CONTROLS ─── */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 15;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;
  controls.target.set(0, 12, 0);
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  /* ═══════════════════════════════════════
     3D BİNA — SKYLINE FOTOĞRAFLARIYLA
  ═══════════════════════════════════════ */
  const texLoader = new THREE.TextureLoader();

  function loadTex(path) {
    const tex = texLoader.load(path, tick);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  // Bina boyutları (orantılı)
  const BW = 12, BH = 32, BD = 10;

  // ── Ana bina gövdesi (4 yüze skyline fotoğrafları) ──
  // Front face
  const frontGeo = new THREE.PlaneGeometry(BW, BH);
  const frontMat = new THREE.MeshStandardMaterial({
    map: loadTex(SKYLINES.front), roughness: 0.5, metalness: 0.1
  });
  const frontMesh = new THREE.Mesh(frontGeo, frontMat);
  frontMesh.position.set(0, BH / 2, BD / 2);
  frontMesh.castShadow = true;
  buildingGroup.add(frontMesh);

  // Back face
  const backGeo = new THREE.PlaneGeometry(BW, BH);
  const backMat = new THREE.MeshStandardMaterial({
    map: loadTex(SKYLINES.back), roughness: 0.5, metalness: 0.1
  });
  const backMesh = new THREE.Mesh(backGeo, backMat);
  backMesh.position.set(0, BH / 2, -BD / 2);
  backMesh.rotation.y = Math.PI;
  backMesh.castShadow = true;
  buildingGroup.add(backMesh);

  // Right face
  const rightGeo = new THREE.PlaneGeometry(BD, BH);
  const rightMat = new THREE.MeshStandardMaterial({
    map: loadTex(SKYLINES.right), roughness: 0.5, metalness: 0.1
  });
  const rightMesh = new THREE.Mesh(rightGeo, rightMat);
  rightMesh.position.set(BW / 2, BH / 2, 0);
  rightMesh.rotation.y = Math.PI / 2;
  rightMesh.castShadow = true;
  buildingGroup.add(rightMesh);

  // Left face
  const leftGeo = new THREE.PlaneGeometry(BD, BH);
  const leftMat = new THREE.MeshStandardMaterial({
    map: loadTex(SKYLINES.left), roughness: 0.5, metalness: 0.1
  });
  const leftMesh = new THREE.Mesh(leftGeo, leftMat);
  leftMesh.position.set(-BW / 2, BH / 2, 0);
  leftMesh.rotation.y = -Math.PI / 2;
  leftMesh.castShadow = true;
  buildingGroup.add(leftMesh);

  // Top face
  const topGeo = new THREE.PlaneGeometry(BW, BD);
  const topMat = new THREE.MeshStandardMaterial({
    map: loadTex(SKYLINES.top), roughness: 0.4, metalness: 0.1
  });
  const topMesh = new THREE.Mesh(topGeo, topMat);
  topMesh.position.set(0, BH, 0);
  topMesh.rotation.x = -Math.PI / 2;
  buildingGroup.add(topMesh);

  // Balkon katmanları (dekoratif)
  const balkonMat = new THREE.MeshStandardMaterial({ color: 0xe8dfd0, roughness: 0.3, metalness: 0.15 });
  for (let i = 1; i <= 10; i++) {
    const bGeo = new THREE.BoxGeometry(BW + 1.2, 0.15, BD + 1.2);
    const b = new THREE.Mesh(bGeo, balkonMat);
    b.position.y = i * (BH / 10);
    b.castShadow = true;
    b.receiveShadow = true;
    buildingGroup.add(b);
  }
  tick(); // balkonlar hemen yüklendi

  // Bina tabanı / platform
  const baseGeo = new THREE.BoxGeometry(BW + 4, 0.6, BD + 4);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3530, roughness: 0.6, metalness: 0.2 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.3;
  base.castShadow = true;
  base.receiveShadow = true;
  buildingGroup.add(base);

  // Giriş kapısı (cam)
  const doorGeo = new THREE.PlaneGeometry(4, 5);
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x88bbdd, metalness: 0.9, roughness: 0.05,
    transparent: true, opacity: 0.5
  });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 3.1, BD / 2 + 0.02);
  buildingGroup.add(door);

  // Cam korkuluk detayları (her balkon için)
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xaaccee, metalness: 0.8, roughness: 0.1,
    transparent: true, opacity: 0.3
  });
  for (let i = 1; i <= 10; i++) {
    const rGeo = new THREE.PlaneGeometry(BW + 0.8, 1.2);
    const rail = new THREE.Mesh(rGeo, railMat);
    rail.position.set(0, i * (BH / 10) + 0.7, BD / 2 + 0.6);
    buildingGroup.add(rail);
  }

  /* ─── COMPASS ─── */
  const compassNeedle = document.getElementById('compassNeedle');

  /* ─── RENDER LOOP ─── */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // Compass
    const ang = Math.atan2(
      camera.position.x - controls.target.x,
      camera.position.z - controls.target.z
    );
    compassNeedle.style.transform = `rotate(${-ang}rad)`;

    renderer.render(scene, camera);
  }
  animate();

  /* ─── RESIZE ─── */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ══════════════════════════════════════
     İÇ MEKAN 360° PANORAMA
  ══════════════════════════════════════ */
  let intRenderer, intScene, intCamera;
  let intDragging = false, intLastX = 0, intLastY = 0;
  let intYaw = 0, intPitch = 0;
  let intRaf;

  function setupInterior() {
    if (intRenderer) return;
    const c = document.getElementById('interiorCanvas');
    intRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true });
    intRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    intRenderer.setSize(window.innerWidth, window.innerHeight);
    intRenderer.outputColorSpace = THREE.SRGBColorSpace;
    intRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    intRenderer.toneMappingExposure = 1.0;

    intScene = new THREE.Scene();
    intCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

    window.addEventListener('resize', () => {
      if (!intRenderer) return;
      intCamera.aspect = window.innerWidth / window.innerHeight;
      intCamera.updateProjectionMatrix();
      intRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse look
    const cv = document.getElementById('interiorCanvas');
    cv.addEventListener('mousedown', e => { intDragging = true; intLastX = e.clientX; intLastY = e.clientY; });
    window.addEventListener('mouseup', () => { intDragging = false; });
    window.addEventListener('mousemove', e => {
      if (!intDragging) return;
      intYaw   -= (e.clientX - intLastX) * 0.003;
      intPitch -= (e.clientY - intLastY) * 0.003;
      intLastX = e.clientX; intLastY = e.clientY;
    });

    // Touch look
    cv.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { intDragging = true; intLastX = e.touches[0].clientX; intLastY = e.touches[0].clientY; }
    }, { passive: true });
    cv.addEventListener('touchend', () => { intDragging = false; }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (!intDragging || e.touches.length !== 1) return;
      intYaw   -= (e.touches[0].clientX - intLastX) * 0.004;
      intPitch -= (e.touches[0].clientY - intLastY) * 0.004;
      intLastX = e.touches[0].clientX; intLastY = e.touches[0].clientY;
    }, { passive: true });

    // Scroll to zoom FOV
    cv.addEventListener('wheel', e => {
      intCamera.fov = Math.max(30, Math.min(100, intCamera.fov + e.deltaY * 0.05));
      intCamera.updateProjectionMatrix();
    }, { passive: true });
  }

  function loadPanorama(imgPath) {
    intScene.clear();
    // Ambient light for the sphere
    intScene.add(new THREE.AmbientLight(0xffffff, 1));

    const geo = new THREE.SphereGeometry(50, 64, 32);
    geo.scale(-1, 1, 1); // inside-out

    const tex = texLoader.load(imgPath);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    intScene.add(new THREE.Mesh(geo, mat));
  }

  function intAnimate() {
    intRaf = requestAnimationFrame(intAnimate);
    intPitch = Math.max(-1.2, Math.min(1.2, intPitch));
    intCamera.rotation.order = 'YXZ';
    intCamera.rotation.y = intYaw;
    intCamera.rotation.x = intPitch;
    intRenderer.render(intScene, intCamera);
  }

  function buildNav(currentId) {
    const nav = document.getElementById('interiorNav');
    nav.innerHTML = '';
    ROOMS.forEach(room => {
      const btn = document.createElement('button');
      btn.className = 'int-nav-btn' + (room.id === currentId ? ' active' : '');
      btn.textContent = room.label;
      btn.onclick = () => window.openRoom(room.id);
      nav.appendChild(btn);
    });
  }

  /* ─── GLOBAL: ODA AÇ / KAPAT ─── */
  window.openRoom = function (id) {
    const room = ROOMS.find(r => r.id === id);
    if (!room) return;

    document.getElementById('interiorRoomName').textContent = room.label;
    setupInterior();
    loadPanorama(room.img);
    buildNav(id);

    intYaw = 0; intPitch = 0;
    intCamera.fov = 75;
    intCamera.updateProjectionMatrix();

    document.getElementById('interiorOverlay').classList.add('visible');
    if (intRaf) cancelAnimationFrame(intRaf);
    intAnimate();

    // Highlight in side panel
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
    const active = [...document.querySelectorAll('.room-btn')].find(b => b.textContent.trim() === room.label);
    if (active) active.classList.add('active');
  };

  window.closeRoom = function () {
    document.getElementById('interiorOverlay').classList.remove('visible');
    if (intRaf) cancelAnimationFrame(intRaf);
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
  };

})();
