const root = document.documentElement;
const boot = document.getElementById("boot");
const bootCount = document.getElementById("bootCount");
const bootBar = document.querySelector(".boot__track span");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let loaded = 0;
const finishBoot = () => {
  loaded = 100;
  bootCount.textContent = "100%";
  bootBar.style.width = "100%";
  window.setTimeout(() => {
    boot.classList.add("is-done");
    document.body.classList.add("is-ready");
  }, reduceMotion ? 0 : 250);
};

if (reduceMotion) {
  finishBoot();
} else {
  const loadTimer = window.setInterval(() => {
    loaded += Math.floor(Math.random() * 12) + 4;
    loaded = Math.min(loaded, 96);
    bootCount.textContent = `${String(loaded).padStart(2, "0")}%`;
    bootBar.style.width = `${loaded}%`;
    if (loaded >= 96) window.clearInterval(loadTimer);
  }, 70);
  window.addEventListener("load", () => {
    window.clearInterval(loadTimer);
    window.setTimeout(finishBoot, 180);
  });
  window.setTimeout(finishBoot, 1800);
}

const cursor = document.querySelector(".cursor");
if (cursor && !reduceMotion) {
  let cx = window.innerWidth / 2;
  let cy = window.innerHeight / 2;
  let tx = cx;
  let ty = cy;
  window.addEventListener("mousemove", (event) => {
    tx = event.clientX;
    ty = event.clientY;
  });
  const moveCursor = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    window.requestAnimationFrame(moveCursor);
  };
  moveCursor();

  document.querySelectorAll("a, button, .tilt-card").forEach((item) => {
    item.addEventListener("mouseenter", () => cursor.classList.add("is-active"));
    item.addEventListener("mouseleave", () => cursor.classList.remove("is-active"));
  });
}

const progress = document.getElementById("scrollProgress");
const nav = document.getElementById("nav");
const heroVisual = document.getElementById("heroVisual");

const onScroll = () => {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight;
  const amount = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
  progress.style.width = `${amount}%`;
  nav.classList.toggle("is-scrolled", window.scrollY > 30);

  if (heroVisual && !reduceMotion && window.scrollY < window.innerHeight * 1.2) {
    heroVisual.style.transform = `translate3d(0, ${window.scrollY * 0.11}px, 0)`;
  }
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 }
);
document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));

document.querySelectorAll(".tilt-card").forEach((card) => {
  card.addEventListener("mousemove", (event) => {
    if (reduceMotion || window.innerWidth < 760) return;
    const box = card.getBoundingClientRect();
    const rx = ((event.clientY - box.top) / box.height - 0.5) * -7;
    const ry = ((event.clientX - box.left) / box.width - 0.5) * 7;
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "rotateX(0) rotateY(0)";
  });
});

document.querySelectorAll(".magnetic").forEach((item) => {
  item.addEventListener("mousemove", (event) => {
    if (reduceMotion || window.innerWidth < 760) return;
    const box = item.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    item.style.transform = `translate(${x * 0.1}px, ${y * 0.12}px)`;
  });
  item.addEventListener("mouseleave", () => {
    item.style.transform = "";
  });
});

if (!reduceMotion) {
  const parallaxItems = document.querySelectorAll("[data-depth]");
  window.addEventListener("mousemove", (event) => {
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    parallaxItems.forEach((item) => {
      const depth = Number(item.dataset.depth || 0.3);
      item.style.transform = `translate3d(${x * depth * 35}px, ${y * depth * 35}px, 0)`;
    });
  });
}

const copyButton = document.getElementById("copyContract");
const copyLabel = document.getElementById("copyLabel");
const toast = document.getElementById("toast");
copyButton.addEventListener("click", async () => {
  const value = copyButton.dataset.contract;
  if (value === "COMING SOON") {
    copyLabel.textContent = "SOON";
    toast.textContent = "CONTRACT PUBLISHED AT LAUNCH";
  } else {
    await navigator.clipboard.writeText(value);
    copyLabel.textContent = "COPIED";
    toast.textContent = "CONTRACT COPIED";
  }
  toast.classList.add("is-visible");
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    copyLabel.textContent = "COPY";
  }, 2200);
});

const menuButton = document.getElementById("menuButton");
const navLinks = document.getElementById("navLinks");
menuButton.addEventListener("click", () => {
  const open = menuButton.classList.toggle("is-open");
  navLinks.classList.toggle("is-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});
navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuButton.classList.remove("is-open");
    navLinks.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll('a[href="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    toast.textContent = "OFFICIAL LINK ADDED AT LAUNCH";
    toast.classList.add("is-visible");
    window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  });
});
