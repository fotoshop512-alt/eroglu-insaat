/* ============================================================
   VR Gezinti — Three.js 3D Bina Turu
   Eroğlu İnşaat | Interaktif 3D Bina Modeli
   ============================================================ */

(function () {
  'use strict';

  const ROOMS = [
    { name: 'Salon',        img: 'assets/images/interior_salon.webp',   fallback: 'assets/images/interior_salon.jpg' },
    { name: 'Oturma Odası', img: 'assets/images/interior_oturma.webp',  fallback: 'assets/images/interior_oturma.jpg' },
    { name: 'Mutfak',       img: 'assets/images/interior_mutfak.webp',  fallback: 'assets/images/interior_mutfak.jpg' },
    { name: 'Yatak Odası',  img: 'assets/images/interior_yatak.webp',   fallback: 'assets/images/interior_yatak.jpg' },
    { name: 'Çocuk Odası',  img: 'assets/images/interior_cocuk.webp',   fallback: 'assets/images/interior_cocuk.jpg' },
    { name: 'Banyo',        img: 'assets/images/interior_banyo.webp',   fallback: 'assets/images/interior_banyo.jpg' },
    { name: 'Balkon',       img: 'assets/images/interior_balkon.webp',  fallback: 'assets/images/interior_balkon.jpg' },
  ];

  const APT_LABELS = ['A', 'B', 'C', 'D'];

  let currentRoom = 0;
  let currentApt = null;
  let vrScene = null;

  /* ─── WebP support check ─── */
  function supportsWebP() {
    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  }
  const webp = supportsWebP();

  function roomImg(room) {
    return webp ? room.img : room.fallback;
  }

  /* ─── Modal logic ─── */
  function openVrModal(floor, apt) {
    currentApt = { floor, apt };
    currentRoom = 0;

    const modal    = document.getElementById('vrModal');
    const title    = document.getElementById('vrModalTitle');
    const tabList  = document.getElementById('vrRoomTabs');
    const roomImg_ = document.getElementById('vrRoomImg');
    const roomName = document.getElementById('vrRoomName');

    title.textContent = `Kat ${floor} — Daire ${apt}`;

    tabList.innerHTML = ROOMS.map((r, i) =>
      `<button class="vr-room-tab${i === 0 ? ' active' : ''}" data-index="${i}" onclick="vrSelectRoom(${i})">${r.name}</button>`
    ).join('');

    roomImg_.src = roomImg(ROOMS[0]);
    roomName.textContent = ROOMS[0].name;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  window.openVrModal = openVrModal;

  function closeVrModal() {
    document.getElementById('vrModal').classList.remove('open');
    document.body.style.overflow = '';
  }
  window.closeVrModal = closeVrModal;

  function vrSelectRoom(index) {
    currentRoom = index;
    const roomImg_ = document.getElementById('vrRoomImg');
    const roomName = document.getElementById('vrRoomName');
    const tabs = document.querySelectorAll('.vr-room-tab');

    roomImg_.style.opacity = '0';
    setTimeout(() => {
      roomImg_.src = roomImg(ROOMS[index]);
      roomImg_.style.opacity = '1';
    }, 200);
    roomName.textContent = ROOMS[index].name;

    tabs.forEach((t, i) => t.classList.toggle('active', i === index));
  }
  window.vrSelectRoom = vrSelectRoom;

  function vrChangeRoom(dir) {
    const next = (currentRoom + dir + ROOMS.length) % ROOMS.length;
    vrSelectRoom(next);
  }
  window.vrChangeRoom = vrChangeRoom;

  /* ─── Init Three.js scene ─── */
  function initVRScene() {
    if (vrScene) return;
    if (!window.THREE) { console.warn('Three.js yüklenemedi'); return; }
    vrScene = true;

    const container = document.getElementById('vrCanvasWrapper');
    const canvas    = document.getElementById('vrCanvas');

    const W = () => container.clientWidth;
    const H = () => Math.min(Math.round(W() * 0.58), 620);

    /* Scene */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060c);
    scene.fog = new THREE.FogExp2(0x060610, 0.007);

    /* Camera */
    const camera = new THREE.PerspectiveCamera(45, W() / H(), 0.1, 600);

    /* Renderer */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W(), H());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0x1a2540, 3.0));

    const sun = new THREE.DirectionalLight(0xaabbd0, 4.0);
    sun.position.set(35, 70, 25);
    sun.castShadow = true;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far  = 250;
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top  =  90; sun.shadow.camera.bottom = -10;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const gold  = new THREE.PointLight(0xd4a853, 6, 80);
    gold.position.set(-18, 28, 18);
    scene.add(gold);

    const cyan  = new THREE.PointLight(0x00e5ff, 4, 70);
    cyan.position.set(18, 6, 28);
    scene.add(cyan);

    /* ── Ground ── */
    const groundGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x090910, shininess: 8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(200, 40, 0x1a2540, 0x0d1520);
    grid.position.y = 0.01;
    scene.add(grid);

    /* ── Building geometry constants ── */
    const FLOORS     = 10;
    const FH         = 3.4;   // floor height
    const GAP_FLOOR  = 0.12;  // slab thickness
    const BW         = 16;    // building width
    const BD         = 11;    // building depth
    const AW         = BW / 2;
    const AD         = BD / 2;
    const APT_GAP    = 0.10;

    const aptMeshes  = [];
    let   hoveredMesh = null;

    /* Floor-by-floor colors: deep navy → slightly lighter steel blue */
    function floorColor(f) {
      const t  = f / (FLOORS - 1);
      return new THREE.Color(
        0.08 + t * 0.06,
        0.11 + t * 0.08,
        0.22 + t * 0.12
      );
    }

    /* Window material helper */
    function makeWinMat(lit) {
      return new THREE.MeshPhongMaterial({
        color:    lit ? 0x001833 : 0x000c1a,
        emissive: lit ? new THREE.Color(1.0, 0.82, 0.3).multiplyScalar(0.25) : new THREE.Color(0, 0, 0),
        shininess: 200,
        transparent: true,
        opacity: 0.85,
      });
    }

    /* Add windows on front & back face of an apt block */
    function addWindows(aptPos, w, h, d) {
      const ww = w * 0.52, wh = h * 0.55;
      const geo = new THREE.PlaneGeometry(ww, wh);
      const lit = Math.random() > 0.35;

      [1, -1].forEach(side => {
        const m = new THREE.Mesh(geo, makeWinMat(lit));
        m.position.set(aptPos.x, aptPos.y, aptPos.z + side * (d / 2 + 0.02));
        if (side === -1) m.rotation.y = Math.PI;
        scene.add(m);
      });

      /* Side windows */
      const geoS = new THREE.PlaneGeometry(AD * 0.5, wh);
      [1, -1].forEach(side => {
        const m = new THREE.Mesh(geoS, makeWinMat(Math.random() > 0.4));
        m.position.set(aptPos.x + side * (w / 2 + 0.02), aptPos.y, aptPos.z);
        m.rotation.y = side * Math.PI / 2;
        scene.add(m);
      });
    }

    /* Build apartments */
    for (let f = 0; f < FLOORS; f++) {
      const y0 = f * (FH + GAP_FLOOR);

      /* Floor slab */
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(BW + 0.3, GAP_FLOOR, BD + 0.3),
        new THREE.MeshPhongMaterial({ color: 0x080c18, shininess: 15 })
      );
      slab.position.set(0, y0, 0);
      scene.add(slab);

      /* 4 apartment boxes per floor (2 cols × 2 rows) */
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const cx = (col - 0.5) * AW;
          const cz = (row - 0.5) * AD;
          const cy = y0 + GAP_FLOOR / 2 + FH / 2;

          const mat = new THREE.MeshPhongMaterial({
            color:     floorColor(f),
            shininess: 55,
            specular:  new THREE.Color(0x223355),
          });

          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(AW - APT_GAP, FH, AD - APT_GAP),
            mat
          );
          mesh.position.set(cx, cy, cz);
          mesh.castShadow    = true;
          mesh.receiveShadow = true;
          mesh.userData = {
            isApt:        true,
            floor:        f + 1,
            apt:          APT_LABELS[col + row * 2],
            defaultColor: floorColor(f).clone(),
          };
          scene.add(mesh);
          aptMeshes.push(mesh);

          addWindows(mesh.position, AW - APT_GAP, FH, AD - APT_GAP);
        }
      }
    }

    /* Top slab */
    const topY = FLOORS * (FH + GAP_FLOOR);
    const topSlab = new THREE.Mesh(
      new THREE.BoxGeometry(BW + 0.4, 0.22, BD + 0.4),
      new THREE.MeshPhongMaterial({ color: 0x070a16 })
    );
    topSlab.position.set(0, topY, 0);
    scene.add(topSlab);

    /* Penthouse */
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.5, 6),
      new THREE.MeshPhongMaterial({ color: 0x0e1428, shininess: 40 })
    );
    ph.position.set(-1, topY + 1.85, 0);
    ph.castShadow = true;
    scene.add(ph);

    /* Elevator/staircase core visible from sides */
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, topY + 5, 2.5),
      new THREE.MeshPhongMaterial({ color: 0x0b0e20 })
    );
    core.position.set(0, (topY + 5) / 2, 0);
    scene.add(core);

    /* Antenna */
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 6, 6),
      new THREE.MeshPhongMaterial({ color: 0x334466 })
    );
    ant.position.set(0, topY + 5.5 + 1.5, 0);
    scene.add(ant);

    /* ── Orbit camera ── */
    const TARGET = new THREE.Vector3(0, (FLOORS * FH) * 0.45, 0);
    let sph = { theta: -0.4, phi: 1.15, radius: 68 };
    let isDragging = false;
    let lastMouse  = { x: 0, y: 0 };
    let autoRotate = true;
    let autoTimer  = null;

    function updateCamera() {
      const s = sph;
      camera.position.set(
        TARGET.x + s.radius * Math.sin(s.phi) * Math.sin(s.theta),
        TARGET.y + s.radius * Math.cos(s.phi),
        TARGET.z + s.radius * Math.sin(s.phi) * Math.cos(s.theta)
      );
      camera.lookAt(TARGET);
    }
    updateCamera();

    function resumeAuto() {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => { autoRotate = true; }, 3500);
    }

    canvas.addEventListener('mousedown', e => {
      isDragging = true;
      autoRotate = false;
      clearTimeout(autoTimer);
      lastMouse = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', e => {
      if (isDragging) {
        sph.theta -= (e.clientX - lastMouse.x) * 0.007;
        sph.phi    = Math.max(0.18, Math.min(1.35, sph.phi + (e.clientY - lastMouse.y) * 0.005));
        lastMouse  = { x: e.clientX, y: e.clientY };
        updateCamera();
      } else {
        handleHover(e);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        canvas.style.cursor = 'grab';
        resumeAuto();
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      sph.radius = Math.max(28, Math.min(110, sph.radius + e.deltaY * 0.06));
      updateCamera();
      autoRotate = false;
      resumeAuto();
    }, { passive: false });

    /* Touch */
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      autoRotate = false;
      clearTimeout(autoTimer);
      if (e.touches.length === 1) {
        isDragging = true;
        lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        sph.theta -= (e.touches[0].clientX - lastMouse.x) * 0.009;
        sph.phi    = Math.max(0.18, Math.min(1.35, sph.phi + (e.touches[0].clientY - lastMouse.y) * 0.007));
        lastMouse  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        updateCamera();
      } else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        sph.radius = Math.max(28, Math.min(110, sph.radius - (d - lastTouchDist) * 0.12));
        lastTouchDist = d;
        updateCamera();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', () => {
      isDragging = false;
      resumeAuto();
    });

    /* ── Raycaster ── */
    const raycaster = new THREE.Raycaster();
    const mouse2D   = new THREE.Vector2();
    const tooltip   = document.getElementById('vrTooltip');

    function getNDC(e) {
      const r = canvas.getBoundingClientRect();
      mouse2D.x = ((e.clientX - r.left) / r.width)  *  2 - 1;
      mouse2D.y = ((e.clientY - r.top)  / r.height) * -2 + 1;
    }

    function handleHover(e) {
      if (!canvas.closest('#vr-tour')) return; // outside section
      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top  || e.clientY > rect.bottom) {
        if (hoveredMesh) {
          hoveredMesh.material.color.copy(hoveredMesh.userData.defaultColor);
          hoveredMesh.material.emissive.set(0);
          hoveredMesh = null;
        }
        tooltip.style.display = 'none';
        return;
      }

      getNDC(e);
      raycaster.setFromCamera(mouse2D, camera);
      const hits = raycaster.intersectObjects(aptMeshes);

      if (hoveredMesh && hoveredMesh !== hits[0]?.object) {
        hoveredMesh.material.color.copy(hoveredMesh.userData.defaultColor);
        hoveredMesh.material.emissive.set(0);
        hoveredMesh = null;
      }

      if (hits.length > 0) {
        hoveredMesh = hits[0].object;
        hoveredMesh.material.color.set(0xd4a853);
        hoveredMesh.material.emissive.setHex(0x2a1500);
        canvas.style.cursor = 'pointer';
        const { floor, apt } = hoveredMesh.userData;
        tooltip.textContent = `Kat ${floor} — Daire ${apt}`;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX - rect.left + 16) + 'px';
        tooltip.style.top  = (e.clientY - rect.top  - 38) + 'px';
      } else {
        canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
        tooltip.style.display = 'none';
      }
    }

    canvas.addEventListener('click', e => {
      getNDC(e);
      raycaster.setFromCamera(mouse2D, camera);
      const hits = raycaster.intersectObjects(aptMeshes);
      if (hits.length > 0) {
        const { floor, apt } = hits[0].object.userData;
        /* brief pulse animation */
        const mat = hits[0].object.material;
        mat.emissive.setHex(0x503010);
        setTimeout(() => mat.emissive.setHex(0x2a1500), 200);
        openVrModal(floor, apt);
      }
    });

    /* ── Animate ── */
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (autoRotate) {
        sph.theta += 0.0025;
        updateCamera();
      }

      /* Subtle light animation */
      gold.position.x = -18 + Math.sin(t * 0.25) * 4;
      cyan.position.z =  28 + Math.sin(t * 0.4)  * 5;

      renderer.render(scene, camera);
    }
    animate();

    /* ── Resize ── */
    window.addEventListener('resize', () => {
      renderer.setSize(W(), H());
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
    });

    canvas.style.cursor = 'grab';
  }

  /* ─── Lazy-init: start Three.js only when section is in view ─── */
  const section = document.getElementById('vr-tour');
  if (section) {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        initVRScene();
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(section);
  }

  /* ─── Close modal on Escape ─── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeVrModal();
    if (e.key === 'ArrowRight') vrChangeRoom(1);
    if (e.key === 'ArrowLeft')  vrChangeRoom(-1);
  });

})();
