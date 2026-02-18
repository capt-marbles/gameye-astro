const shouldLoadParticles =
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
  document.querySelector(".gy-particles-layer");

if (shouldLoadParticles) {
  const loadParticles = () => import("/scripts/section-particles.js");

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadParticles, { timeout: 1200 });
  } else {
    window.setTimeout(loadParticles, 180);
  }
}
