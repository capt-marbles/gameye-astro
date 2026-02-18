const instances = new Map();
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function clampDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function makeParticle(width, height) {
  const size = 8 + Math.random() * 22;
  const speed = 0.15 + Math.random() * 0.85;

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() < 0.5 ? -1 : 1) * speed,
    vy: (Math.random() < 0.5 ? -1 : 1) * speed,
    size,
    angle: Math.random() * Math.PI * 2,
    rotateSpeed: Math.random() * 0.02 - 0.01,
    opacity: 0.15 + Math.random() * 0.25,
    opacityStep: 0.001 + Math.random() * 0.003,
  };
}

function drawParticle(ctx, particle, color) {
  const radius = particle.size;

  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.angle);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.866, radius * 0.5);
  ctx.lineTo(-radius * 0.866, radius * 0.5);
  ctx.closePath();
  ctx.fillStyle = `rgba(${color}, ${particle.opacity})`;
  ctx.fill();
  ctx.restore();
}

function setupCanvas(canvas) {
  if (instances.has(canvas)) return;

  const layer = canvas.closest(".gy-particles-layer");
  if (!layer) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const particleCount = Number(layer.dataset.count || 10);
  const color = layer.dataset.color || "61,255,207";
  const particles = [];

  let frame = 0;
  let width = 1;
  let height = 1;
  let running = false;
  let visible = !document.hidden;
  let inViewport = false;
  let observer = null;

  const resize = () => {
    const rect = layer.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);

    const dpr = clampDpr();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const ensureParticles = () => {
    if (particles.length > 0) return;

    particles.push(
      ...Array.from({ length: particleCount }, () => makeParticle(width, height))
    );
  };

  const tick = () => {
    if (!running) return;

    ctx.clearRect(0, 0, width, height);

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.angle += particle.rotateSpeed;
      particle.opacity += particle.opacityStep;

      if (particle.opacity < 0.15 || particle.opacity > 0.4) {
        particle.opacityStep *= -1;
      }

      if (particle.x < particle.size || particle.x > width - particle.size) {
        particle.vx *= -1;
      }

      if (particle.y < particle.size || particle.y > height - particle.size) {
        particle.vy *= -1;
      }

      drawParticle(ctx, particle, color);
    }

    frame = window.requestAnimationFrame(tick);
  };

  const shouldRun = () => !reducedMotionQuery.matches && visible && inViewport;

  const start = () => {
    if (running || !shouldRun()) return;

    ensureParticles();
    running = true;
    tick();
  };

  const stop = () => {
    running = false;

    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }

    ctx.clearRect(0, 0, width, height);
  };

  const sync = () => {
    if (shouldRun()) {
      start();
      return;
    }

    stop();
  };

  const onResize = () => {
    resize();
    sync();
  };

  const onVisibility = () => {
    visible = !document.hidden;
    sync();
  };

  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target !== layer) continue;
          inViewport = entry.isIntersecting;
          sync();
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(layer);
  } else {
    inViewport = true;
  }

  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  sync();

  instances.set(canvas, {
    sync,
    destroy() {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (observer) {
        observer.disconnect();
      }
    },
  });
}

function initAllParticleLayers() {
  document.querySelectorAll(".gy-particles-canvas").forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) {
      setupCanvas(canvas);
    }
  });
}

function handleMotionChange() {
  for (const instance of instances.values()) {
    instance.sync();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAllParticleLayers, { once: true });
} else {
  initAllParticleLayers();
}

if (typeof reducedMotionQuery.addEventListener === "function") {
  reducedMotionQuery.addEventListener("change", handleMotionChange);
} else if (typeof reducedMotionQuery.addListener === "function") {
  reducedMotionQuery.addListener(handleMotionChange);
}
