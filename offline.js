(async () => {
  const status = document.getElementById("offline");
  if (!("serviceWorker" in navigator)) {
    status.textContent = "离线安装需要 HTTPS 或本机地址";
    return;
  }
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
          status.textContent = registration.active ? "更新失败，仍可离线使用旧版" : "离线准备失败，请联网刷新重试";
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
    console.warn("Offline install:", error);
  }
})();
