(async () => {
  const status = document.getElementById("offline");
  const install = document.getElementById("install-offline");
  if (!("serviceWorker" in navigator)) {
    status.textContent = "离线安装需要 HTTPS 或本机地址";
    return;
  }
  // Only start a full download after the player has booted. On a public origin,
  // let new visitors play using on-demand assets until they choose offline play.
  if (!window.qmqzUnity) await new Promise(resolve => window.addEventListener("qmqz-ready", resolve, {once:true}));
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  async function register() {
    install.hidden = true;
    status.textContent = "正在准备离线资源…";
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        updateViaCache: "none"
      });
      function refresh() {
        if (registration.waiting) {
          status.textContent = "更新就绪，关闭所有游戏页后生效";
        } else if (registration.installing) {
          status.textContent = registration.active ? "正在缓存更新…" : "正在准备离线资源…";
        } else if (registration.active?.state === "activated") {
          status.textContent = "可离线游玩";
        }
      }
      function watch(worker) {
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant" && worker !== registration.active) {
            status.textContent = registration.active ? "更新失败，仍可离线使用旧版" : "离线准备失败";
            install.hidden = Boolean(registration.active);
          } else {
            refresh();
          }
        });
      }
      registration.addEventListener("updatefound", () => {
        watch(registration.installing);
        refresh();
      });
      navigator.serviceWorker.addEventListener("controllerchange", refresh);
      watch(registration.installing);
      watch(registration.active);
      refresh();
    } catch (error) {
      status.textContent = navigator.serviceWorker.controller ? "可离线游玩" : "离线准备失败，请联网刷新重试";
      install.hidden = Boolean(navigator.serviceWorker.controller);
      console.warn("Offline install:", error);
    }
  }
  install.addEventListener("click", register);
  try {
    const existing = await navigator.serviceWorker.getRegistration("./");
    if (loopback || existing?.scope === new URL("./", document.baseURI).href) await register();
    else install.hidden = false;
  } catch (error) {
    install.hidden = false;
    console.warn("Offline registration:", error);
  }
})();
