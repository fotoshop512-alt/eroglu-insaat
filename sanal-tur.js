/* ═══════════════════════════════════════════════════════════════
   EROĞLU — 3D Sanal Tur
   Three.js GLB model + 360° oda fotoğrafları
   ═══════════════════════════════════════════════════════════════ */
;(function () {
  'use strict';

  const THREE = window.THREE;
  const { GLTFLoader, OrbitControls, RoomEnvironment } = window.THREEAddons;

  if (!THREE || !GLTFLoader) {
    console.error('Three.js veya eklentiler yüklenemedi');
    return;
  }

  /* ────────────────────────────────────
     ODA TANIMLARI
  ──────────────────────────────────── */
  const ROOMS = [
    { id: 'salon',  label: 'Salon',        img: 'assets/images/interior_salon.webp'  },
    { id: 'oturma', label: 'Oturma Odası', img: 'assets/images/interior_oturma.webp' },
    { id: 'mutfak', label: 'Mutfak',       img: 'assets/images/interior_mutfak.webp' },
    { id: 'yatak',  label: 'Yatak Odası',  img: 'assets/images/interior_yatak.webp'  },
    { id: 'cocuk',  label: 'Çocuk Odası',  img: 'assets/images/interior_cocuk.webp'  },
    { id: 'banyo',  label: 'Banyo',        img: 'assets/images/interior_banyo.webp'  },
    { id: 'balkon', label: 'Balkon',       img: 'assets/images/interior_balkon.webp' },
  ];

  /* ────────────────────────────────────
     LOADING HELPERS
  ──────────────────────────────────── */
  const loadBar = document.getElementById('loadBar');
  const loadPct = document.getElementById('loadPct');
  const loadScreen = document.getElementById('loadScreen');

  function setProgress(p) {
    const v = Math.round(p * 100);
    loadBar.style.width = v + '%';
    loadPct.textContent = v + '%';
  }

  function hideLoader() {
    loadScreen.classList.add('hidden');
    document.getElementById('roomPanel').classList.add('visible');
  }

  /* ────────────────────────────────────
     3D SAHNE KURULUMU
  ──────────────────────────────────── */
  const canvas = document.getElementById('tourCanvas');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080a0f);
  scene.fog = new THREE.FogExp2(0x080a0f, 0.008);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(60, 40, 80);

  // Environment (Room Environment = soft realistic IBL)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTexture;

  // Lights
  const hemi = new THREE.HemisphereLight(0xb0c8e8, 0x303020, 0.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
  sun.position.set(80, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 400;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x8090c0, 0.5);
  fill.position.set(-60, 30, -60);
  scene.add(fill);

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.9,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid overlay on ground
  const grid = new THREE.GridHelper(200, 50, 0xc9a84c, 0x1e2230);
  grid.material.opacity = 0.18;
  grid.material.transparent = true;
  scene.add(grid);

  // Orbit Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 10;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;
  controls.enablePan = true;
  controls.panSpeed = 0.8;
  controls.target.set(0, 15, 0);

  // Stop auto-rotate on user interaction
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  /* ────────────────────────────────────
     MODEL YÜKLEME
  ──────────────────────────────────── */
  let modelLoaded = false;
  const loader = new GLTFLoader();

  setProgress(0.05);

  loader.load(
    'assets/model.glb',
    (gltf) => {
      const model = gltf.scene;

      // Bounding box hesapla → modeli otomatik ortala ve ölçekle
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Modeli origin'e taşı
      model.position.sub(center);
      model.position.y -= box.min.y; // zemine oturt

      // Ölçek: 30 birim yüksekliğe normalize et
      const targetHeight = 30;
      const scale = targetHeight / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);

      // Gölge + materyal iyileştirmesi
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => {
              // Flat renkleri metalik/pürüzlü yap
              if (!mat.map) {
                mat.roughness = 0.7;
                mat.metalness = 0.05;
              }
              mat.envMapIntensity = 1.2;
              mat.needsUpdate = true;
            });
          }
        }
      });

      scene.add(model);

      // Kamerayı modele göre konumlandır
      const scaledSize = size.clone().multiplyScalar(scale);
      const dist = Math.max(scaledSize.x, scaledSize.z) * 2.5;
      camera.position.set(dist * 0.8, scaledSize.y * 0.8, dist);
      controls.target.set(0, scaledSize.y * 0.4, 0);
      controls.minDistance = scaledSize.y * 0.5;
      controls.maxDistance = dist * 3;
      controls.update();

      modelLoaded = true;
      setProgress(1);
      setTimeout(hideLoader, 600);
    },
    (xhr) => {
      if (xhr.total > 0) setProgress(0.05 + (xhr.loaded / xhr.total) * 0.9);
    },
    (err) => {
      console.error('Model yüklenemedi:', err);
      // Fallback: placeholder bina
      buildFallbackBuilding();
      setProgress(1);
      setTimeout(hideLoader, 600);
    }
  );

  /* ── FALLBACK: Model yoksa basit bina çiz ── */
  function buildFallbackBuilding() {
    const group = new THREE.Group();

    // Ana kule
    const bodyGeo = new THREE.BoxGeometry(18, 45, 14);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4c8b8, roughness: 0.5, metalness: 0.1 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 22.5;
    body.castShadow = true;
    group.add(body);

    // Balkon katmanları
    for (let i = 1; i <= 12; i++) {
      const bGeo = new THREE.BoxGeometry(20, 0.4, 16);
      const bMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.4 });
      const b = new THREE.Mesh(bGeo, bMat);
      b.position.y = i * 3.5;
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
    }

    // Cam cephe
    const glassGeo = new THREE.BoxGeometry(16, 43, 0.2);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.6 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 22, 7.1);
    group.add(glass);

    scene.add(group);
    modelLoaded = true;
  }

  /* ────────────────────────────────────
     COMPASS
  ──────────────────────────────────── */
  const compassNeedle = document.getElementById('compassNeedle');

  /* ────────────────────────────────────
     RENDER LOOP
  ──────────────────────────────────── */
  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    controls.update();

    // Compass: kameranın yatay açısına göre döndür
    const angle = Math.atan2(
      camera.position.x - controls.target.x,
      camera.position.z - controls.target.z
    );
    compassNeedle.style.transform = `rotate(${-angle}rad)`;

    renderer.render(scene, camera);
  }
  animate();

  /* ────────────────────────────────────
     RESIZE
  ──────────────────────────────────── */
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
  let currentRoomId = null;

  function setupInteriorRenderer() {
    if (intRenderer) return; // already set up

    const c = document.getElementById('interiorCanvas');
    intRenderer = new THREE.WebGLRenderer({ canvas: c, antialias: true });
    intRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    intRenderer.setSize(window.innerWidth, window.innerHeight);
    intRenderer.outputColorSpace = THREE.SRGBColorSpace;
    intRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    intRenderer.toneMappingExposure = 1.0;

    intScene = new THREE.Scene();
    intCamera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 100);
    intCamera.position.set(0, 0, 0);

    window.addEventListener('resize', () => {
      intCamera.aspect = window.innerWidth / window.innerHeight;
      intCamera.updateProjectionMatrix();
      intRenderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function loadRoomPanorama(imgPath) {
    // Clear old sphere
    intScene.clear();

    const geo = new THREE.SphereGeometry(50, 64, 32);
    geo.scale(-1, 1, 1); // inside-out

    const texLoader = new THREE.TextureLoader();
    const tex = texLoader.load(imgPath);
    tex.colorSpace = THREE.SRGBColorSpace;

    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const sphere = new THREE.Mesh(geo, mat);
    intScene.add(sphere);
  }

  function intAnimate() {
    intRaf = requestAnimationFrame(intAnimate);
    const halfH = intCamera.fov * (Math.PI / 180) * 0.5;
    intPitch = Math.max(-halfH + 0.05, Math.min(halfH - 0.05, intPitch));
    intCamera.rotation.order = 'YXZ';
    intCamera.rotation.y = intYaw;
    intCamera.rotation.x = intPitch;
    intRenderer.render(intScene, intCamera);
  }

  // Mouse/touch look
  function setupIntLook() {
    const c = document.getElementById('interiorCanvas');

    // Mouse
    c.addEventListener('mousedown', e => { intDragging = true; intLastX = e.clientX; intLastY = e.clientY; });
    window.addEventListener('mouseup', () => { intDragging = false; });
    window.addEventListener('mousemove', e => {
      if (!intDragging) return;
      intYaw   -= (e.clientX - intLastX) * 0.003;
      intPitch -= (e.clientY - intLastY) * 0.003;
      intLastX = e.clientX; intLastY = e.clientY;
    });

    // Touch
    c.addEventListener('touchstart', e => {
      if (e.touches.length === 1) { intDragging = true; intLastX = e.touches[0].clientX; intLastY = e.touches[0].clientY; }
    }, { passive: true });
    c.addEventListener('touchend', () => { intDragging = false; });
    c.addEventListener('touchmove', e => {
      if (!intDragging || e.touches.length !== 1) return;
      intYaw   -= (e.touches[0].clientX - intLastX) * 0.004;
      intPitch -= (e.touches[0].clientY - intLastY) * 0.004;
      intLastX = e.touches[0].clientX; intLastY = e.touches[0].clientY;
    }, { passive: true });
  }

  /* ── İç mekan navigasyon butonları ── */
  function buildInteriorNav(currentId) {
    const nav = document.getElementById('interiorNav');
    nav.innerHTML = '';
    ROOMS.forEach(room => {
      const btn = document.createElement('button');
      btn.className = 'int-nav-btn' + (room.id === currentId ? ' active' : '');
      btn.textContent = room.label;
      btn.onclick = () => openRoom(room.id);
      nav.appendChild(btn);
    });
  }

  /* ────────────────────────────────────
     GLOBAL: ODA AÇ / KAPAT
  ──────────────────────────────────── */
  window.openRoom = function (id) {
    const room = ROOMS.find(r => r.id === id);
    if (!room) return;

    currentRoomId = id;
    document.getElementById('interiorRoomName').textContent = room.label;

    setupInteriorRenderer();
    loadRoomPanorama(room.img);
    buildInteriorNav(id);

    // Reset yaw/pitch for new room
    intYaw = 0; intPitch = 0;

    const overlay = document.getElementById('interiorOverlay');
    overlay.classList.add('visible');

    // Attach look controls once
    if (!overlay._lookSetup) {
      setupIntLook();
      overlay._lookSetup = true;
    }

    // Start interior render loop
    if (intRaf) cancelAnimationFrame(intRaf);
    intAnimate();

    // Highlight active room button in side panel
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = [...document.querySelectorAll('.room-btn')].find(b => b.textContent.trim() === room.label);
    if (activeBtn) activeBtn.classList.add('active');
  };

  window.closeRoom = function () {
    document.getElementById('interiorOverlay').classList.remove('visible');
    if (intRaf) cancelAnimationFrame(intRaf);
    document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
  };

})();
