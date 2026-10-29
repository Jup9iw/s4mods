(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const navLinks = document.getElementById("navLinks");

  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > 24);
  };

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const closeMenu = () => {
    if (!burger || !navLinks) return;
    burger.classList.remove("open");
    navLinks.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  };

  if (burger && navLinks) {
    burger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      burger.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("in"));
  }

  const counters = document.querySelectorAll("[data-counter]");
  const animateCounter = (el) => {
    const target = parseFloat(el.dataset.target || "0");
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const duration = 1500;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  if ("IntersectionObserver" in window && !reduceMotion) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });

    counters.forEach((el) => counterObserver.observe(el));
  } else {
    counters.forEach((el) => {
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      el.textContent = (el.dataset.prefix || "") + parseFloat(el.dataset.target || "0").toFixed(decimals) + (el.dataset.suffix || "");
    });
  }

  document.querySelectorAll(".toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const pressed = toggle.classList.toggle("on");
      toggle.setAttribute("aria-pressed", String(pressed));
    });
  });

  const toast = document.getElementById("toast");
  let toastTimer;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  };

  window.s4Toast = showToast;

  document.querySelectorAll("[data-toast]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      showToast(trigger.dataset.toast);
      closeMenu();
    });
  });

  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      showToast(`Offre ${button.dataset.plan} sélectionnée. Le paiement sécurisé arrive bientôt.`);
    });
  });

  const fps = document.getElementById("fpsValue");
  if (fps && !reduceMotion) {
    setInterval(() => {
      fps.textContent = String(236 + Math.floor(Math.random() * 10));
    }, 1200);
  }

  const card = document.getElementById("clientCard");
  const canTilt = window.matchMedia("(pointer: fine)").matches && window.innerWidth > 860;

  if (card && canTilt && !reduceMotion) {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `rotateY(${x * 10 - 3}deg) rotateX(${-y * 10 + 2}deg) translateY(-3px)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  }

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const canvas = document.getElementById("particles");
  if (!canvas || reduceMotion) return;

  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  let width = 0;
  let height = 0;
  let dots = [];
  let raf = 0;

  const palette = ["240, 199, 94", "224, 103, 63", "255, 228, 166"];

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(64, Math.round(width / 22));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.6 + 0.6,
      color: palette[Math.floor(Math.random() * palette.length)],
      alpha: Math.random() * 0.45 + 0.2
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      dot.x += dot.vx;
      dot.y += dot.vy;

      if (dot.x < -10) dot.x = width + 10;
      if (dot.x > width + 10) dot.x = -10;
      if (dot.y < -10) dot.y = height + 10;
      if (dot.y > height + 10) dot.y = -10;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${dot.color}, ${dot.alpha})`;
      ctx.fill();

      for (let j = i + 1; j < dots.length; j++) {
        const other = dots[j];
        const dx = dot.x - other.x;
        const dy = dot.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 110) {
          ctx.beginPath();
          ctx.moveTo(dot.x, dot.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(${dot.color}, ${0.09 * (1 - distance / 110)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    raf = requestAnimationFrame(draw);
  };

  resize();
  draw();

  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    resize();
    raf = requestAnimationFrame(draw);
  });
})();
