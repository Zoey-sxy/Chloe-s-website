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
  pinchAnchorX: 0,
  pinchAnchorY: 0,
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
const portraitLandscapeBookMedia = window.matchMedia(
  "(max-width: 720px) and (orientation: portrait)"
);

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
const downloadLink = document.querySelector(".book-download-link");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const designsReturnStateKey = "chloe-designs-return-state";
const designsRestoreFlagKey = "chloe-designs-restore-pending";
const BACK_LINK_TAP_ANIMATION_MS = 180;
const pageHitHost = book;
const backLinkHost = book;
const downloadLinkHost = book;
const backLinkParent = backLink?.parentElement ?? null;
const backLinkNextSibling = backLink?.nextSibling ?? null;
const downloadLinkParent = downloadLink?.parentElement ?? null;
const downloadLinkNextSibling = downloadLink?.nextSibling ?? null;
let backLinkTapAnimationTimer = null;

function moveNodeBeforeReference(node, parent, referenceNode) {
  if (!node || !parent) {
    return;
  }

  if (referenceNode && referenceNode.parentNode === parent) {
    parent.insertBefore(node, referenceNode);
    return;
  }

  parent.appendChild(node);
}

function syncOverlayControls() {
  if (backLink) {
    const shouldBindBackLinkToBook = isPortraitLandscapeBookMode() && backLinkHost;

    backLink.classList.toggle("is-book-bound", Boolean(shouldBindBackLinkToBook));

    if (shouldBindBackLinkToBook) {
      if (backLink.parentElement !== backLinkHost) {
        backLinkHost.appendChild(backLink);
      }
    } else if (backLink.parentElement !== backLinkParent) {
      moveNodeBeforeReference(backLink, backLinkParent, backLinkNextSibling);
    }
  }

  if (downloadLink) {
    const shouldBindDownloadLinkToBook = isPortraitLandscapeBookMode() && downloadLinkHost;

    downloadLink.classList.toggle("is-book-bound", Boolean(shouldBindDownloadLinkToBook));

    if (shouldBindDownloadLinkToBook) {
      if (downloadLink.parentElement !== downloadLinkHost) {
        downloadLinkHost.appendChild(downloadLink);
      }
    } else if (downloadLink.parentElement !== downloadLinkParent) {
      moveNodeBeforeReference(downloadLink, downloadLinkParent, downloadLinkNextSibling);
    }
  }
}

function isPortraitLandscapeBookMode() {
  return portraitLandscapeBookMedia.matches;
}

