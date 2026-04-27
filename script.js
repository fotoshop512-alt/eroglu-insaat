/* ============================================
   EROĞLU İNŞAAT — Ultra Premium JavaScript
   3D Building, Scrollytelling, Micro-Interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── Preloader ───
  const preloader = document.getElementById('preloader');
  window.addEventListener('load', () => {
    setTimeout(() => preloader.classList.add('hidden'), 2400);
  });
  // Fallback
  setTimeout(() => preloader.classList.add('hidden'), 3500);

  // ─── Cursor Glow (desktop only) ───
  const cursorGlow = document.getElementById('cursorGlow');
  let mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;

  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    (function animGlow() {
      glowX += (mouseX - glowX) * 0.06;
      glowY += (mouseY - glowY) * 0.06;
      cursorGlow.style.left = glowX + 'px';
      cursorGlow.style.top = glowY + 'px';
      requestAnimationFrame(animGlow);
    })();
  } else {
    cursorGlow.style.display = 'none';
  }

  // ─── Navbar Scroll ───
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  // ─── Mobile Menu ───
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });

  // ─── Hero Particles ───
  const particlesContainer = document.getElementById('heroParticles');
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 10 + 's';
    p.style.animationDuration = (7 + Math.random() * 8) + 's';
    const s = (1 + Math.random() * 3) + 'px';
    p.style.width = s;
    p.style.height = s;
    p.style.background = Math.random() > 0.5
      ? 'var(--cyan-primary)'
      : 'var(--gold-primary)';
    p.style.boxShadow = Math.random() > 0.5
      ? '0 0 6px var(--cyan-glow)'
      : '0 0 6px var(--gold-glow)';
    particlesContainer.appendChild(p);
  }

  // ─── 3D Building Generator ───
  const building = document.getElementById('building3d');
  const floorCount = 8;
  const floorHeight = 50;
  const gap = 4;
  const totalHeight = floorCount * (floorHeight + gap);

  for (let i = 0; i < floorCount; i++) {
    const floor = document.createElement('div');
    floor.classList.add('building-floor');
    floor.style.bottom = i * (floorHeight + gap) + 'px';
    floor.style.height = floorHeight + 'px';
    floor.dataset.floor = i;

    // Create 4 faces
    ['front', 'back', 'left', 'right', 'top'].forEach(face => {
      const div = document.createElement('div');
      div.classList.add('face', face);

      if (face === 'front' || face === 'back') {
        // Add windows
        const windowCount = 8;
        const windowRow = document.createElement('div');
        windowRow.style.display = 'flex';
        windowRow.style.flexWrap = 'wrap';
        windowRow.style.justifyContent = 'center';
        windowRow.style.alignItems = 'center';
        windowRow.style.padding = '4px';
        windowRow.style.gap = '3px';
        windowRow.style.height = '100%';
        windowRow.style.position = 'relative';
        windowRow.style.zIndex = '1';

        for (let w = 0; w < windowCount; w++) {
          const win = document.createElement('div');
          win.classList.add('floor-window');

          // Random lighting
          const rand = Math.random();
          if (rand > 0.6) win.classList.add('lit');
          else if (rand > 0.45) win.classList.add('cyan-lit');

          windowRow.appendChild(win);
        }
        div.appendChild(windowRow);
      }

      // Gradient variation per floor
      const hue = 15 + i * 3;
      if (face !== 'top') {
        div.style.background = `linear-gradient(135deg, rgba(${10 + i * 2}, ${10 + i * 2}, ${25 + i * 3}, 0.92), rgba(${15 + i * 3}, ${15 + i * 3}, ${35 + i * 4}, 0.85))`;
      } else {
        div.style.background = `linear-gradient(135deg, rgba(${20 + i * 3}, ${20 + i * 3}, ${40 + i * 4}, 0.95), rgba(${25 + i * 3}, ${25 + i * 3}, ${50 + i * 4}, 0.9))`;
      }

      floor.appendChild(div);
    });

    building.appendChild(floor);
  }

  // Set building height
  building.style.height = totalHeight + 'px';

  // ─── 3D Building Mouse Tracking ───
  const buildingWrapper = document.querySelector('.building-3d-wrapper');
  if (buildingWrapper) {
    buildingWrapper.addEventListener('mousemove', e => {
      if (building.classList.contains('exploded')) return;
      const rect = buildingWrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      building.style.transform = `rotateY(${x * 30}deg) rotateX(${-y * 15}deg)`;
    });

    buildingWrapper.addEventListener('mouseleave', () => {
      if (building.classList.contains('exploded')) return;
      building.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      building.style.transform = 'rotateY(-15deg) rotateX(5deg)';
      setTimeout(() => building.style.transition = 'none', 800);
    });
  }

  // ─── Window Lighting Animation ───
  function randomizeWindows() {
    document.querySelectorAll('.floor-window').forEach(w => {
      if (Math.random() > 0.85) {
        w.classList.toggle('lit');
        w.classList.toggle('cyan-lit', Math.random() > 0.5);
      }
    });
  }
  setInterval(randomizeWindows, 2000);

  // ─── Counter Animation ───
  function animateCounters() {
    document.querySelectorAll('.stat-number[data-count], .hero-stat-number[data-count]').forEach(counter => {
      if (counter.dataset.animated) return;
      const target = parseInt(counter.dataset.count);
      const duration = 2200;
      const start = performance.now();

      (function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = Math.floor(target * eased).toLocaleString('tr-TR');
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = target.toLocaleString('tr-TR') + '+';
          counter.dataset.animated = 'true';
        }
      })(performance.now());
    });
  }

  // ─── Scroll Reveal ───
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        if (entry.target.closest('#stats') || entry.target.closest('.hero-stats')) {
          animateCounters();
        }
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => revealObs.observe(el));

  // Hero stats counter trigger
  const heroObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(animateCounters, 3000);
        heroObs.disconnect();
      }
    });
  });
  const heroSection = document.getElementById('hero');
  if (heroSection) heroObs.observe(heroSection);

  // ─── Testimonials Slider ───
  const testimonials = [
    {
      quote: 'Eroğlu İnşaat ile çalışmak büyük bir ayrıcalıktı. Projenin her aşamasında profesyonel yaklaşımları ve kalite anlayışları bizi çok memnun etti. Hayalimizdeki evi kusursuz bir şekilde inşa ettiler.',
      author: 'Mehmet Yılmaz',
      role: 'Park Residence Sahibi'
    },
    {
      quote: 'Ticari projemizde Eroğlu İnşaat\'ın mühendislik kabiliyetini ve zamanında teslimat disiplinini takdir ediyoruz. Golden Plaza projemiz, beklentilerimizin çok ötesinde bir başarı oldu.',
      author: 'Ayşe Kaya',
      role: 'Golden Plaza Yatırımcısı'
    },
    {
      quote: 'Sürdürülebilir yapı yaklaşımları ve modern mimari anlayışları ile sektördeki en iyi firmalardan biri. Villam için tercihim yine Eroğlu İnşaat olurdu.',
      author: 'Ali Demir',
      role: 'Villa Projesi Sahibi'
    }
  ];

  let currentT = 0;
  const quoteEl = document.getElementById('testimonialQuote');
  const authorEl = document.getElementById('testimonialAuthor');
  const roleEl = document.getElementById('testimonialRole');
  const dots = document.querySelectorAll('.testimonial-dot');
  const tCard = document.getElementById('testimonialCard');

  function showTestimonial(idx) {
    tCard.style.opacity = '0';
    tCard.style.transform = 'translateY(20px)';
    setTimeout(() => {
      quoteEl.textContent = testimonials[idx].quote;
      authorEl.textContent = testimonials[idx].author;
      roleEl.textContent = testimonials[idx].role;
      tCard.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      tCard.style.opacity = '1';
      tCard.style.transform = 'translateY(0)';
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    }, 350);
  }

  dots.forEach(d => d.addEventListener('click', () => {
    currentT = parseInt(d.dataset.index);
    showTestimonial(currentT);
  }));

  setInterval(() => {
    currentT = (currentT + 1) % testimonials.length;
    showTestimonial(currentT);
  }, 6000);

  // ─── Smooth Scroll ───
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = navbar.offsetHeight;
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY - offset,
          behavior: 'smooth'
        });
      }
    });
  });

  // ─── Parallax Effects ───
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;

        // Hero parallax
        const heroBg = document.querySelector('.hero-bg img');
        if (heroBg && scrollY < window.innerHeight * 1.2) {
          heroBg.style.transform = `scale(1.15) translateY(${scrollY * 0.25}px)`;
        }

        // Gradient orbs parallax
        document.querySelectorAll('.bg-gradient-orb').forEach(orb => {
          const rect = orb.parentElement.getBoundingClientRect();
          orb.style.transform = `translateY(${rect.top * 0.04}px)`;
        });

        // 3D scrollytelling — building rotation on scroll
        const buildingSection = document.getElementById('building-showcase');
        if (buildingSection && !building.classList.contains('exploded')) {
          const bRect = buildingSection.getBoundingClientRect();
          const bProgress = Math.max(0, Math.min(1,
            1 - (bRect.top + bRect.height) / (window.innerHeight + bRect.height)
          ));
          const rotY = -30 + bProgress * 60;
          const rotX = 10 - bProgress * 20;
          // Only apply scroll-based rotation if mouse isn't hovering
          if (!buildingWrapper.matches(':hover')) {
            building.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
          }
        }

        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // ─── Active Nav Link Highlight ───
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollPos = window.scrollY + 200;
    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      const link = document.querySelector(`.nav-links a[href="#${id}"]`);
      if (link && link.classList.contains('nav-link')) {
        if (scrollPos >= top && scrollPos < top + height) {
          document.querySelectorAll('.nav-links .nav-link').forEach(l => l.style.color = '');
          link.style.color = 'var(--gold-light)';
        }
      }
    });
  }, { passive: true });

  // ─── 3D Tilt on Project Cards ───
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) scale(1.02)`;
      card.style.transition = 'none';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    });
  });

  // ─── Magnetic Buttons ───
  document.querySelectorAll('.btn-primary, .btn-glass, .nav-cta, .explode-btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
      btn.style.transition = 'none';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    });
  });

  // ─── Ripple Effect on Buttons ───
  document.querySelectorAll('.btn-primary, .btn-glass').forEach(btn => {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // ─── Service Card Tilt ───
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-12px)`;

      // Move card glow
      const glow = card.querySelector('.service-card-glow');
      if (glow) {
        glow.style.left = (e.clientX - rect.left - 100) + 'px';
        glow.style.top = (e.clientY - rect.top - 100) + 'px';
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    });
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'none';
    });
  });

  // ─── Stat Card Hover Glow ───
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(212,168,83,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 100%)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.background = '';
    });
  });

});

// ─── Close Mobile Menu ───
function closeMobileMenu() {
  document.getElementById('hamburger').classList.remove('active');
  document.getElementById('mobileMenu').classList.remove('active');
  document.body.style.overflow = '';
}

// ─── Exploded View Toggle ───
function toggleExplode() {
  const building = document.getElementById('building3d');
  const btn = document.getElementById('explodeBtn');
  const isExploded = building.classList.toggle('exploded');
  btn.classList.toggle('active', isExploded);

  const floors = building.querySelectorAll('.building-floor');
  floors.forEach((floor, i) => {
    if (isExploded) {
      // Spread floors apart with varying offsets
      const spreadY = i * 25;
      const spreadX = (i % 2 === 0 ? -1 : 1) * (i * 8);
      const spreadZ = i * 10;
      floor.style.transform = `translateX(${spreadX}px) translateY(-${spreadY}px) translateZ(${spreadZ}px)`;
      floor.style.transition = `all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.08}s`;

      // Highlight floors
      floor.querySelectorAll('.face').forEach(face => {
        face.style.borderColor = 'rgba(212, 168, 83, 0.25)';
      });
    } else {
      floor.style.transform = '';
      floor.style.transition = `all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${(floors.length - i) * 0.05}s`;

      floor.querySelectorAll('.face').forEach(face => {
        face.style.borderColor = '';
      });
    }
  });

  // Set building rotation for exploded view
  if (isExploded) {
    building.style.transition = 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    building.style.transform = 'rotateY(25deg) rotateX(10deg)';
  } else {
    building.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    building.style.transform = 'rotateY(-15deg) rotateX(5deg)';
  }
}

// ─── Form Submit Handler ───
function handleFormSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  const originalContent = btn.innerHTML;

  btn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    Gönderiliyor...
  `;
  btn.disabled = true;
  btn.style.opacity = '0.7';

  setTimeout(() => {
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
      Mesajınız Gönderildi!
    `;
    btn.style.opacity = '1';
    btn.style.background = 'linear-gradient(135deg, #00e5ff, #00b2cc)';
    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.disabled = false;
      btn.style.background = '';
      e.target.reset();
    }, 3000);
  }, 2000);
}

// ─── Showcase Gallery Image Switcher ───
function changeShowcaseImg(thumb, src) {
  const mainImg = document.getElementById('showcaseMainImg');
  if (!mainImg) return;

  // Fade out
  mainImg.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  mainImg.style.opacity = '0';
  mainImg.style.transform = 'scale(1.03)';

  setTimeout(() => {
    mainImg.src = src;
    mainImg.style.opacity = '1';
    mainImg.style.transform = 'scale(1)';
  }, 300);

  // Update active thumb
  document.querySelectorAll('.showcase-thumb').forEach(t => t.classList.remove('active'));
  thumb.classList.add('active');
}

// ─── Interior Card Tilt ───
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.interior-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
      card.style.transition = 'none';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.transition = 'all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    });
  });
});

// Inject keyframe
const spinStyle = document.createElement('style');
spinStyle.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
document.head.appendChild(spinStyle);

// ─── Lightbox Gallery ───
document.addEventListener('DOMContentLoaded', () => {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  
  // Sadece projeler ve iç mekan görsellerini seç
  const galleryImages = Array.from(document.querySelectorAll('.project-card img, .interior-card img'));
  let currentIndex = 0;

  function openLightbox(index) {
    currentIndex = index;
    updateLightboxContent();
    lightbox.style.display = 'flex';
    // Küçük bir gecikme ile opacity'yi tetikle (geçiş efekti için)
    setTimeout(() => {
      lightbox.classList.add('active');
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    setTimeout(() => {
      lightbox.style.display = 'none';
    }, 300);
    document.body.style.overflow = '';
  }

  function updateLightboxContent() {
    const img = galleryImages[currentIndex];
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    
    // Caption bulma
    let captionText = img.alt;
    const projectCard = img.closest('.project-card');
    const interiorCard = img.closest('.interior-card');
    
    if (projectCard) {
      const title = projectCard.querySelector('.project-name');
      const cat = projectCard.querySelector('.project-category');
      if (title && cat) captionText = `${cat.textContent} — ${title.textContent}`;
    } else if (interiorCard) {
      const label = interiorCard.querySelector('.interior-label');
      if (label) captionText = label.textContent;
    }
    
    lightboxCaption.textContent = captionText;
  }

  function nextImage() {
    currentIndex = (currentIndex + 1) % galleryImages.length;
    updateLightboxContent();
  }

  function prevImage() {
    currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
    updateLightboxContent();
  }

  // Tıklama olaylarını ata
  galleryImages.forEach((img, index) => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openLightbox(index));
  });

  // Kontrol butonları olayları
  closeBtn.addEventListener('click', closeLightbox);
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextImage(); });
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevImage(); });
  
  // Dışarı tıklayınca kapatma
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Klavye kontrolleri
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  });
});
