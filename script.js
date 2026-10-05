gsap.registerPlugin(ScrollTrigger);

/* =========================================================
   1. CINEMATIC CANVAS HERO (ON-DEMAND FRAME LOADING)
   ========================================================= */
const canvas = document.getElementById("cinematic-canvas");
const context = canvas ? canvas.getContext("2d", { alpha: false }) : null;
const heroWrap = document.querySelector(".hero-canvas-wrap");
const heroContent = document.querySelector(".hero-content");

const heroFrameFiles = [...frameFiles].sort((first, second) => {
  const firstNumber = Number(first.match(/\((\d+)\)/)?.[1] || 0);
  const secondNumber = Number(second.match(/\((\d+)\)/)?.[1] || 0);
  return firstNumber - secondNumber;
});
const TOTAL_FRAMES = heroFrameFiles.length;
const pxPerFrame = 10;
const images = [];
const loadingFrames = new Set();
const queuedFrames = new Set();
const failedFrames = new Set();
const loadedFrameOrder = [];
const MAX_CONCURRENT_FRAME_LOADS = 4;
const MAX_CACHED_FRAMES = 24;
const FRAME_PREFETCH_RADIUS = 3;
let currentFrameIndex = 1;
let targetFrameIndex = 1;

if (heroWrap) {
  heroWrap.style.height = `${TOTAL_FRAMES * pxPerFrame}px`;
}

function resizeCanvas() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let frameToDraw = Math.round(currentFrameIndex);
  renderFrame(getClosestLoadedImage(frameToDraw));
}

function renderFrame(img) {
  if (!canvas || !context || !img || !img.complete || !img.naturalWidth) return;
  const canvasRatio = canvas.width / canvas.height;
  const imgRatio = img.width / img.height;
  let drawWidth, drawHeight;

  if (canvasRatio > imgRatio) {
    drawWidth = canvas.width;
    drawHeight = canvas.width / imgRatio;
  } else {
    drawHeight = canvas.height;
    drawWidth = canvas.height * imgRatio;
  }

  const x = (canvas.width - drawWidth) / 2;
  const y = (canvas.height - drawHeight) / 2;

  context.drawImage(img, x, y, drawWidth, drawHeight);
}

function getClosestLoadedImage(targetIdx) {
  const rounded = Math.round(targetIdx);
  if (images[rounded] && images[rounded].complete && images[rounded].naturalWidth) {
    return images[rounded];
  }
  for (let offset = 1; offset <= TOTAL_FRAMES; offset++) {
    const prev = rounded - offset;
    if (prev >= 1 && images[prev] && images[prev].complete && images[prev].naturalWidth) {
      return images[prev];
    }
    const next = rounded + offset;
    if (next <= TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth) {
      return images[next];
    }
  }
  return null;
}

function pumpFrameLoads() {
  while (loadingFrames.size < MAX_CONCURRENT_FRAME_LOADS) {
    const candidates = [...queuedFrames].filter(
      index => Math.abs(index - targetFrameIndex) <= FRAME_PREFETCH_RADIUS
    );
    if (!candidates.length) {
      queuedFrames.clear();
      return;
    }

    const idx = candidates.reduce((closest, index) =>
      Math.abs(index - targetFrameIndex) < Math.abs(closest - targetFrameIndex) ? index : closest
    );
    queuedFrames.delete(idx);
    loadingFrames.add(idx);

    const img = new Image();
    img.onload = () => {
      loadingFrames.delete(idx);
      images[idx] = img;
      loadedFrameOrder.splice(
        0,
        loadedFrameOrder.length,
        ...loadedFrameOrder.filter(index => images[index])
      );
      loadedFrameOrder.push(idx);

      while (loadedFrameOrder.length > MAX_CACHED_FRAMES) {
        const expiredPosition = loadedFrameOrder.findIndex(
          index => Math.abs(index - targetFrameIndex) > FRAME_PREFETCH_RADIUS
        );
        if (expiredPosition < 0) break;
        const [expiredIdx] = loadedFrameOrder.splice(expiredPosition, 1);
        delete images[expiredIdx];
      }

      if (idx === 1) resizeCanvas();
      renderFrame(getClosestLoadedImage(currentFrameIndex));
      pumpFrameLoads();
    };
    img.onerror = () => {
      loadingFrames.delete(idx);
      failedFrames.add(idx);
      console.error(`Unable to load hero frame: ${heroFrameFiles[idx - 1]}`);
      pumpFrameLoads();
    };
    img.src = heroFrameFiles[idx - 1];
  }
}

