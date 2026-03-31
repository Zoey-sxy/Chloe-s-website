const rollingGalleryCards = document.querySelectorAll(
  ".timeline-card-link .timeline-media-record"
);

function getTrackMetrics(viewport, track) {
  const items = Array.from(track.querySelectorAll("img"));
  if (!items.length) {
    return null;
  }

  const firstItem = items[0];
  const trackStyles = window.getComputedStyle(track);
  const gap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || "0") || 0;
  const itemWidth = firstItem.getBoundingClientRect().width;
  const viewportWidth = viewport.getBoundingClientRect().width;
  const visibleCount = Math.max(
    1,
    Math.round((viewportWidth + gap) / (itemWidth + gap))
  );

  return {
    items,
    gap,
    itemWidth,
    visibleCount,
    maxIndex: Math.max(0, items.length - visibleCount),
  };
}

rollingGalleryCards.forEach((viewport) => {
  const card = viewport.closest(".timeline-card-link");
  const track = viewport.querySelector(".timeline-media-track");

  if (!card || !track) {
    return;
  }

  let timerId = null;
  let currentIndex = 0;

  const applyOffset = () => {
    const metrics = getTrackMetrics(viewport, track);
    if (!metrics) {
      return;
    }

    const offset = currentIndex * (metrics.itemWidth + metrics.gap);
    track.style.transform = `translateX(${-offset}px)`;
  };

  const resetOffset = () => {
    currentIndex = 0;
    track.style.transform = "translateX(0)";
  };

  const stepForward = () => {
    const metrics = getTrackMetrics(viewport, track);
    if (!metrics) {
      return;
    }

    currentIndex = currentIndex >= metrics.maxIndex ? 0 : currentIndex + 1;
    applyOffset();
  };

  const startRolling = () => {
    if (timerId) {
      return;
    }

    timerId = window.setInterval(stepForward, 900);
  };

  const stopRolling = () => {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
    resetOffset();
  };

  card.addEventListener("mouseenter", startRolling);
  card.addEventListener("mouseleave", stopRolling);
  card.addEventListener("focusin", startRolling);
  card.addEventListener("focusout", (event) => {
    if (!card.contains(event.relatedTarget)) {
      stopRolling();
    }
  });

  window.addEventListener("resize", applyOffset);
  resetOffset();
});