function syncPortraitControls() {
  syncOverlayControls();

  if (prevHit.parentElement !== pageHitHost) {
    pageHitHost.append(prevHit);
  }

  if (nextHit.parentElement !== pageHitHost) {
    pageHitHost.append(nextHit);
  }

  bookViewport.classList.toggle(
    "is-portrait-landscape",
    isPortraitLandscapeBookMode()
  );
}

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
  syncPortraitControls();

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

  if (isPortraitLandscapeBookMode()) {
    const fitWidth = clamp(
      Math.min(
        BOOK_MAX_WIDTH,
        availableHeight * 0.96,
        availableWidth * BOOK_RATIO * 0.96
      ),
      640,
      1440
    );

    bookViewport.style.width = `${fitWidth}px`;
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

function getViewportLocalPoint(clientX, clientY) {
  const rect = bookViewport.getBoundingClientRect();
  const localWidth = bookViewport.clientWidth || rect.width;
  const localHeight = bookViewport.clientHeight || rect.height;

  if (isPortraitLandscapeBookMode()) {
    const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1);
    const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1);

    return {
      x: (1 - normalizedY) * localWidth,
      y: normalizedX * localHeight,
    };
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

function getDragDelta(clientX, clientY) {
  const dx = clientX - dragState.startX;
  const dy = clientY - dragState.startY;

  if (isPortraitLandscapeBookMode()) {
    return {
      x: dy,
      y: -dx,
    };
  }

  return {
    x: dx,
    y: dy,
  };
}

function isInteractiveTarget(target) {
  return target instanceof Element && Boolean(target.closest("a, button"));
}

function getBackLinkNavigation() {
  const fallbackTarget = backLink?.href ?? "";
  const savedReturnState = sessionStorage.getItem(designsReturnStateKey);

  if (!savedReturnState) {
    return {
      target: fallbackTarget,
      shouldRestoreState: false,
    };
  }

  try {
    const parsedState = JSON.parse(savedReturnState);

    if (!parsedState.path) {
      return {
        target: fallbackTarget,
        shouldRestoreState: false,
      };
    }

    return {
      target: parsedState.path,
      shouldRestoreState: true,
    };
  } catch (error) {
    console.warn("Failed to restore previous Designs page.", error);

    return {
      target: fallbackTarget,
      shouldRestoreState: false,
    };
  }
}

function navigateBackLink() {
  const navigation = getBackLinkNavigation();

  if (!navigation.target) {
    return;
  }

  if (navigation.shouldRestoreState) {
    sessionStorage.setItem(designsRestoreFlagKey, "true");
  }

  window.location.href = navigation.target;
}

function playBackLinkTapAnimation(onComplete) {
  if (!backLink) {
    onComplete?.();
    return;
  }

  if (backLinkTapAnimationTimer) {
    window.clearTimeout(backLinkTapAnimationTimer);
  }

  backLink.classList.remove("is-tap-animating");
  void backLink.offsetWidth;
  backLink.classList.add("is-tap-animating");

  backLinkTapAnimationTimer = window.setTimeout(() => {
    backLink.classList.remove("is-tap-animating");
    backLinkTapAnimationTimer = null;
    onComplete?.();
  }, BACK_LINK_TAP_ANIMATION_MS);
}

function playPageHitTapAnimation(button, onComplete) {
  if (!button) {
    onComplete?.();
    return;
  }

  button.classList.remove("is-tap-animating");
  void button.offsetWidth;
  button.classList.add("is-tap-animating");

  window.setTimeout(() => {
    button.classList.remove("is-tap-animating");
    button.blur?.();
    onComplete?.();
  }, BACK_LINK_TAP_ANIMATION_MS);
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
  const delta = getDragDelta(clientX, clientY);

  viewState.translateX = dragState.originX + delta.x;
  viewState.translateY = dragState.originY + delta.y;
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

function suppressClicksTemporarily() {
  dragState.suppressClick = true;
  window.setTimeout(() => {
    dragState.suppressClick = false;
  }, 0);
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

function beginPinchGesture() {
  const midpoint = getTouchMidpoint();
  const distance = getTouchDistance();

  if (!midpoint || !distance) {
    return;
  }

  const localPoint = getViewportLocalPoint(midpoint.x, midpoint.y);

  touchState.pinchActive = true;
  touchState.pinchStartDistance = distance;
  touchState.pinchStartScale = viewState.scale;
  touchState.pinchAnchorX = (localPoint.x - viewState.translateX) / viewState.scale;
  touchState.pinchAnchorY = (localPoint.y - viewState.translateY) / viewState.scale;
}

function updatePinchGesture() {
  const midpoint = getTouchMidpoint();
  const distance = getTouchDistance();

  if (!midpoint || !distance || !touchState.pinchStartDistance) {
    return;
  }

  const localPoint = getViewportLocalPoint(midpoint.x, midpoint.y);
  const scale = clamp(
    (touchState.pinchStartScale * distance) / touchState.pinchStartDistance,
    viewState.minScale,
    viewState.maxScale
  );

  viewState.scale = scale;
  viewState.translateX = localPoint.x - touchState.pinchAnchorX * scale;
  viewState.translateY = localPoint.y - touchState.pinchAnchorY * scale;

  if (viewState.scale <= viewState.minScale + 0.001) {
    viewState.scale = viewState.minScale;
    resetTranslation();
  }

  applyViewTransform();
}

function beginTouchDrag(pointerId, clientX, clientY) {
  if (viewState.scale <= 1.01) {
    return false;
  }

  beginDrag(pointerId, "touch", clientX, clientY);
  return true;
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
  const isAtStart = state.index === 0;
  const isAtEnd = state.index >= state.spreads.length - 1;

  prevHit.disabled = state.isAnimating || isAtStart;
  nextHit.disabled = state.isAnimating || isAtEnd;
  prevHit.classList.toggle("is-boundary-disabled", isAtStart);
  nextHit.classList.toggle("is-boundary-disabled", isAtEnd);
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
  touchState.pinchAnchorX = 0;
  touchState.pinchAnchorY = 0;
  applyViewTransform();

  if (bookStage.scrollTo) {
    bookStage.scrollTo({ left: 0, top: 0, behavior: "auto" });
  }

  window.scrollTo(0, 0);
}

function bindEvents() {
  backLink?.addEventListener("click", (event) => {
    if (!mobileBookMedia.matches) {
      const navigation = getBackLinkNavigation();

      if (!navigation.shouldRestoreState) {
        return;
      }

      event.preventDefault();
      navigateBackLink();
      return;
    }

    event.preventDefault();
    playBackLinkTapAnimation(() => {
      navigateBackLink();
    });
  });

  nextHit.addEventListener("click", (event) => {
    if (!mobileBookMedia.matches) {
      beginTurn("next");
      return;
    }

    event.preventDefault();
    playPageHitTapAnimation(nextHit, () => {
      beginTurn("next");
    });
  });

  prevHit.addEventListener("click", (event) => {
    if (!mobileBookMedia.matches) {
      beginTurn("prev");
      return;
    }

    event.preventDefault();
    playPageHitTapAnimation(prevHit, () => {
      beginTurn("prev");
    });
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

      if (touchState.activePointers.size === 1) {
        dragState.startX = event.clientX;
        dragState.startY = event.clientY;
      }

      if (touchState.activePointers.size === 2) {
        cancelLongPress();
        releasePointerCapture(dragState.pointerId);
        endDrag();
        beginPinchGesture();
        suppressClicksTemporarily();
        return;
      }

      if (viewState.scale > 1.01 && !isInteractiveTarget(event.target)) {
        cancelLongPress();
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
      event.preventDefault();
      updatePinchGesture();
      return;
    }

    if (
      event.pointerType === "touch" &&
      !dragState.active &&
      !touchState.pinchActive &&
      touchState.activePointers.size === 1 &&
      viewState.scale > 1.01 &&
      !isInteractiveTarget(event.target)
    ) {
      const movedX = event.clientX - dragState.startX;
      const movedY = event.clientY - dragState.startY;

      if (Math.abs(movedX) > TAP_MOVE_TOLERANCE || Math.abs(movedY) > TAP_MOVE_TOLERANCE) {
        event.preventDefault();
        beginTouchDrag(event.pointerId, dragState.startX, dragState.startY);
        updateDrag(event.clientX, event.clientY);
        suppressClicksTemporarily();
        return;
      }
    }

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    updateDrag(event.clientX, event.clientY);
  });

  function handlePointerEnd(event) {
    const wasPinching = touchState.pinchActive;
    const pointerStayedMostlyStill =
      Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) <=
      TAP_MOVE_TOLERANCE;

    if (event.pointerType === "touch") {
      touchState.activePointers.delete(event.pointerId);

      if (touchState.activePointers.size < 2) {
        touchState.pinchActive = false;
        touchState.pinchStartDistance = 0;
        touchState.pinchStartScale = viewState.scale;
        touchState.pinchAnchorX = 0;
        touchState.pinchAnchorY = 0;
      }

      if (touchState.longPressPointerId === event.pointerId) {
        cancelLongPress();
      }
    }

    if (dragState.pointerId === event.pointerId) {
      releasePointerCapture(event.pointerId);
      endDrag();
      suppressClicksTemporarily();
    }

    if (
      wasPinching &&
      event.pointerType === "touch" &&
      touchState.activePointers.size === 1 &&
      viewState.scale > 1.01
    ) {
      const [remainingPointerId, remainingPointer] = touchState.activePointers.entries().next().value;

      beginTouchDrag(remainingPointerId, remainingPointer.x, remainingPointer.y);
      suppressClicksTemporarily();
      return;
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
        suppressClicksTemporarily();
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
