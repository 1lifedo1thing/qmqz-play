/* Density changes affect the sprite bitmap only. NGUI layout and hit boxes use design units. */
(() => {
  "use strict";
  const media = matchMedia("(min-resolution: 1.5dppx)");
  const decoded = new Map();
  const pending = new Map();
  const budget = 32 * 1024 * 1024;
  let decodedBytes = 0;
  let manifest;

  function imageAt(url, ratio) {
    const cached = decoded.get(url);
    if (cached) {
      decoded.delete(url);
      decoded.set(url, cached);
      return cached;
    }
    if (pending.has(url)) return pending.get(url);
    const image = new Image();
    image.dataset.ratio = ratio;
    image.src = url;
    const ready = image.decode().then(() => {
      const bytes = image.naturalWidth * image.naturalHeight * 4;
      if (bytes <= budget) {
        while (decodedBytes + bytes > budget) {
          const [oldUrl, old] = decoded.entries().next().value;
          decoded.delete(oldUrl);
          decodedBytes -= old.naturalWidth * old.naturalHeight * 4;
        }
        decoded.set(url, image);
        decodedBytes += bytes;
      }
      return image;
    }).finally(() => pending.delete(url));
    pending.set(url, ready);
    return ready;
  }

  async function load(url) {
    if (media.matches) {
      manifest ||= fetch("ui-hd/sprites.json").then(response => {
        if (!response.ok) throw Error(response.status);
        return response.json();
      }).catch(() => ({}));
      const hd = (await manifest)[url];
      if (hd) {
        try { return await imageAt(hd, 2); } catch { /* Original crop remains available. */ }
      }
    }
    return imageAt(url, 1);
  }
  window.qmqzUiDensity = {load, media};
})();