function loadFramesNearTarget() {
  const center = Math.round(targetFrameIndex);
  for (let offset = -FRAME_PREFETCH_RADIUS; offset <= FRAME_PREFETCH_RADIUS; offset++) {
    const idx = center + offset;
    if (
      idx >= 1 &&
      idx <= TOTAL_FRAMES &&
      !images[idx] &&
      !loadingFrames.has(idx) &&
      !failedFrames.has(idx)
    ) {
      queuedFrames.add(idx);
    }
  }
  pumpFrameLoads();
}

loadFramesNearTarget();

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function updateHeroScroll() {
  if (!heroWrap) return;
  const heroHeight = heroWrap.offsetHeight - window.innerHeight;
  if (heroHeight <= 0) return;
  
  const scrollTop = Math.max(0, -heroWrap.getBoundingClientRect().top);
  const scrollFraction = Math.max(0, Math.min(1, scrollTop / heroHeight));

  if (heroContent) {
    if (scrollFraction > 0.22) {
      heroContent.style.opacity = Math.max(0, 1 - (scrollFraction - 0.22) * 3.5);
    } else {
      heroContent.style.opacity = 1;
    }
  }

  targetFrameIndex = scrollFraction * (TOTAL_FRAMES - 1) + 1;
  loadFramesNearTarget();
}

window.addEventListener("scroll", updateHeroScroll, { passive: true });
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function heroAnimLoop() {
  // Smooth interpolation with quick response
  if (Math.abs(currentFrameIndex - targetFrameIndex) > 0.001) {
    currentFrameIndex = lerp(currentFrameIndex, targetFrameIndex, 0.15);
  }
  const imgToDraw = getClosestLoadedImage(currentFrameIndex);
  if (imgToDraw) renderFrame(imgToDraw);
  requestAnimationFrame(heroAnimLoop);
}
heroAnimLoop();


/* =========================================================
   2. REVEAL ANIMATIONS ON SCROLL
   ========================================================= */
gsap.utils.toArray('.reveal').forEach(el => {
  gsap.to(el, {
    opacity: 1, y: 0, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%' }
  });
});

gsap.utils.toArray('.gal-item').forEach((el, i) => {
  gsap.fromTo(el, { opacity: 0, y: 26 }, {
    opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: (i % 6) * 0.06,
    scrollTrigger: { trigger: el, start: 'top 92%' }
  });
});


/* =========================================================
   3. VALUE PILLARS SPLIT-STICKY SCROLL
   ========================================================= */
const pillarRows = document.querySelectorAll('.pillar-row');
const pillarBgs = document.querySelectorAll('.pillar-bg');
const pillarBigNum = document.getElementById('pillarBigNum');
const pillarBigTag = document.getElementById('pillarBigTag');
const pillarProgress = document.querySelectorAll('.pillar-progress span');
const pillarTags = ['REIT Backed', 'Gated Community', 'Sustainable Design', 'Luxurious Living', 'Strategic Location', 'Retail Integration'];

function setActivePillar(idx) {
  pillarRows.forEach((r, i) => r.classList.toggle('active', i === idx));
  pillarBgs.forEach((b, i) => b.classList.toggle('active', i === idx));
  pillarProgress.forEach((p, i) => p.classList.toggle('done', i <= idx));
  if (pillarBigNum) pillarBigNum.textContent = String(idx + 1).padStart(2, '0');
  if (pillarBigTag) pillarBigTag.textContent = pillarTags[idx];
}

pillarRows.forEach((row, idx) => {
  ScrollTrigger.create({
    trigger: row,
    start: 'top 65%',
    end: 'bottom 35%',
    onEnter: () => setActivePillar(idx),
    onEnterBack: () => setActivePillar(idx)
  });
});


/* =========================================================
   4. AMENITIES HORIZONTAL GALLERY
   ========================================================= */
