const MAX_SPREADS = 99;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const state = {
  index: 0,
  isAnimating: false,
  spreads: [],
};

const zoom = {
  scale: 1,
  min: 1,
  max: 2.6,
  x: 0,
  y: 0,
  longPressTimer: null,
  isDragging: false,
  suppressClick: false,
  pointerId: null,
  dragStartX: 0,
  dragStartY: 0,
  panStartX: 0,
  panStartY: 0,
};

const BOOK_RATIO = 2.82842712;
const BOOK_MAX_WIDTH = 1680;
const BOOK_MIN_WIDTH = 320;
const mobileBookMedia = window.matchMedia("(max-width: 720px)");

const bookStage = document.getElementById("bookStage");
const bookViewport = document.getElementById("bookViewport");
const bookTransform = document.getElementById("bookTransform");
const currentLeft = document.getElementById("currentLeft");
const currentRight = document.getElementById("currentRight");
const nextLeft = document.getElementById("nextLeft");
const nextRight = document.getElementById("nextRight");
const pageFlip = document.getElementById("pageFlip");
const pageFront = document.getElementById("pageFront");
const pageBack = document.getElementById("pageBack");
const prevHit = document.getElementById("prevHit");
const nextHit = document.getElementById("nextHit");
const book = document.getElementById("book");
const backLink = document.querySelector(".book-back-link");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const designsReturnStateKey = "chloe-designs-return-state";
const designsRestoreFlagKey = "chloe-designs-restore-pending";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportBounds() {
  return {
    width: bookViewport.clientWidth,
    height: bookViewport.clientHeight,
  };
}

function fitViewportToStage() {
  const stageStyles = window.getComputedStyle(bookStage);
  const availableWidth =
    bookStage.clientWidth -
    parseFloat(stageStyles.paddingLeft) -
    parseFloat(stageStyles.paddingRight);
  const availableHeight =
    bookStage.clientHeight -
    parseFloat(stageStyles.paddingTop) -
    parseFloat(stageStyles.paddingBottom);

  if (availableWidth <= 0 || availableHeight <= 0) {
    return;
  }

  if (mobileBookMedia.matches) {
    const readableWidth = clamp(
      Math.min(BOOK_MAX_WIDTH, availableHeight * BOOK_RATIO * 0.82),
      1040,
      1440
    );

    bookViewport.style.width = `${Math.max(availableWidth, readableWidth)}px`;
    return;
  }

  const fitWidth = clamp(
    Math.min(BOOK_MAX_WIDTH, availableWidth, availableHeight * BOOK_RATIO),
    BOOK_MIN_WIDTH,
    BOOK_MAX_WIDTH
  );

  bookViewport.style.width = `${fitWidth}px`;
}

function clampPan() {
  if (zoom.scale <= 1) {
    zoom.x = 0;
    zoom.y = 0;
    return;
  }

  const { width, height } = getViewportBounds();
  const minX = width - width * zoom.scale;
  const minY = height - height * zoom.scale;

  zoom.x = clamp(zoom.x, minX, 0);
  zoom.y = clamp(zoom.y, minY, 0);
}

function applyZoomTransform() {
  clampPan();
  bookTransform.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
  bookViewport.classList.toggle("is-zoomed", zoom.scale > 1.01);
  bookViewport.classList.toggle("is-dragging", zoom.isDragging);
}

function resetViewportView() {
  cancelLongPress();
  fitViewportToStage();
  zoom.scale = 1;
  zoom.x = 0;
  zoom.y = 0;
  zoom.isDragging = false;
  zoom.pointerId = null;
  zoom.suppressClick = false;
  applyZoomTransform();
  if (bookStage.scrollTo) {
    bookStage.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }
  window.scrollTo(0, 0);
}

function cancelLongPress() {
  if (zoom.longPressTimer) {
    clearTimeout(zoom.longPressTimer);
    zoom.longPressTimer = null;
  }
}

function setHalfImage(element, image, side) {
  element.style.backgroundImage = image ? `url("${image}")` : "none";
  element.style.backgroundPosition = side === "left" ? "left center" : "right center";
}

function renderSpread(leftEl, rightEl, image) {
  setHalfImage(leftEl, image, "left");
  setHalfImage(rightEl, image, "right");
}

function resetCurrentVisibility() {
  currentLeft.classList.remove("is-hidden");
  currentRight.classList.remove("is-hidden");
}

function updateHitState() {
  prevHit.disabled = state.isAnimating || state.index === 0;
  nextHit.disabled = state.isAnimating || state.index >= state.spreads.length - 1;
}

function renderCurrentSpread() {
  if (!state.spreads.length) {
    updateHitState();
    return;
  }

  renderSpread(currentLeft, currentRight, state.spreads[state.index]);
  resetCurrentVisibility();
  updateHitState();
}

function clearFlip() {
  pageFlip.className = "page-flip";
  pageFlip.style.transform = "";
  pageFront.style.backgroundImage = "none";
  pageBack.style.backgroundImage = "linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(236, 228, 216, 0.94))";
  book.classList.remove("is-turning-next", "is-turning-prev");
}

function finishTurn(nextIndex) {
  state.index = nextIndex;
  state.isAnimating = false;
  clearFlip();
  renderCurrentSpread();
}

