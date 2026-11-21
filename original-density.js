/* Density changes affect the sprite bitmap only. NGUI layout and hit boxes use design units. */
(() => {
  "use strict";
  const media = matchMedia("(min-resolution: 1.5dppx)");
  const decoded = new Map();
  let manifest;

  function imageAt(url, ratio) {
    if (!decoded.has(url)) {
      const image = new Image();
      image.dataset.ratio = ratio;
      image.src = url;
      decoded.set(url, image.decode().then(() => image).catch(error => {
        decoded.delete(url);
        throw error;
      }));
    }
    return decoded.get(url);
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
