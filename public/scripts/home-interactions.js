function initHeroVideoBackground() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCompactViewport = window.matchMedia("(max-width: 768px)").matches;

  document.querySelectorAll("[data-hero-video]").forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;

    if (reduceMotion || isCompactViewport) {
      video.pause();
      video.removeAttribute("autoplay");
      return;
    }

    const src = video.dataset.videoSrc;
    if (!src || video.dataset.videoLoaded === "true") return;

    const loadVideo = () => {
      if (video.dataset.videoLoaded === "true") return;

      const source = document.createElement("source");
      source.src = src;
      source.type = "video/mp4";
      video.append(source);
      video.load();

      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }

      video.dataset.videoLoaded = "true";
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadVideo, { timeout: 1200 });
    } else {
      window.setTimeout(loadVideo, 260);
    }
  });
}

function initImageGridHover() {
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!canHover) return;

  const hoverClasses = [
    "hover-tile-1",
    "hover-tile-2",
    "hover-tile-3",
    "hover-tile-4",
    "hover-tile-5",
  ];

  const clearHoverState = (grid) => {
    grid.classList.remove(...hoverClasses);
  };

  const applyHoverState = (grid, tileIndex) => {
    clearHoverState(grid);
    grid.classList.add(`hover-tile-${tileIndex}`);
  };

  document.querySelectorAll(".image-grid").forEach((grid) => {
    if (!(grid instanceof HTMLElement)) return;

    grid.querySelectorAll(".tile").forEach((tile, index) => {
      if (!(tile instanceof HTMLElement)) return;
      tile.addEventListener("mouseenter", () => applyHoverState(grid, index + 1));
    });

    grid.addEventListener("mouseleave", () => clearHoverState(grid));
  });
}

function runTypewriter(section) {
  if (!(section instanceof HTMLElement) || section.dataset.bound === "true") return;
  section.dataset.bound = "true";

  const snippet = section.querySelector(".gameye-code-snippet-animated");
  const card = section.querySelector(".gameye-code-snippet");
  if (!(snippet instanceof HTMLElement) || !(card instanceof HTMLElement)) return;

  const fullText = snippet.textContent || "";
  snippet.textContent = "";
  card.classList.add("typing");

  let index = 0;
  const speed = 10;

  const typeNext = () => {
    index += 1;
    snippet.textContent = fullText.slice(0, index);

    if (index < fullText.length) {
      window.setTimeout(typeNext, speed);
    } else {
      window.setTimeout(() => {
        card.classList.remove("typing");
      }, 400);
    }
  };

  typeNext();
}

function initGameyeCodeTypewriter() {
  const sections = document.querySelectorAll("[data-gameye-code-section]");
  if (sections.length === 0) return;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!(entry.target instanceof HTMLElement)) return;
          if (!entry.isIntersecting) return;
          runTypewriter(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.35 }
    );

    sections.forEach((section) => {
      if (section instanceof HTMLElement) {
        observer.observe(section);
      }
    });

    return;
  }

  sections.forEach((section) => {
    runTypewriter(section);
  });
}

function formatNumber(value, decimals) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function animateMetric(element, index) {
  const target = Number(element.dataset.target || 0);
  const decimals = Number(element.dataset.decimals || 0);
  const prefix = element.dataset.prefix || "";
  const prefixAtEnd = element.dataset.prefixAtEnd === "true";
  const suffix = element.dataset.suffix || "";

  const duration = 760;
  const delay = index * 70;
  const start = performance.now() + delay;

  const renderValue = (rawValue, progress) => {
    const value = Math.min(target, rawValue);
    const shownPrefix = prefixAtEnd ? (progress >= 1 ? prefix : "") : prefix;
    element.textContent = `${shownPrefix}${formatNumber(value, decimals)}${suffix}`;
  };

  renderValue(0, 0);

  const tick = (now) => {
    if (now < start) {
      window.requestAnimationFrame(tick);
      return;
    }

    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    renderValue(target * eased, progress);

    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      renderValue(target, 1);
    }
  };

  window.requestAnimationFrame(tick);
}

function initStatsCounter() {
  const section = document.querySelector(".stats-section");
  if (!(section instanceof HTMLElement) || section.dataset.animated === "true") return;

  const values = Array.from(section.querySelectorAll(".stat-value"));
  if (values.length === 0) return;

  const startAnimation = () => {
    if (section.dataset.animated === "true") return;
    section.dataset.animated = "true";

    values.forEach((value, index) => {
      if (value instanceof HTMLElement) {
        animateMetric(value, index);
      }
    });
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    values.forEach((value) => {
      if (!(value instanceof HTMLElement)) return;

      const target = Number(value.dataset.target || 0);
      const decimals = Number(value.dataset.decimals || 0);
      const prefix = value.dataset.prefix || "";
      const suffix = value.dataset.suffix || "";
      value.textContent = `${prefix}${formatNumber(target, decimals)}${suffix}`;
    });

    section.dataset.animated = "true";
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          startAnimation();
          observer.disconnect();
          break;
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(section);
    return;
  }

  startAnimation();
}

function initVideoShowcase() {
  document.querySelectorAll("[data-video-shell]").forEach((shell) => {
    if (!(shell instanceof HTMLElement)) return;
    if (shell.dataset.bound === "true") return;
    shell.dataset.bound = "true";

    const button = shell.querySelector(".video-trigger");
    if (!(button instanceof HTMLButtonElement)) return;

    button.addEventListener("click", () => {
      if (shell.querySelector("video")) return;

      const src = shell.dataset.src || "";
      const poster = shell.dataset.poster || "";

      const video = document.createElement("video");
      video.controls = true;
      video.autoplay = true;
      video.preload = "metadata";
      video.poster = poster;
      video.playsInline = true;

      const source = document.createElement("source");
      source.src = src;
      source.type = "video/mp4";

      video.appendChild(source);
      shell.replaceChildren(video);
    });
  });
}

function initHomeInteractions() {
  initHeroVideoBackground();
  initImageGridHover();
  initGameyeCodeTypewriter();
  initStatsCounter();
  initVideoShowcase();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHomeInteractions, { once: true });
} else {
  initHomeInteractions();
}