function beginTurn(direction) {
  if (state.isAnimating || !state.spreads.length) {
    return;
  }

  const delta = direction === "next" ? 1 : -1;
  const targetIndex = state.index + delta;

  if (targetIndex < 0 || targetIndex >= state.spreads.length) {
    return;
  }

  state.isAnimating = true;
  updateHitState();

  const currentImage = state.spreads[state.index];
  const nextImage = state.spreads[targetIndex];

  renderSpread(currentLeft, currentRight, currentImage);
  renderSpread(nextLeft, nextRight, nextImage);

  if (direction === "next") {
    book.classList.add("is-turning-next");
    pageFlip.classList.add("is-active", "is-next");
    setHalfImage(pageFront, currentImage, "right");
    setHalfImage(pageBack, nextImage, "left");
    currentRight.classList.add("is-hidden");
    currentLeft.classList.remove("is-hidden");
  } else {
    book.classList.add("is-turning-prev");
    pageFlip.classList.add("is-active", "is-prev");
    setHalfImage(pageFront, currentImage, "left");
    setHalfImage(pageBack, nextImage, "right");
    currentLeft.classList.add("is-hidden");
    currentRight.classList.remove("is-hidden");
  }

  if (prefersReducedMotion.matches) {
    finishTurn(targetIndex);
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pageFlip.classList.add("is-animating");
    });
  });

  const onTransitionEnd = (event) => {
    if (event.target !== pageFlip || event.propertyName !== "transform") {
      return;
    }

    pageFlip.removeEventListener("transitionend", onTransitionEnd);
    finishTurn(targetIndex);
  };

  pageFlip.addEventListener("transitionend", onTransitionEnd);
}

function loadImage(source) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => resolve(source);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

async function findSpreadSource(folder, index) {
  const fileNumber = String(index).padStart(2, "0");

  for (const extension of IMAGE_EXTENSIONS) {
    const source = `./assets/${folder}/${fileNumber}.${extension}`;
    const result = await loadImage(source);

    if (result) {
      return result;
    }
  }

  return null;
}

async function collectSpreads(folder) {
  const sources = [];

  for (let index = 1; index <= MAX_SPREADS; index += 1) {
    const source = await findSpreadSource(folder, index);

    if (!source) {
      break;
    }

    sources.push(source);
  }

  return sources;
}

function bindEvents() {
  backLink?.addEventListener("click", (event) => {
    const savedReturnState = sessionStorage.getItem(designsReturnStateKey);

    if (!savedReturnState) {
      return;
    }

    try {
      const parsedState = JSON.parse(savedReturnState);

      if (!parsedState.path) {
        return;
      }

      event.preventDefault();
      sessionStorage.setItem(designsRestoreFlagKey, "true");
      window.location.href = parsedState.path;
    } catch (error) {
      console.warn("Failed to restore previous Designs page.", error);
    }
  });

  nextHit.addEventListener("click", () => {
    beginTurn("next");
  });

  prevHit.addEventListener("click", () => {
    beginTurn("prev");
  });

  book.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      beginTurn("next");
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      beginTurn("prev");
    }
  });

  bookViewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      const rect = bookViewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const previousScale = zoom.scale;
      const nextScale = clamp(previousScale * Math.exp(-event.deltaY * 0.0015), zoom.min, zoom.max);

      if (nextScale === previousScale) {
        return;
      }

      const contentX = (pointerX - zoom.x) / previousScale;
      const contentY = (pointerY - zoom.y) / previousScale;

      zoom.scale = nextScale;
      zoom.x = pointerX - contentX * nextScale;
      zoom.y = pointerY - contentY * nextScale;
      applyZoomTransform();
    },
    { passive: false }
  );

  bookViewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || zoom.scale <= 1.01) {
      return;
    }

    zoom.pointerId = event.pointerId;
    zoom.dragStartX = event.clientX;
    zoom.dragStartY = event.clientY;
    zoom.panStartX = zoom.x;
    zoom.panStartY = zoom.y;
    cancelLongPress();

    zoom.longPressTimer = window.setTimeout(() => {
      zoom.isDragging = true;
      applyZoomTransform();

      if (bookViewport.setPointerCapture) {
        bookViewport.setPointerCapture(event.pointerId);
      }
    }, 220);
  });

  bookViewport.addEventListener("pointermove", (event) => {
    if (zoom.pointerId !== event.pointerId) {
      return;
    }

    const movedX = event.clientX - zoom.dragStartX;
    const movedY = event.clientY - zoom.dragStartY;

    if (!zoom.isDragging) {
      if (Math.abs(movedX) > 6 || Math.abs(movedY) > 6) {
        cancelLongPress();
      }

      return;
    }

    event.preventDefault();
    zoom.x = zoom.panStartX + movedX;
    zoom.y = zoom.panStartY + movedY;
    applyZoomTransform();
  });

  function endDrag(event) {
    if (zoom.pointerId !== null && event.pointerId !== undefined && zoom.pointerId !== event.pointerId) {
      return;
    }

    const wasDragging = zoom.isDragging;
    cancelLongPress();
    zoom.isDragging = false;
    zoom.pointerId = null;

    if (bookViewport.hasPointerCapture && event.pointerId !== undefined && bookViewport.hasPointerCapture(event.pointerId)) {
      bookViewport.releasePointerCapture(event.pointerId);
    }

    if (wasDragging) {
      zoom.suppressClick = true;
      window.setTimeout(() => {
        zoom.suppressClick = false;
      }, 0);
    }

    applyZoomTransform();
  }

  bookViewport.addEventListener("pointerup", endDrag);
  bookViewport.addEventListener("pointercancel", endDrag);
  bookViewport.addEventListener(
    "click",
    (event) => {
      if (!zoom.suppressClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      zoom.suppressClick = false;
    },
    true
  );

  window.addEventListener("resize", () => {
    resetViewportView();
  });

  window.addEventListener("pageshow", () => {
    resetViewportView();
  });
}

async function initializeBook() {
  const folder = document.body.dataset.workFolder;

  state.spreads = await collectSpreads(folder);
  clearFlip();
  renderCurrentSpread();
  resetViewportView();
}

bindEvents();
initializeBook();
