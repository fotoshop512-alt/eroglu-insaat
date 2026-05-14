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
  const sph = { theta: 0.0, phi: 1.25, radius: 28 };
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
     EXTERIOR — Billboard yaklaşımı:
     Skyline render'ı her zaman kameraya bakan tek bir
     plane'e map'lenir. Kamera döndüğünde 4 farklı render
     arasında geçiş yapılır (en yakın açı seçilir).
  ──────────────────────────────────────────*/
  let billboardPlanes = [];

  function buildExterior() {
    // Hafif ambient — sahne tam karanlık olmasın
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    // Ground — koyu reflektif disk
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(45, 64),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.9, metalness: 0.1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    scene.add(ground);

    // Gold accent halka — binanın oturduğu zemin
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7, 8.2, 64),
      new THREE.MeshBasicMaterial({ color: 0xd4a853, transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // Halka altında soft cyan halo
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(8.2, 14, 64),
      new THREE.MeshBasicMaterial({ color: 0x4488dd, transparent: true, opacity: 0.10, side: THREE.DoubleSide, toneMapped: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    scene.add(halo);

    // Bina = billboard plane (1 görünür, kameraya bakar)
    buildingGroup = new THREE.Group();
    buildingGroup.position.y = BUILDING.baseY;

    // Skyline render aspect ratio: 1920×2880 = 0.667 (portrait)
    // Yüksekliği 22 yapıp genişliği aspect'ten hesapla
    const billH = 22;
    const billW = billH * (1920/2880);  // ≈ 14.67

    FACADES.forEach((img, i) => {
      const tex = loadTex(img);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        color: 0xffffff,
        toneMapped: false,
        transparent: true,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(billW, billH),
        mat
      );
      plane.position.set(0, billH/2, 0);
      plane.userData.billboardIdx = i;
      // Sadece ilk plane görünür başlangıçta
      plane.visible = (i === 0);
      plane.userData.targetOpacity = (i === 0 ? 1 : 0);
      buildingGroup.add(plane);
      billboardPlanes.push(plane);
    });

    scene.add(buildingGroup);
  }

  /* Kamera açısına göre en yakın billboard'u seç + ona doğru çevir */
  function updateBillboards() {
    if (!billboardPlanes.length) return;
    // Kamera dünya-pozisyonu xz düzleminde açı
    const camAngle = Math.atan2(camera.position.x, camera.position.z); // -π..π
    // 4 yüz: 0, π/2, π, -π/2 (skyline1=ön, detail1=sağ, skyline2=arka, detail2=sol)
    const faceAngles = [0, Math.PI/2, Math.PI, -Math.PI/2];
    // En yakın yüzü bul
    let bestIdx = 0;
    let bestDist = Infinity;
    faceAngles.forEach((a, i) => {
      let d = Math.abs(camAngle - a);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    // Sadece en yakını göster
    billboardPlanes.forEach((p, i) => {
      const visible = (i === bestIdx);
      p.userData.targetOpacity = visible ? 1 : 0;
      // Smooth fade
      p.material.opacity += (p.userData.targetOpacity - p.material.opacity) * 0.15;
      p.visible = p.material.opacity > 0.01;
    });
    // Aktif plane'i kameraya çevir (Y ekseninde billboard)
    const active = billboardPlanes[bestIdx];
    if (active) {
      active.lookAt(camera.position.x, active.position.y, camera.position.z);
    }
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
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: 0xffffff,
      toneMapped: false,
      side: THREE.DoubleSide
    });
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
    // Billboard merkezi y=11 (h=22 / 2)
    camera.position.set(x, y + 11, z);
    camera.lookAt(0, 10, 0);
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
      if (mode === 'orbit') updateBillboards();
      renderer.render(scene, camera);
    }
    tick();
  }

})();
