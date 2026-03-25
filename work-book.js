const MAX_SPREADS = 99;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

const state = {
  index: 0,
  isAnimating: false,
  spreads: [],
};

const viewState = {
  scale: 1,
  minScale: 1,
  maxScale: 4.6,
  translateX: 0,
  translateY: 0,
};

const dragState = {
  active: false,
  pointerId: null,
  pointerType: null,
  startX: 0,
  startY: 0,
  originX: 0,
  originY: 0,
  suppressClick: false,
};

const touchState = {
  longPressTimer: null,
  longPressPointerId: null,
  activePointers: new Map(),
  pinchActive: false,
  pinchStartDistance: 0,
  pinchStartScale: 1,
  lastTapTime: 0,
  lastTapX: 0,
  lastTapY: 0,
};

const BOOK_RATIO = 2.82842712;
const BOOK_MAX_WIDTH = 1680;
const BOOK_MIN_WIDTH = 320;
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 28;
const TAP_MOVE_TOLERANCE = 10;
const LONG_PRESS_DELAY = 220;
const WHEEL_ZOOM_SPEED = 0.0022;
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

function getZoomTargetScale() {
  return mobileBookMedia.matches ? 2.45 : 2.1;
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

function applyViewTransform() {
  bookTransform.style.transform =
    `translate(${viewState.translateX}px, ${viewState.translateY}px) scale(${viewState.scale})`;
  bookViewport.classList.toggle("is-zoomed", viewState.scale > 1.01);
  bookViewport.classList.toggle("is-dragging", dragState.active);
  document.body.classList.toggle("book-dragging", dragState.active);
}

function resetTranslation() {
  viewState.translateX = 0;
  viewState.translateY = 0;
}

function zoomAtClient(nextScale, clientX, clientY) {
  const rect = bookViewport.getBoundingClientRect();
  const pointerX = clientX - rect.left;
  const pointerY = clientY - rect.top;
  const previousScale = viewState.scale;
  const scale = clamp(nextScale, viewState.minScale, viewState.maxScale);

  if (scale === previousScale) {
    return;
  }

  const contentX = (pointerX - viewState.translateX) / previousScale;
  const contentY = (pointerY - viewState.translateY) / previousScale;

  viewState.scale = scale;
  viewState.translateX = pointerX - contentX * scale;
  viewState.translateY = pointerY - contentY * scale;

  if (viewState.scale <= viewState.minScale + 0.001) {
    viewState.scale = viewState.minScale;
    resetTranslation();
  }

  applyViewTransform();
}

function toggleTouchZoom(clientX, clientY) {
  if (viewState.scale > 1.01) {
    viewState.scale = viewState.minScale;
    resetTranslation();
    applyViewTransform();
    return;
  }

  zoomAtClient(getZoomTargetScale(), clientX, clientY);
}

function cancelLongPress() {
  if (touchState.longPressTimer) {
    clearTimeout(touchState.longPressTimer);
    touchState.longPressTimer = null;
  }

  touchState.longPressPointerId = null;
}

function releasePointerCapture(pointerId) {
  if (
    pointerId !== null &&
    pointerId !== undefined &&
    bookViewport.hasPointerCapture &&
    bookViewport.hasPointerCapture(pointerId)
  ) {
    bookViewport.releasePointerCapture(pointerId);
  }
}

function beginDrag(pointerId, pointerType, clientX, clientY) {
  dragState.active = true;
  dragState.pointerId = pointerId;
  dragState.pointerType = pointerType;
  dragState.startX = clientX;
  dragState.startY = clientY;
  dragState.originX = viewState.translateX;
  dragState.originY = viewState.translateY;
  applyViewTransform();

  if (bookViewport.setPointerCapture && pointerId !== null && pointerId !== undefined) {
    bookViewport.setPointerCapture(pointerId);
  }
}

function updateDrag(clientX, clientY) {
  const dx = clientX - dragState.startX;
  const dy = clientY - dragState.startY;

  viewState.translateX = dragState.originX + dx;
  viewState.translateY = dragState.originY + dy;
  applyViewTransform();
}

function endDrag() {
  if (!dragState.active) {
    return;
  }

  dragState.active = false;
  dragState.originX = viewState.translateX;
  dragState.originY = viewState.translateY;
  dragState.pointerId = null;
  dragState.pointerType = null;
  applyViewTransform();
}

function getTouchDistance() {
  const pointers = Array.from(touchState.activePointers.values());

  if (pointers.length < 2) {
    return 0;
  }

  const [first, second] = pointers;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getTouchMidpoint() {
  const pointers = Array.from(touchState.activePointers.values());

  if (pointers.length < 2) {
    return null;
  }

  const [first, second] = pointers;

  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
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
  pageBack.style.backgroundImage =
    "linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(236, 228, 216, 0.94))";
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

function resetViewportView() {
  cancelLongPress();
  fitViewportToStage();
  viewState.scale = viewState.minScale;
  resetTranslation();
  releasePointerCapture(dragState.pointerId);
  endDrag();
  dragState.suppressClick = false;
  touchState.activePointers.clear();
  touchState.pinchActive = false;
  touchState.pinchStartDistance = 0;
  touchState.pinchStartScale = 1;
  applyViewTransform();

  if (bookStage.scrollTo) {
    bookStage.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }

  window.scrollTo(0, 0);
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
      const nextScale =
        viewState.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_SPEED);
      zoomAtClient(nextScale, event.clientX, event.clientY);
    },
    { passive: false }
  );

  bookViewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      touchState.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });

      if (touchState.activePointers.size === 2) {
        cancelLongPress();
        releasePointerCapture(dragState.pointerId);
        endDrag();
        touchState.pinchActive = true;
        touchState.pinchStartDistance = getTouchDistance();
        touchState.pinchStartScale = viewState.scale;
        return;
      }

      if (viewState.scale > 1.01) {
        cancelLongPress();
        touchState.longPressPointerId = event.pointerId;
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;

        touchState.longPressTimer = window.setTimeout(() => {
          if (touchState.longPressPointerId !== event.pointerId || touchState.pinchActive) {
            return;
          }

          beginDrag(event.pointerId, "touch", event.clientX, event.clientY);
        }, LONG_PRESS_DELAY);
      }

      return;
    }

    if (event.button !== 0 || viewState.scale <= 1.01) {
      return;
    }

    event.preventDefault();
    beginDrag(event.pointerId, "mouse", event.clientX, event.clientY);
  });

  bookViewport.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch" && touchState.activePointers.has(event.pointerId)) {
      touchState.activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (touchState.pinchActive && touchState.activePointers.size >= 2) {
      const distance = getTouchDistance();
      const midpoint = getTouchMidpoint();

      if (!distance || !midpoint || !touchState.pinchStartDistance) {
        return;
      }

      event.preventDefault();
      zoomAtClient(
        (touchState.pinchStartScale * distance) / touchState.pinchStartDistance,
        midpoint.x,
        midpoint.y
      );
      return;
    }

    if (
      event.pointerType === "touch" &&
      touchState.longPressPointerId === event.pointerId &&
      !dragState.active
    ) {
      const movedX = event.clientX - dragState.startX;
      const movedY = event.clientY - dragState.startY;

      if (Math.abs(movedX) > TAP_MOVE_TOLERANCE || Math.abs(movedY) > TAP_MOVE_TOLERANCE) {
        cancelLongPress();
      }
    }

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  });

  function handlePointerEnd(event) {
    const pointerStayedMostlyStill =
      Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) <=
      TAP_MOVE_TOLERANCE;

    if (event.pointerType === "touch") {
      touchState.activePointers.delete(event.pointerId);

      if (touchState.activePointers.size < 2) {
        touchState.pinchActive = false;
        touchState.pinchStartDistance = 0;
      }

      if (touchState.longPressPointerId === event.pointerId) {
        cancelLongPress();
      }
    }

    if (dragState.pointerId === event.pointerId) {
      releasePointerCapture(event.pointerId);
      endDrag();
      dragState.suppressClick = true;
      window.setTimeout(() => {
        dragState.suppressClick = false;
      }, 0);
    }

    if (
      event.pointerType === "touch" &&
      !dragState.active &&
      !touchState.pinchActive &&
      pointerStayedMostlyStill
    ) {
      const now = Date.now();
      const repeatedTap =
        now - touchState.lastTapTime <= DOUBLE_TAP_DELAY &&
        Math.hypot(event.clientX - touchState.lastTapX, event.clientY - touchState.lastTapY) <=
          DOUBLE_TAP_DISTANCE;

      if (repeatedTap) {
        toggleTouchZoom(event.clientX, event.clientY);
        touchState.lastTapTime = 0;
        dragState.suppressClick = true;
        window.setTimeout(() => {
          dragState.suppressClick = false;
        }, 0);
      } else {
        touchState.lastTapTime = now;
        touchState.lastTapX = event.clientX;
        touchState.lastTapY = event.clientY;
      }
    }
  }

  bookViewport.addEventListener("pointerup", handlePointerEnd);
  bookViewport.addEventListener("pointercancel", handlePointerEnd);

  bookViewport.addEventListener(
    "click",
    (event) => {
      if (!dragState.suppressClick) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dragState.suppressClick = false;
    },
    true
  );

  bookViewport.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

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
