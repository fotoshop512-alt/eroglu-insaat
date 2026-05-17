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
    setupFpsControls();
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
     FPS APARTMENT MODE — 3D walkable rooms
  ──────────────────────────────────────────*/
  // Apartman planı (üstten görünüm, x sağ, z ileri)
  const WALL_H = 2.8;
  const APT_ROOMS = [
    { id: 'giris',  label: 'Giriş',         x1: -2, z1: -7,  x2: 2,  z2: -4, photo: null },
    { id: 'salon',  label: 'Salon',         x1: -4, z1: -4,  x2: 4,  z2:  4, photo: 'assets/images/interior_salon.webp',  pwall: 'N' },
    { id: 'mutfak', label: 'Mutfak',        x1:  4, z1: -2,  x2: 8,  z2:  2, photo: 'assets/images/interior_mutfak.webp', pwall: 'E' },
    { id: 'balkon', label: 'Balkon',        x1: -8, z1: -2,  x2: -4, z2:  2, photo: 'assets/images/interior_balkon.webp', pwall: 'W' },
    { id: 'oturma', label: 'Oturma Odası',  x1: -3, z1:  4,  x2: 3,  z2:  8, photo: 'assets/images/interior_oturma.webp', pwall: 'N' },
    { id: 'yatak',  label: 'Yatak Odası',   x1: -7, z1:  4,  x2: -3, z2:  8, photo: 'assets/images/interior_yatak.webp',  pwall: 'N' },
    { id: 'cocuk',  label: 'Çocuk Odası',   x1:  3, z1:  4,  x2: 7,  z2:  8, photo: 'assets/images/interior_cocuk.webp',  pwall: 'N' },
    { id: 'banyo',  label: 'Banyo',         x1: -3, z1: -7,  x2: -1, z2: -4, photo: 'assets/images/interior_banyo.webp',  pwall: 'S' },
  ];
  // Kapılar: iki oda paylaşılan kenar boyunca açılır
  const APT_DOORS = [
    ['giris', 'salon'],
    ['banyo', 'giris'],
    ['salon', 'mutfak'],
    ['salon', 'balkon'],
    ['salon', 'oturma'],
    ['oturma', 'yatak'],
    ['oturma', 'cocuk'],
  ];

  /* 3D mobilya tanımları — basit box geometriler, fotoğraflara benzer yerleşim
     type: 'box' (varsayılan) veya 'cyl' (silindir)
     x/z = merkez, y opsiyonel (varsayılan h/2 = zemine oturur) */
  const FURNITURE = {
    salon: [
      // Halı
      { x: -2.5, y: 0.01, z: -2, w: 3.6, h: 0.02, d: 2.2, c: 0x9c7a5e },
      // 3-li kanepe
      { x: -2.8, z: -3.0, w: 2.6, h: 0.45, d: 0.9, c: 0x4a566b },
      { x: -2.8, y: 0.85, z: -3.3, w: 2.6, h: 0.5, d: 0.3, c: 0x4a566b }, // sırt
      { x: -4.0, y: 0.7, z: -3.0, w: 0.25, h: 0.45, d: 0.9, c: 0x4a566b }, // kolçak sol
      { x: -1.5, y: 0.7, z: -3.0, w: 0.25, h: 0.45, d: 0.9, c: 0x4a566b }, // kolçak sağ
      // Yastıklar
      { x: -3.5, y: 0.55, z: -3.0, w: 0.4, h: 0.2, d: 0.4, c: 0xc4a673 },
      { x: -2.0, y: 0.55, z: -3.0, w: 0.4, h: 0.2, d: 0.4, c: 0x8a6850 },
      // Sehpa
      { x: -2.8, z: -1.6, w: 1.2, h: 0.4, d: 0.6, c: 0x6a4f33 },
      // Tek koltuk (sağda)
      { x: 1.5, z: -2.5, w: 0.95, h: 0.45, d: 0.95, c: 0x5a6675 },
      { x: 1.5, y: 0.85, z: -2.8, w: 0.95, h: 0.5, d: 0.3, c: 0x5a6675 },
      // TV ünitesi
      { x: -2.8, z: 3.7, w: 2.6, h: 0.5, d: 0.35, c: 0x2a2018 },
      // TV (LED ekran)
      { x: -2.8, y: 1.0, z: 3.85, w: 1.8, h: 0.95, d: 0.06, c: 0x080808 },
      // Lamba
      { x: 2.5, z: -3.2, w: 0.25, h: 1.6, d: 0.25, c: 0xc8a06a },
    ],
    mutfak: [
      // L tezgah
      { x: 5.5, z: -1.6, w: 3.0, h: 0.9, d: 0.55, c: 0xe6dec8 },
      { x: 7.5, z: 0.5, w: 0.55, h: 0.9, d: 3.0, c: 0xe6dec8 },
      // Üst dolaplar
      { x: 5.5, y: 2.0, z: -1.6, w: 3.0, h: 0.7, d: 0.35, c: 0xc4b698 },
      { x: 7.5, y: 2.0, z: 0.5, w: 0.4, h: 0.7, d: 2.5, c: 0xc4b698 },
      // Ocak
      { x: 5.5, y: 0.92, z: -1.5, w: 0.7, h: 0.04, d: 0.5, c: 0x222222 },
      // Yemek masası
      { x: 4.7, z: 1.5, w: 1.2, h: 0.04, d: 0.8, c: 0x7a5638 },
      { x: 4.7, y: 0.35, z: 1.5, w: 0.08, h: 0.7, d: 0.08, c: 0x7a5638 },
      // Sandalyeler (önce oturak sonra sırt)
      { x: 4.05, z: 1.5, w: 0.4, h: 0.45, d: 0.4, c: 0x3a3a3a },
      { x: 4.05, y: 0.7, z: 1.35, w: 0.4, h: 0.45, d: 0.06, c: 0x3a3a3a },
      { x: 5.35, z: 1.5, w: 0.4, h: 0.45, d: 0.4, c: 0x3a3a3a },
      { x: 5.35, y: 0.7, z: 1.35, w: 0.4, h: 0.45, d: 0.06, c: 0x3a3a3a },
    ],
    yatak: [
      // Karyola çerçeve
      { x: -5.5, z: 7.0, w: 2.0, h: 0.4, d: 1.9, c: 0x5a4030 },
      // Şilte/yorgan
      { x: -5.5, y: 0.45, z: 7.0, w: 1.9, h: 0.15, d: 1.8, c: 0xefe6d4 },
      // Başlık
      { x: -5.5, y: 0.8, z: 7.85, w: 2.0, h: 1.1, d: 0.1, c: 0x7a5a3e },
      // Yastıklar
      { x: -6.0, y: 0.6, z: 7.6, w: 0.55, h: 0.15, d: 0.35, c: 0xffffff },
      { x: -5.0, y: 0.6, z: 7.6, w: 0.55, h: 0.15, d: 0.35, c: 0xffffff },
      // Komodin
      { x: -6.7, z: 7.5, w: 0.45, h: 0.55, d: 0.4, c: 0x6b5a40 },
      // Komodin lambası
      { x: -6.7, y: 0.8, z: 7.5, w: 0.18, h: 0.35, d: 0.18, c: 0xd4b478 },
      // Gardırop
      { x: -3.5, z: 5.0, w: 0.55, h: 2.3, d: 2.4, c: 0xc4b29a },
    ],
    cocuk: [
      // Tek kişilik yatak
      { x: 6.5, z: 5.5, w: 0.95, h: 0.35, d: 1.85, c: 0x4a90c2 },
      { x: 6.5, y: 0.4, z: 5.5, w: 0.9, h: 0.12, d: 1.75, c: 0xfff8e0 },
      { x: 6.5, y: 0.55, z: 6.3, w: 0.95, h: 0.95, d: 0.08, c: 0x3a78a8 },
      // Yastık
      { x: 6.5, y: 0.5, z: 6.15, w: 0.5, h: 0.1, d: 0.3, c: 0xffffff },
      // Çalışma masası
      { x: 3.5, z: 7.4, w: 0.55, h: 0.04, d: 1.0, c: 0xc8a978 },
      { x: 3.5, y: 0.35, z: 7.4, w: 0.08, h: 0.7, d: 0.08, c: 0xc8a978 },
      // Sandalye
      { x: 4.2, z: 7.0, w: 0.4, h: 0.45, d: 0.4, c: 0x6a86a8 },
      // Raf/kitaplık
      { x: 5.7, y: 0.5, z: 7.7, w: 1.0, h: 1.0, d: 0.25, c: 0xa68868 },
    ],
    banyo: [
      // Lavabo
      { x: -2.6, z: -4.4, w: 0.65, h: 0.85, d: 0.45, c: 0xfafafa },
      { x: -2.6, y: 1.45, z: -4.3, w: 0.6, h: 0.6, d: 0.04, c: 0xeeeeee }, // ayna
      // Klozet
      { x: -1.4, z: -5.0, w: 0.4, h: 0.4, d: 0.55, c: 0xfafafa },
      { x: -1.4, y: 0.55, z: -5.2, w: 0.4, h: 0.5, d: 0.12, c: 0xfafafa }, // tank
      // Duş kabini camı
      { x: -2.6, z: -6.3, w: 0.95, h: 2.1, d: 1.0, c: 0xaacfdd, opacity: 0.25 },
    ],
    balkon: [
      // Bistro masa
      { x: -6.0, z: 0.5, w: 0.7, h: 0.04, d: 0.7, c: 0x6a4f33 },
      { x: -6.0, y: 0.35, z: 0.5, w: 0.07, h: 0.7, d: 0.07, c: 0x6a4f33 },
      // 2 sandalye
      { x: -7.0, z: 0.5, w: 0.4, h: 0.45, d: 0.4, c: 0x5a4533 },
      { x: -5.0, z: 0.5, w: 0.4, h: 0.45, d: 0.4, c: 0x5a4533 },
      // Saksı + bitki
      { x: -7.5, z: -1.5, w: 0.4, h: 0.45, d: 0.4, c: 0x8a5a40 },
      { x: -7.5, y: 0.65, z: -1.5, w: 0.55, h: 0.7, d: 0.55, c: 0x4a7a3a },
    ],
    oturma: [
      // 2'li kanepe
      { x: 0, z: 7.4, w: 1.8, h: 0.45, d: 0.8, c: 0x6c7a8a },
      { x: 0, y: 0.85, z: 7.6, w: 1.8, h: 0.55, d: 0.3, c: 0x6c7a8a },
      // Iki koltuk
      { x: -2.0, z: 5.3, w: 0.85, h: 0.45, d: 0.85, c: 0x556673 },
      { x: -2.0, y: 0.85, z: 5.0, w: 0.85, h: 0.5, d: 0.3, c: 0x556673 },
      { x:  2.0, z: 5.3, w: 0.85, h: 0.45, d: 0.85, c: 0x556673 },
      { x:  2.0, y: 0.85, z: 5.0, w: 0.85, h: 0.5, d: 0.3, c: 0x556673 },
      // Sehpa
      { x: 0, z: 5.8, w: 1.0, h: 0.4, d: 0.5, c: 0x6a4f33 },
      // Halı
      { x: 0, y: 0.01, z: 6.6, w: 2.6, h: 0.02, d: 2.0, c: 0xa88a6c },
    ],
    giris: [
      // Konsol
      { x: 1.5, z: -6.7, w: 0.3, h: 0.85, d: 0.9, c: 0x6b5a40 },
      { x: 1.5, y: 1.55, z: -6.8, w: 0.3, h: 0.7, d: 0.04, c: 0xeeeeee }, // ayna
      // Ayakkabılık
      { x: -1.5, z: -6.7, w: 0.3, h: 0.5, d: 0.9, c: 0x6b5a40 },
      // Kilim
      { x: 0, y: 0.01, z: -5.5, w: 1.5, h: 0.02, d: 1.2, c: 0xa07060 },
    ],
  };

  let aptGroup = null;
  let aptWalls = [];  // AABB list for collision
  let fpsKeys = {};
  let fpsClock = null;
  let isPointerLocked = false;
  let fpsActive = false;
  const PLAYER_R = 0.35;
  const EYE_H = 1.65;
  const MOVE_SPD = 3.5;

  function getRoom(id) { return APT_ROOMS.find(r => r.id === id); }

  // İki odanın paylaşılan kenarını bul: dönen { axis: 'x'|'z', pos, t1, t2 }
  function sharedEdge(a, b) {
    // Vertical edge (x sabit)
    if (Math.abs(a.x2 - b.x1) < 0.001) {
      const t1 = Math.max(a.z1, b.z1), t2 = Math.min(a.z2, b.z2);
      if (t2 > t1) return { axis: 'x', pos: a.x2, t1, t2 };
    }
    if (Math.abs(b.x2 - a.x1) < 0.001) {
      const t1 = Math.max(a.z1, b.z1), t2 = Math.min(a.z2, b.z2);
      if (t2 > t1) return { axis: 'x', pos: a.x1, t1, t2 };
    }
    // Horizontal edge (z sabit)
    if (Math.abs(a.z2 - b.z1) < 0.001) {
      const t1 = Math.max(a.x1, b.x1), t2 = Math.min(a.x2, b.x2);
      if (t2 > t1) return { axis: 'z', pos: a.z2, t1, t2 };
    }
    if (Math.abs(b.z2 - a.z1) < 0.001) {
      const t1 = Math.max(a.x1, b.x1), t2 = Math.min(a.x2, b.x2);
      if (t2 > t1) return { axis: 'z', pos: a.z1, t1, t2 };
    }
    return null;
  }

  // Bir kenarda kapı boşluğu hesapla (ortada 1.2m geniş)
  function doorGap(t1, t2) {
    const mid = (t1 + t2) / 2;
    const dw = 1.2;
    return { gap1: Math.max(t1, mid - dw/2), gap2: Math.min(t2, mid + dw/2) };
  }

  // Wall segment ekle (collision + mesh) — düz krem duvar
  function addWallSegment(group, axis, pos, t1, t2) {
    if (t2 - t1 < 0.05) return;
    const len = t2 - t1;
    const mid = (t1 + t2) / 2;
    const wallThick = 0.12;
    const wallGeo = new THREE.BoxGeometry(
      axis === 'x' ? wallThick : len,
      WALL_H,
      axis === 'x' ? len : wallThick
    );
    const mat = new THREE.MeshStandardMaterial({ color: 0xeae0d0, roughness: 0.9 });
    const mesh = new THREE.Mesh(wallGeo, mat);
    if (axis === 'x') {
      mesh.position.set(pos, WALL_H/2, mid);
    } else {
      mesh.position.set(mid, WALL_H/2, pos);
    }
    group.add(mesh);
    // AABB for collision
    const half = wallThick / 2 + PLAYER_R;
    if (axis === 'x') {
      aptWalls.push({ minX: pos - half, maxX: pos + half, minZ: t1 - PLAYER_R, maxZ: t2 + PLAYER_R });
    } else {
      aptWalls.push({ minX: t1 - PLAYER_R, maxX: t2 + PLAYER_R, minZ: pos - half, maxZ: pos + half });
    }
  }

  // Mobilyaları odaya yerleştir
  function addFurniture(group, roomId) {
    const items = FURNITURE[roomId];
    if (!items) return;
    items.forEach(it => {
      const w = it.w, h = it.h, d = it.d;
      const x = it.x, z = it.z;
      const y = it.y !== undefined ? it.y + h/2 : h/2;
      const mat = new THREE.MeshStandardMaterial({
        color: it.c,
        roughness: 0.75,
        metalness: 0.05,
        transparent: it.opacity !== undefined,
        opacity: it.opacity ?? 1
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      group.add(mesh);
    });
  }

  // Duvara küçük çerçeveli fotoğraf as (oda referansı için)
  function addPhotoFrame(group, room) {
    if (!room.photo || !room.pwall) return;
    const tex = loadTex(room.photo);
    const frameW = 1.6, frameH = 1.1;
    const padding = 0.06;
    // Çerçeve (arka)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2e20, roughness: 0.5 });
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(frameW + padding*2, frameH + padding*2, 0.05),
      frameMat
    );
    // İç görüntü
    const photoMat = new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, toneMapped: false });
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(frameW, frameH), photoMat);

    const cx = (room.x1 + room.x2) / 2;
    const cz = (room.z1 + room.z2) / 2;
    const wallOffset = 0.08;
    const yPos = 1.6;
    let fx = cx, fz = cz, rotY = 0;
    if (room.pwall === 'N') { fz = room.z2 - wallOffset; rotY = Math.PI; }
    else if (room.pwall === 'S') { fz = room.z1 + wallOffset; rotY = 0; }
    else if (room.pwall === 'E') { fx = room.x2 - wallOffset; rotY = -Math.PI/2; }
    else if (room.pwall === 'W') { fx = room.x1 + wallOffset; rotY = Math.PI/2; }
    frame.position.set(fx, yPos, fz);
    frame.rotation.y = rotY;
    photo.position.copy(frame.position);
    photo.rotation.y = rotY;
    // Photo hafifçe çerçevenin önünde
    const nudge = 0.035;
    if (room.pwall === 'N') photo.position.z -= nudge;
    else if (room.pwall === 'S') photo.position.z += nudge;
    else if (room.pwall === 'E') photo.position.x -= nudge;
    else if (room.pwall === 'W') photo.position.x += nudge;
    group.add(frame);
    group.add(photo);
  }

  function buildApartment() {
    if (aptGroup) return;
    aptGroup = new THREE.Group();
    aptWalls = [];

    // Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    aptGroup.add(amb);
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.8);
    sun.position.set(8, 20, 5);
    aptGroup.add(sun);
    // Multiple ceiling lights (one per room)
    APT_ROOMS.forEach(r => {
      const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
      const light = new THREE.PointLight(0xfff4d8, 1.2, 12, 1.5);
      light.position.set(cx, WALL_H - 0.3, cz);
      aptGroup.add(light);
    });

    // Floor & ceiling for each room
    APT_ROOMS.forEach(r => {
      const w = r.x2 - r.x1, d = r.z2 - r.z1;
      const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
      // Floor
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color: 0xb89970, roughness: 0.7 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, 0, cz);
      aptGroup.add(floor);
      // Ceiling
      const ceil = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color: 0xf5efe6, roughness: 0.95 })
      );
      ceil.rotation.x = Math.PI / 2;
      ceil.position.set(cx, WALL_H, cz);
      aptGroup.add(ceil);
    });

    // Walls — her oda için 4 duvar, kapı yerlerinde gap bırak
    APT_ROOMS.forEach(r => {
      const doorsOn = { N: [], S: [], E: [], W: [] };
      APT_DOORS.forEach(([a, b]) => {
        if (a !== r.id && b !== r.id) return;
        const other = getRoom(a === r.id ? b : a);
        const edge = sharedEdge(r, other);
        if (!edge) return;
        let wall;
        if (edge.axis === 'x') wall = (edge.pos === r.x2) ? 'E' : 'W';
        else                    wall = (edge.pos === r.z2) ? 'N' : 'S';
        doorsOn[wall].push(doorGap(edge.t1, edge.t2));
      });

      const wallDefs = [
        { wall: 'N', axis: 'z', pos: r.z2, t1: r.x1, t2: r.x2 },
        { wall: 'S', axis: 'z', pos: r.z1, t1: r.x1, t2: r.x2 },
        { wall: 'E', axis: 'x', pos: r.x2, t1: r.z1, t2: r.z2 },
        { wall: 'W', axis: 'x', pos: r.x1, t1: r.z1, t2: r.z2 },
      ];

      wallDefs.forEach(w => {
        const gaps = doorsOn[w.wall] || [];
        if (gaps.length === 0) {
          addWallSegment(aptGroup, w.axis, w.pos, w.t1, w.t2);
        } else {
          const sorted = gaps.slice().sort((a, b) => a.gap1 - b.gap1);
          let cursor = w.t1;
          sorted.forEach(g => {
            if (g.gap1 > cursor) addWallSegment(aptGroup, w.axis, w.pos, cursor, g.gap1);
            cursor = g.gap2;
          });
          if (cursor < w.t2) addWallSegment(aptGroup, w.axis, w.pos, cursor, w.t2);
        }
      });

      // 3D mobilya + duvarda küçük çerçeveli foto
      addFurniture(aptGroup, r.id);
      addPhotoFrame(aptGroup, r);
    });
  }

  function enterPhotoTour(idx) {
    if (mode === 'photo') return;
    mode = 'photo';
    fpsActive = true;
    autoRotate = false;
    clearTimeout(autoTimer);

    // Hide building exterior
    if (buildingGroup) buildingGroup.visible = false;
    scene.children.forEach(c => {
      // Hide ground, ring, halo
      if (c.geometry?.type === 'CircleGeometry' || c.geometry?.type === 'RingGeometry') c.visible = false;
    });

    // Build apartment if not built
    if (!aptGroup) buildApartment();
    aptGroup.visible = true;
    scene.add(aptGroup);

    // Background → warm interior
    scene.background = new THREE.Color(0xd5ccb9);
    scene.fog = null;

    // Camera başlangıç: Giriş'te
    const giris = getRoom('giris');
    const startX = (giris.x1 + giris.x2) / 2;
    const startZ = (giris.z1 + giris.z2) / 2;
    camera.position.set(startX, EYE_H, startZ);
    camera.fov = 70;
    camera.updateProjectionMatrix();
    yaw = 0;     // başlangıçta kuzey'e bak (salon yönü)
    pitch = 0;
    updateFpsLook();

    fpsClock = new THREE.Clock();
    fpsKeys = {};
    currentRoomIdx = 0;
    updateFpsUI();

    // UI swap
    const orbitUI = document.getElementById('vrOrbitUI');
    const fpsUI   = document.getElementById('vrFpsUI');
    if (orbitUI) orbitUI.style.display = 'none';
    if (fpsUI)   fpsUI.style.display   = 'block';
  }

  function updateFpsLook() {
    const tx = camera.position.x + Math.sin(yaw) * Math.cos(pitch);
    const ty = camera.position.y + Math.sin(pitch);
    const tz = camera.position.z + Math.cos(yaw) * Math.cos(pitch);
    camera.lookAt(tx, ty, tz);
  }

  function fpsTick(dt) {
    let mx = 0, mz = 0;
    if (fpsKeys['w'] || fpsKeys['arrowup'])    mz -= 1;
    if (fpsKeys['s'] || fpsKeys['arrowdown'])  mz += 1;
    if (fpsKeys['a'] || fpsKeys['arrowleft'])  mx -= 1;
    if (fpsKeys['d'] || fpsKeys['arrowright']) mx += 1;
    // Joystick (mobil)
    if (joyActive) {
      mx += joyVec.x;
      mz += joyVec.y;
    }
    if (Math.abs(mx) < 0.01 && Math.abs(mz) < 0.01) return;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    // forward in world coords
    const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
    const rgtX = Math.cos(yaw), rgtZ = -Math.sin(yaw);
    const dx = (mx * rgtX + mz * (-fwdX)) * MOVE_SPD * dt;
    const dz = (mx * rgtZ + mz * (-fwdZ)) * MOVE_SPD * dt;

    // Move with collision (separate axes)
    let newX = camera.position.x + dx;
    let newZ = camera.position.z;
    if (!collides(newX, newZ)) camera.position.x = newX;
    newX = camera.position.x;
    newZ = camera.position.z + dz;
    if (!collides(newX, newZ)) camera.position.z = newZ;

    updateFpsLook();
    detectRoom();
  }

  function collides(x, z) {
    for (const w of aptWalls) {
      if (x > w.minX && x < w.maxX && z > w.minZ && z < w.maxZ) return true;
    }
    return false;
  }

  let lastRoomId = null;
  function detectRoom() {
    const px = camera.position.x, pz = camera.position.z;
    for (const r of APT_ROOMS) {
      if (px > r.x1 && px < r.x2 && pz > r.z1 && pz < r.z2) {
        if (lastRoomId !== r.id) {
          lastRoomId = r.id;
          const label = document.getElementById('vrRoomIndicator');
          if (label) label.textContent = r.label;
        }
        return;
      }
    }
  }

  function updateFpsUI() {
    const apt   = document.getElementById('vrAptInfo');
    if (apt)   apt.textContent   = `Daire 4+1 · WASD ile yürü`;
    const dots = document.getElementById('vrRoomDots');
    if (dots) dots.innerHTML = '';
  }

  function teleportToRoom(id) {
    const r = getRoom(id);
    if (!r) return;
    const cx = (r.x1 + r.x2) / 2;
    const cz = (r.z1 + r.z2) / 2;
    setTimeout(() => {
      camera.position.set(cx, EYE_H, cz);
      lastRoomId = null;
      detectRoom();
    }, 100);
  }

  function cycleRoom(dir) {
    if (mode !== 'photo') return;
    const idx = APT_ROOMS.findIndex(r => r.id === lastRoomId);
    let next = (idx >= 0 ? idx + dir : 0);
    if (next < 0) next = APT_ROOMS.length - 1;
    if (next >= APT_ROOMS.length) next = 0;
    teleportToRoom(APT_ROOMS[next].id);
  }

  function exitPhotoTour() {
    if (mode !== 'photo') return;
    mode = 'orbit';
    fpsActive = false;
    if (aptGroup) aptGroup.visible = false;
    // Show building & ground
    if (buildingGroup) buildingGroup.visible = true;
    scene.children.forEach(c => {
      if (c.geometry?.type === 'CircleGeometry' || c.geometry?.type === 'RingGeometry') c.visible = true;
    });
    scene.background = new THREE.Color(0x0a0e18);

    camera.fov = 50;
    camera.updateProjectionMatrix();
    updateOrbitCamera();

    // Exit pointer lock
    if (document.pointerLockElement) document.exitPointerLock();

    const orbitUI = document.getElementById('vrOrbitUI');
    const fpsUI   = document.getElementById('vrFpsUI');
    if (orbitUI) orbitUI.style.display = 'block';
    if (fpsUI)   fpsUI.style.display   = 'none';
    armAutoRotate();
  }
  window.exitVRFPS = exitPhotoTour;

  // Joystick state (mobil hareket)
  let joyActive = false;
  let joyVec = { x: 0, y: 0 }; // -1..1
  let joyTouchId = null;
  let lookTouchId = null;
  let lookLastP = { x: 0, y: 0 };

  // Pointer lock + WASD + touch setup
  function setupFpsControls() {
    const canvas = document.getElementById('vrCanvas');

    // Desktop: tıkla → pointer lock
    canvas.addEventListener('click', () => {
      if (mode === 'photo' && !isPointerLocked && !isTouchDevice()) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = (document.pointerLockElement === canvas);
      const hint = document.getElementById('vrFpsHud');
      if (hint) hint.textContent = isPointerLocked ? 'WASD ile yürü · Fareyi hareket ettir' : 'Fareyi kilitle — Tıkla';
    });
    document.addEventListener('mousemove', e => {
      if (!isPointerLocked || mode !== 'photo') return;
      yaw   -= e.movementX * 0.0025;
      pitch -= e.movementY * 0.0025;
      pitch = Math.max(-1.4, Math.min(1.4, pitch));
      updateFpsLook();
    });
    document.addEventListener('keydown', e => {
      if (mode === 'photo' && fpsActive) {
        fpsKeys[e.key.toLowerCase()] = true;
        if (e.key === 'Escape') exitPhotoTour();
      }
    });
    document.addEventListener('keyup', e => {
      fpsKeys[e.key.toLowerCase()] = false;
    });

    // Mobil: touch joystick + bakış kontrolü
    const joystickEl = document.getElementById('vrJoystick');
    const joyKnob    = document.getElementById('vrJoyKnob');
    if (joystickEl) {
      const handleJoyStart = e => {
        const t = e.touches ? e.touches[0] : e;
        joyActive = true;
        joyTouchId = e.touches ? t.identifier : 'mouse';
        const rect = joystickEl.getBoundingClientRect();
        joystickEl.dataset.cx = rect.left + rect.width / 2;
        joystickEl.dataset.cy = rect.top + rect.height / 2;
        joystickEl.dataset.r = rect.width / 2;
        updateJoy(t.clientX, t.clientY);
        e.preventDefault();
      };
      joystickEl.addEventListener('touchstart', handleJoyStart, { passive: false });
      joystickEl.addEventListener('mousedown', handleJoyStart);
    }

    function updateJoy(x, y) {
      const cx = +joystickEl.dataset.cx, cy = +joystickEl.dataset.cy, r = +joystickEl.dataset.r;
      const dx = x - cx, dy = y - cy;
      const len = Math.hypot(dx, dy);
      const max = r * 0.85;
      const k = len > max ? max / len : 1;
      joyVec.x = (dx * k) / max;
      joyVec.y = (dy * k) / max;
      if (joyKnob) joyKnob.style.transform = `translate(${dx*k}px, ${dy*k}px)`;
    }

    document.addEventListener('touchmove', e => {
      if (mode !== 'photo' || !fpsActive) return;
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) {
          updateJoy(t.clientX, t.clientY);
          e.preventDefault();
        } else if (t.identifier === lookTouchId) {
          const dx = t.clientX - lookLastP.x;
          const dy = t.clientY - lookLastP.y;
          lookLastP = { x: t.clientX, y: t.clientY };
          yaw   -= dx * 0.005;
          pitch -= dy * 0.005;
          pitch = Math.max(-1.4, Math.min(1.4, pitch));
          updateFpsLook();
          e.preventDefault();
        }
      }
    }, { passive: false });

    document.addEventListener('touchstart', e => {
      if (mode !== 'photo' || !fpsActive) return;
      for (const t of e.changedTouches) {
        // Joystick alanına denk düşmüyorsa look touch
        const onJoy = joystickEl && joystickEl.contains(t.target);
        if (onJoy) continue;
        if (lookTouchId === null && t.target.tagName === 'CANVAS') {
          lookTouchId = t.identifier;
          lookLastP = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: false });

    document.addEventListener('touchend', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === joyTouchId) {
          joyActive = false;
          joyTouchId = null;
          joyVec.x = 0; joyVec.y = 0;
          if (joyKnob) joyKnob.style.transform = 'translate(0,0)';
        }
        if (t.identifier === lookTouchId) lookTouchId = null;
      }
    });

    document.addEventListener('mouseup', () => {
      if (joyTouchId === 'mouse') {
        joyActive = false;
        joyTouchId = null;
        joyVec.x = 0; joyVec.y = 0;
        if (joyKnob) joyKnob.style.transform = 'translate(0,0)';
      }
    });
  }

  function isTouchDevice() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }

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
      if (mode !== 'orbit') return;  // FPS modunda pointer-lock kullanıyoruz
      const dx = x - lastP.x;
      const dy = y - lastP.y;
      lastP = { x, y };
      sph.theta -= dx * 0.006;
      sph.phi = Math.max(0.25, Math.min(1.55, sph.phi - dy * 0.005));
      updateOrbitCamera();
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
        e.preventDefault();
      }
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

    // UI: oda butonuna tıklayınca FPS moda gir + o odaya teleport
    document.addEventListener('click', e => {
      const t = e.target.closest('[data-vr-room]');
      if (t) {
        const id = t.getAttribute('data-vr-room');
        if (mode === 'orbit') enterPhotoTour(0);
        teleportToRoom(id);
      }
      const prev = e.target.closest('#vrPrevRoom');
      if (prev) cycleRoom(-1);
      const next = e.target.closest('#vrNextRoom');
      if (next) cycleRoom(1);
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
      if (mode === 'photo' && fpsActive && fpsClock) {
        const dt = Math.min(fpsClock.getDelta(), 0.05);
        fpsTick(dt);
      }
      renderer.render(scene, camera);
    }
    tick();
  }

})();