function initAmenScroll() {
  const track = document.querySelector('.amen-track');
  const section = document.querySelector('.amenities');
  const bar = document.querySelector('.amen-progress-bar');
  if (!track || !section) return;

  ScrollTrigger.getById('amenScroll') && ScrollTrigger.getById('amenScroll').kill();

  const getScrollAmount = () => track.scrollWidth - window.innerWidth + 80;

  gsap.to(track, {
    x: () => -getScrollAmount(),
    ease: 'none',
    scrollTrigger: {
      id: 'amenScroll',
      trigger: '.amenities',
      start: 'top top',
      end: () => '+=' + getScrollAmount(),
      scrub: 0.8,
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: self => { if (bar) bar.style.width = (self.progress * 100) + '%'; }
    }
  });
}
window.addEventListener('load', () => {
  initAmenScroll();
  setTimeout(() => ScrollTrigger.refresh(), 300);
});
window.addEventListener('resize', initAmenScroll);


/* =========================================================
   5. FLOOR PLAN TABS & HOVER ZOOM
   ========================================================= */
function showPlan(idx) {
  const current = document.querySelector('.plan-view.active');
  const next = document.querySelector(`.plan-view[data-view="${idx}"]`);
  if (!next || current === next) return;

  document.querySelectorAll('.plan-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === String(idx)));

  gsap.to(current, {
    opacity: 0, y: 16, duration: .32, ease: 'power2.in', onComplete: () => {
      current.classList.remove('active');
      current.style.display = 'none';
      next.style.display = 'grid';
      next.classList.add('active');
      gsap.fromTo(next, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' });
      const img = next.querySelector('.plan-img img');
      if (img) gsap.fromTo(img, { scale: 0.92 }, { scale: 1, duration: .8, ease: 'power3.out' });
    }
  });
}

document.querySelectorAll('.plan-tab').forEach(tab => {
  tab.addEventListener('click', () => showPlan(tab.dataset.tab));
});

gsap.utils.toArray('.plan-img img').forEach(img => {
  gsap.fromTo(img, { scale: 0.94, opacity: 0.7 }, {
    scale: 1, opacity: 1, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: img, start: 'top 88%' }
  });
});

document.querySelectorAll('.plan-img').forEach(box => {
  const img = box.querySelector('img');
  if (!img) return;
  box.addEventListener('mousemove', e => {
    const rect = box.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = `${px}% ${py}%`;
  });
});


/* =========================================================
   6. FLOOR PLAN ZOOM MODAL
   ========================================================= */
const zoomModal = document.getElementById('zoomModal');
const zoomImg = document.getElementById('zoomImg');
const zoomStage = document.getElementById('zoomStage');
const zoomClose = document.getElementById('zoomClose');
let zScale = 1, zX = 0, zY = 0, dragging = false, lastX = 0, lastY = 0;

function openZoom(src) {
  if (!zoomImg || !zoomModal) return;
  zoomImg.src = src;
  zScale = 1; zX = 0; zY = 0;
  applyZoom();
  zoomModal.classList.add('open');
}

function closeZoom() {
  if (zoomModal) zoomModal.classList.remove('open');
}

function applyZoom() {
  if (zoomImg) zoomImg.style.transform = `translate(${zX}px, ${zY}px) scale(${zScale})`;
}

document.querySelectorAll('.plan-img').forEach(box => {
  box.addEventListener('click', () => {
    const img = box.querySelector('img');
    if (img) openZoom(img.getAttribute('src'));
  });
});

if (zoomClose) zoomClose.addEventListener('click', closeZoom);
if (zoomModal) {
  zoomModal.addEventListener('click', e => { if (e.target === zoomModal) closeZoom(); });
}

if (zoomStage) {
  zoomStage.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    zScale = Math.min(4, Math.max(1, zScale + delta));
    if (zScale === 1) { zX = 0; zY = 0; }
    applyZoom();
  }, { passive: false });

  zoomStage.addEventListener('pointerdown', e => {
    if (zScale === 1) return;
    dragging = true;
    zoomStage.classList.add('grabbing');
    lastX = e.clientX; lastY = e.clientY;
  });
}

window.addEventListener('pointermove', e => {
  if (!dragging) return;
  zX += (e.clientX - lastX);
  zY += (e.clientY - lastY);
  lastX = e.clientX; lastY = e.clientY;
  applyZoom();
});

window.addEventListener('pointerup', () => {
  dragging = false;
  if (zoomStage) zoomStage.classList.remove('grabbing');
});


/* =========================================================
   7. BOOK NOW BUTTON SMOOTH SCROLL
   ========================================================= */
document.querySelectorAll('.js-book-now').forEach(btn => {
  btn.addEventListener('click', () => {
    const contact = document.getElementById('contact');
    if (contact) contact.scrollIntoView({ behavior: 'smooth' });
  });
});
