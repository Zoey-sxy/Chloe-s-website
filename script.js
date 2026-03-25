const body = document.body;
const themeControls = document.querySelectorAll(".theme-toggle, .lamp-toggle");
const lampToggle = document.querySelector(".lamp-toggle");
const cardTitles = document.querySelectorAll(".browser-card .browser-content h3");
const pupils = document.querySelectorAll(".pupil");
const mascot = document.querySelector(".mascot");
const wechatTrigger = document.querySelector(".contact-wechat-mark");
const wechatModal = document.getElementById("wechatQrModal");
const wechatClose = document.querySelector(".contact-qr-close");
const contactPortalImage = document.querySelector(".contact-portal-image");
const projectIndexImages = document.querySelectorAll(".project-index img");
const navLinks = document.querySelectorAll(
  '.site-nav a[href^="#"], .mobile-nav-link[href^="#"]'
);
const contactNavLinks = document.querySelectorAll('a[href="#contact"]');
const recordingsNavLinks = document.querySelectorAll('a[href="#recordings"]');
const projectLinks = document.querySelectorAll('.project-title-link[href^="./work-"]');
const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");
const storageKey = "chloe-theme";
const designsReturnStateKey = "chloe-designs-return-state";
const designsRestoreFlagKey = "chloe-designs-restore-pending";
let flickerTimer = null;

function setTheme(theme) {
  const isNight = theme === "night";
  body.dataset.theme = isNight ? "night" : "day";
  themeControls.forEach((control) => {
    control.setAttribute("aria-pressed", String(isNight));
  });
  if (contactPortalImage) {
    contactPortalImage.src = isNight
      ? contactPortalImage.dataset.nightSrc || contactPortalImage.src
      : contactPortalImage.dataset.daySrc || contactPortalImage.src;
  }
  projectIndexImages.forEach((image) => {
    image.src = isNight
      ? image.dataset.nightSrc || image.src
      : image.dataset.daySrc || image.src;
  });
  localStorage.setItem(storageKey, body.dataset.theme);
}

function playLampFlicker() {
  window.clearTimeout(flickerTimer);
  body.classList.remove("lamp-flicker");
  void body.offsetWidth;
  body.classList.add("lamp-flicker");
  flickerTimer = window.setTimeout(() => {
    body.classList.remove("lamp-flicker");
  }, 1100);
}

function toggleTheme(trigger) {
  const nextTheme = body.dataset.theme === "night" ? "day" : "night";
  if (nextTheme === "day") {
    body.classList.remove("lamp-flicker");
  }
  setTheme(nextTheme);
  if (trigger === lampToggle && nextTheme === "night") {
    playLampFlicker();
  }
}

const savedTheme = localStorage.getItem(storageKey);
if (savedTheme === "night" || savedTheme === "day") {
  setTheme(savedTheme);
}

themeControls.forEach((control) => {
  control.addEventListener("click", () => {
    toggleTheme(control);
  });
});

function getCardDetailUrl(title) {
  const card = title.closest(".browser-card");
  if (!card) {
    return null;
  }
  if (card.classList.contains("card-education")) {
    return "./about-education.html";
  }
  if (card.classList.contains("card-experience")) {
    return "./about-experience.html";
  }
  if (card.classList.contains("card-skill")) {
    return "./about-skills.html";
  }
  return null;
}

cardTitles.forEach((title) => {
  title.tabIndex = 0;
  title.setAttribute("role", "link");
  title.addEventListener("click", () => {
    const url = getCardDetailUrl(title);
    if (url) {
      window.location.href = url;
    }
  });
  title.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const url = getCardDetailUrl(title);
      if (url) {
        window.location.href = url;
      }
    }
  });
});

function movePupils(clientX, clientY) {
  pupils.forEach((pupil) => {
    const eye = pupil.parentElement;
    if (!eye) {
      return;
    }

    const rect = eye.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const angle = Math.atan2(deltaY, deltaX);
    const maxOffset = 0.22 * rect.width;
    const offsetX = Math.cos(angle) * maxOffset;
    const offsetY = Math.sin(angle) * maxOffset;

    pupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  });
}

window.addEventListener("pointermove", (event) => {
  movePupils(event.clientX, event.clientY);
});

mascot?.addEventListener("pointerleave", () => {
  pupils.forEach((pupil) => {
    pupil.style.transform = "translate(0, 0)";
  });
});

function setWechatModal(open) {
  if (!wechatModal || !wechatTrigger) {
    return;
  }

  wechatModal.hidden = !open;
  wechatTrigger.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("wechat-modal-open", open);
}

wechatTrigger?.addEventListener("click", () => {
  setWechatModal(true);
});

wechatClose?.addEventListener("click", () => {
  setWechatModal(false);
});

wechatModal?.addEventListener("click", (event) => {
  if (event.target === wechatModal) {
    setWechatModal(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && wechatModal && !wechatModal.hidden) {
    setWechatModal(false);
  }
});

contactNavLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const targetTop = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      0
    );
    window.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
    if (window.location.hash === "#contact") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  });
});

recordingsNavLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
});

const mobileSections = Array.from(
  document.querySelectorAll("#about, #works, #recordings, #contact")
);

function setMobileNavActive(sectionId) {
  mobileNavLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.section === sectionId);
  });
}

if (mobileNavLinks.length && mobileSections.length) {
  setMobileNavActive("about");

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (!visibleEntries.length) {
        return;
      }

      setMobileNavActive(visibleEntries[0].target.id);
    },
    {
      root: null,
      rootMargin: "-22% 0px -48%",
      threshold: [0.15, 0.32, 0.5, 0.7],
    }
  );

  mobileSections.forEach((section) => {
    sectionObserver.observe(section);
  });

  navLinks.forEach((link) => {
    const sectionId = link.getAttribute("href")?.slice(1);
    if (!sectionId) {
      return;
    }

    link.addEventListener("click", () => {
      if (sectionId === "recordings") {
        return;
      }
      setMobileNavActive(sectionId);
    });
  });
}

window.addEventListener("load", () => {
  if (window.location.hash === "#contact") {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  const shouldRestoreDesigns = sessionStorage.getItem(designsRestoreFlagKey) === "true";
  const savedReturnState = sessionStorage.getItem(designsReturnStateKey);

  if (!shouldRestoreDesigns || !savedReturnState) {
    return;
  }

  try {
    const parsedState = JSON.parse(savedReturnState);
    const currentPath = window.location.pathname + window.location.search;

    if (parsedState.path === currentPath) {
      window.scrollTo({
        top: parsedState.scrollY || 0,
        left: 0,
        behavior: "auto",
      });
    }
  } catch (error) {
    console.warn("Failed to restore Designs scroll position.", error);
  } finally {
    sessionStorage.removeItem(designsRestoreFlagKey);
  }
});

projectLinks.forEach((link) => {
  link.addEventListener("click", () => {
    sessionStorage.setItem(
      designsReturnStateKey,
      JSON.stringify({
        path: window.location.pathname + window.location.search,
        scrollY: window.scrollY,
      })
    );
    sessionStorage.removeItem(designsRestoreFlagKey);
  });
});
