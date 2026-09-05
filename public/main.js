/* ==========================================================================
   Intelligence Designed To Evolve — Main JavaScript
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ------------------------------------------------------------------------
     1. Mobile Menu Drawer Toggle
     ------------------------------------------------------------------------ */
  const burgerBtn = document.querySelector(".mobile-burger");
  const overlay = document.querySelector(".mobile-overlay");
  const mobileSheet = document.querySelector(".mobile-menu-sheet");
  const mobileLinks = document.querySelectorAll(".mobile-nav-link, .mobile-sign-in");

  function openMenu() {
    document.body.classList.add("menu-open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    document.body.classList.remove("menu-open");
    if (burgerBtn) burgerBtn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (document.body.classList.contains("menu-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  if (burgerBtn) {
    burgerBtn.addEventListener("click", toggleMenu);
  }

  if (overlay) {
    overlay.addEventListener("click", closeMenu);
  }

  mobileLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720 && document.body.classList.contains("menu-open")) {
      closeMenu();
    }
  });

  /* ------------------------------------------------------------------------
     2. Stats Footer EaseOutCubic Count-Up Animation
     ------------------------------------------------------------------------ */
  const metrics = [
    { target: 120, suffix: "ms", decimals: 0 },
    { target: 99.99, suffix: "%", decimals: 2 },
    { target: 24, suffix: "/7", decimals: 0 },
    { target: 2.4, suffix: "M", decimals: 1 },
  ];

  const statValueEls = document.querySelectorAll(".stat-value");

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateStat(index, element, config) {
    const duration = 1500 + index * 80;
    const startDelay = 480 + index * 90;

    setTimeout(() => {
      let startTime = null;

      function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const currentValue = easedProgress * config.target;

        element.textContent = currentValue.toFixed(config.decimals) + config.suffix;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          element.textContent = config.target.toFixed(config.decimals) + config.suffix;
        }
      }

      requestAnimationFrame(step);
    }, startDelay);
  }

  const footerEl = document.querySelector(".stats-footer");
  if (footerEl && "IntersectionObserver" in window) {
    let animated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            statValueEls.forEach((el, index) => {
              if (metrics[index]) {
                animateStat(index, el, metrics[index]);
              }
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(footerEl);
  } else {
    // Fallback if IntersectionObserver is unsupported
    statValueEls.forEach((el, index) => {
      if (metrics[index]) {
        animateStat(index, el, metrics[index]);
      }
    });
  }
});
