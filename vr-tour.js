/* ============================================================
   EROĞLU İNŞAAT — Gerçek Fotoğraflı VR Tur
   Three.js tabanlı:
   - Orbit mod: Bina dışı, skyline render'ları façade'a texture
   - Photo-room mod: Interior fotoğrafı inside-out sphere'a sarılır
   ============================================================ */
;(function () {
  'use strict';

  if (!window.THREE) {
    console.warn('Three.js bulunamadı, VR turu devre dışı.');
    return;
  }
  const THREE = window.THREE;

  /* ─────────────────────────────────────────
     KONFİG
  ──────────────────────────────────────────*/
  const FACADES = [
    'assets/images/skyline1.webp',
    'assets/images/skyline_detail1.webp',
    'assets/images/skyline2.webp',
    'assets/images/skyline_detail2.webp',
  ];
  const TOP_IMG = 'assets/images/skyline_top.webp';

  const ROOMS = [
    { id: 'salon',  label: 'Salon',         img: 'assets/images/interior_salon.webp'  },
    { id: 'oturma', label: 'Oturma Odası',  img: 'assets/images/interior_oturma.webp' },
    { id: 'mutfak', label: 'Mutfak',        img: 'assets/images/interior_mutfak.webp' },
    { id: 'yatak',  label: 'Yatak Odası',   img: 'assets/images/interior_yatak.webp'  },
    { id: 'cocuk',  label: 'Çocuk Odası',   img: 'assets/images/interior_cocuk.webp'  },
    { id: 'banyo',  label: 'Banyo',         img: 'assets/images/interior_banyo.webp'  },
    { id: 'balkon', label: 'Balkon',        img: 'assets/images/interior_balkon.webp' },
  ];

  const BUILDING = { w: 9, h: 24, d: 9, baseY: 0 };

  /* ─────────────────────────────────────────
     STATE
  ──────────────────────────────────────────*/
  let mode = 'orbit'; // 'orbit' | 'photo'
  let renderer, scene, camera;
  let buildingGroup;
  let photoSphere = null;
  let currentRoomIdx = 0;

  // Orbit
  const sph = { theta: 0.5, phi: 1.0, radius: 30 };
  let isDragging = false;
  let lastP = { x: 0, y: 0 };
  let autoRotate = true;
  let autoTimer = null;

  // Photo-room look
  let yaw = 0, pitch = 0;

  // Texture loader (shared)
  const texLoader = new THREE.TextureLoader();
  texLoader.crossOrigin = 'anonymous';

  function loadTex(url, onReady) {
    const tex = texLoader.load(url, t => {
      t.needsUpdate = true;
      onReady && onReady(t);
    });
    // colorSpace ve anisotropy'yi HEMEN ayarla (shader compile sırasında bilinmeli)
    if ('SRGBColorSpace' in THREE) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    return tex;
  }

  /* ─────────────────────────────────────────
     ENTRY
  ──────────────────────────────────────────*/
  const section = document.getElementById('vr-tour');
  if (!section) return;

  const _obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { initScene(); _obs.disconnect(); }
  }, { threshold: 0.05 });
  _obs.observe(section);

  window.addEventListener('scroll', function _scrollInit() {
    const r = section.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      initScene();
      window.removeEventListener('scroll', _scrollInit);
    }
  }, { passive: true });

  window.__vrInit = () => initScene();

  /* ─────────────────────────────────────────
     INIT
  ──────────────────────────────────────────*/
  function initScene() {
    if (renderer) return;

    const container = document.getElementById('vrCanvasWrapper');
    const canvas    = document.getElementById('vrCanvas');
    if (!container || !canvas) return;

    const W = () => container.clientWidth;
    const H = () => Math.min(Math.round(W() * 0.58), 640);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e18);
    scene.fog = new THREE.Fog(0x0a0e18, 60, 120);

    camera = new THREE.PerspectiveCamera(50, W() / H(), 0.1, 300);
    updateOrbitCamera();

    buildExterior();
    setupRoomList();
    setupEvents();
    startRenderLoop();
    armAutoRotate();

    // Debug refs
    window.__vrScene = scene;
    window.__vrRenderer = renderer;
    window.__vrBuilding = buildingGroup;

    window.addEventListener('resize', () => {
      const w = W(), h = H();
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
  }

  /* ─────────────────────────────────────────
     EXTERIOR — skyline foto'larla 4 yüzlü prizma
  ──────────────────────────────────────────*/
  function buildExterior() {
    // Lights — basic'lerle texture'lar zaten parlak görünür
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
    sun.position.set(25, 40, 20);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.4);
    fill.position.set(-15, 10, -15);
    scene.add(fill);

    // Ground — koyu reflektif
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(45, 64),
      new THREE.MeshStandardMaterial({ color: 0x12161e, roughness: 0.85, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // Soft accent ring on ground
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(11, 12, 64),
      new THREE.MeshBasicMaterial({ color: 0xd4a853, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);

    // Building
    buildingGroup = new THREE.Group();
    buildingGroup.position.y = BUILDING.baseY;

    const W = BUILDING.w, H = BUILDING.h, D = BUILDING.d;
    const facadeDefs = [
      { img: FACADES[0], pos: [ 0,       H/2,  D/2 + 0.01 ], rotY:  0 },
      { img: FACADES[1], pos: [ W/2+0.01,H/2,  0          ], rotY: -Math.PI/2 },
      { img: FACADES[2], pos: [ 0,       H/2, -D/2 - 0.01 ], rotY:  Math.PI },
      { img: FACADES[3], pos: [-W/2-0.01,H/2,  0          ], rotY:  Math.PI/2 },
    ];

    facadeDefs.forEach((f, i) => {
      // Load texture upfront so material compiles WITH map from start
      const tex = loadTex(f.img);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(W, H),
        mat
      );
      plane.position.set(f.pos[0], f.pos[1], f.pos[2]);
      plane.rotation.y = f.rotY;
      plane.userData.isFacade = true;
      plane.userData.facadeIdx = i;
      buildingGroup.add(plane);
    });

    // Top
    const topTex = loadTex(TOP_IMG);
    const topMat = new THREE.MeshBasicMaterial({ map: topTex, color: 0xffffff });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), topMat);
    top.position.set(0, H + 0.01, 0);
    top.rotation.x = -Math.PI / 2;
    buildingGroup.add(top);

    // Glow halo around building (subtle)
    const halo = new THREE.Mesh(
      new THREE.CylinderGeometry(W * 0.85, W * 0.95, H * 1.05, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x6699cc, transparent: true, opacity: 0.05, side: THREE.BackSide })
    );
    halo.position.y = H/2;
    buildingGroup.add(halo);

    scene.add(buildingGroup);
  }

  /* ─────────────────────────────────────────
     PHOTO-ROOM MODE
  ──────────────────────────────────────────*/
  function enterPhotoTour(idx) {
    if (mode === 'photo') { changeRoom(idx); return; }
    currentRoomIdx = idx;
    mode = 'photo';
    autoRotate = false;
    clearTimeout(autoTimer);

    // Hide building
    if (buildingGroup) buildingGroup.visible = false;

    // Inside-out sphere
    const geo = new THREE.SphereGeometry(50, 64, 32);
    geo.scale(-1, 1, 1); // flip normals → görüntü içeride
    const tex = loadTex(ROOMS[idx].img);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff });
    photoSphere = new THREE.Mesh(geo, mat);
    scene.add(photoSphere);

    // Camera to center, reset look
    camera.position.set(0, 0, 0);
    camera.fov = 75;
    camera.updateProjectionMatrix();
    yaw = 0; pitch = 0;
    updatePhotoCamera();

    // UI swap
    const orbitUI = document.getElementById('vrOrbitUI');
    const fpsUI   = document.getElementById('vrFpsUI');
    if (orbitUI) orbitUI.style.display = 'none';
    if (fpsUI)   fpsUI.style.display   = 'block';
    updatePhotoUI();
  }

  function changeRoom(idx) {
    if (idx < 0) idx = ROOMS.length - 1;
    if (idx >= ROOMS.length) idx = 0;
    currentRoomIdx = idx;
    loadTex(ROOMS[idx].img, tex => {
      if (!photoSphere) return;
      const old = photoSphere.material.map;
      photoSphere.material.map = tex;
      photoSphere.material.color.set(0xffffff);
      photoSphere.material.needsUpdate = true;
      if (old) old.dispose();
    });
    updatePhotoUI();
  }

  function updatePhotoUI() {
    const label = document.getElementById('vrRoomIndicator');
    const apt   = document.getElementById('vrAptInfo');
    if (label) label.textContent = ROOMS[currentRoomIdx].label;
    if (apt)   apt.textContent   = `Daire 4+1 · ${currentRoomIdx + 1}/${ROOMS.length}`;
    const dots = document.getElementById('vrRoomDots');
    if (dots) {
      dots.innerHTML = ROOMS.map((r, i) =>
        `<button class="vr-room-dot${i === currentRoomIdx ? ' active' : ''}" data-idx="${i}" title="${r.label}"></button>`
      ).join('');
    }
  }

  function exitPhotoTour() {
    if (mode !== 'photo') return;
    mode = 'orbit';
    if (photoSphere) {
      scene.remove(photoSphere);
      photoSphere.material.map?.dispose();
      photoSphere.material.dispose();
      photoSphere.geometry.dispose();
      photoSphere = null;
    }
    if (buildingGroup) buildingGroup.visible = true;
    camera.fov = 50;
    camera.updateProjectionMatrix();
    updateOrbitCamera();

    const orbitUI = document.getElementById('vrOrbitUI');
    const fpsUI   = document.getElementById('vrFpsUI');
    if (orbitUI) orbitUI.style.display = 'block';
    if (fpsUI)   fpsUI.style.display   = 'none';
    armAutoRotate();
  }
  window.exitVRFPS = exitPhotoTour;

  /* ─────────────────────────────────────────
     CAMERA
  ──────────────────────────────────────────*/
  function updateOrbitCamera() {
    const x = sph.radius * Math.sin(sph.phi) * Math.sin(sph.theta);
    const y = sph.radius * Math.cos(sph.phi);
    const z = sph.radius * Math.sin(sph.phi) * Math.cos(sph.theta);
    camera.position.set(x, y + BUILDING.h/2, z);
    camera.lookAt(0, BUILDING.h/2 - 2, 0);
  }

  function updatePhotoCamera() {
    const tx = Math.sin(yaw) * Math.cos(pitch);
    const ty = Math.sin(pitch);
    const tz = Math.cos(yaw) * Math.cos(pitch);
    camera.lookAt(tx, ty, tz);
  }

  function armAutoRotate() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => { autoRotate = true; }, 4000);
  }

  /* ─────────────────────────────────────────
     EVENTS
  ──────────────────────────────────────────*/
  function setupEvents() {
    const canvas = document.getElementById('vrCanvas');

    let downAt = null;
    let downP = null;
    const onDown = (x, y) => {
      isDragging = true;
      lastP = { x, y };
      downP = { x, y };
      downAt = Date.now();
      autoRotate = false;
      clearTimeout(autoTimer);
    };
    const onMove = (x, y) => {
      if (!isDragging) return;
      const dx = x - lastP.x;
      const dy = y - lastP.y;
      lastP = { x, y };
      if (mode === 'orbit') {
        sph.theta -= dx * 0.006;
        sph.phi = Math.max(0.25, Math.min(1.55, sph.phi - dy * 0.005));
        updateOrbitCamera();
      } else {
        yaw   -= dx * 0.005;
        pitch  = Math.max(-1.2, Math.min(1.2, pitch - dy * 0.005));
        updatePhotoCamera();
      }
    };
    const onUp = () => { isDragging = false; if (mode === 'orbit') armAutoRotate(); };

    canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
    canvas.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('mouseleave', onUp);

    canvas.addEventListener('touchstart', e => {
      const t = e.touches[0]; onDown(t.clientX, t.clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      const t = e.touches[0]; onMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', onUp);

    canvas.addEventListener('wheel', e => {
      if (mode === 'orbit') {
        sph.radius = Math.max(15, Math.min(60, sph.radius + e.deltaY * 0.025));
        updateOrbitCamera();
      } else if (mode === 'photo') {
        camera.fov = Math.max(35, Math.min(90, camera.fov + e.deltaY * 0.05));
        camera.updateProjectionMatrix();
      }
      e.preventDefault();
    }, { passive: false });

    // Click bina (sürükleme değilse) → ilk odaya gir
    canvas.addEventListener('click', e => {
      if (mode !== 'orbit') return;
      // Sadece gerçek click — drag değil
      if (!downP) return;
      const dx = Math.abs(e.clientX - downP.x);
      const dy = Math.abs(e.clientY - downP.y);
      const dt = Date.now() - downAt;
      if (dx > 6 || dy > 6 || dt > 350) return; // drag say
      enterPhotoTour(0);
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (mode === 'photo') {
        if (e.key === 'Escape') exitPhotoTour();
        else if (e.key === 'ArrowLeft')  changeRoom(currentRoomIdx - 1);
        else if (e.key === 'ArrowRight') changeRoom(currentRoomIdx + 1);
      }
    });

    // UI buttons (delegated)
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-vr-room]');
      if (t) {
        const id = t.getAttribute('data-vr-room');
        const idx = ROOMS.findIndex(r => r.id === id);
        if (idx >= 0) enterPhotoTour(idx);
      }
      const dot = e.target.closest('.vr-room-dot');
      if (dot) changeRoom(parseInt(dot.dataset.idx));
      const prev = e.target.closest('#vrPrevRoom');
      if (prev) changeRoom(currentRoomIdx - 1);
      const next = e.target.closest('#vrNextRoom');
      if (next) changeRoom(currentRoomIdx + 1);
    });
  }

  function setupRoomList() {
    const list = document.getElementById('vrRoomList');
    if (!list) return;
    list.innerHTML = ROOMS.map(r =>
      `<button class="vr-room-btn" data-vr-room="${r.id}">
         <span class="vr-room-btn-icon">▸</span>${r.label}
       </button>`
    ).join('');
  }

  /* ─────────────────────────────────────────
     RENDER LOOP
  ──────────────────────────────────────────*/
  function startRenderLoop() {
    function tick() {
      requestAnimationFrame(tick);
      if (mode === 'orbit' && autoRotate) {
        sph.theta += 0.0025;
        updateOrbitCamera();
      }
      renderer.render(scene, camera);
    }
    tick();
  }

})();
