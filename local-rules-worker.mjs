// Run only the bundled offline game's functions inside a dedicated browser worker.
import { loadPyodide } from "./StreamingAssets/rules/pyodide.mjs";

async function start() {
  const base = new URL("./StreamingAssets/rules/", self.location.href);
  const [runtime, response] = await Promise.all([
    loadPyodide({indexURL: base.href}),
    fetch(new URL("game.zip", base))
  ]);
  if (!response.ok) throw new Error("无法读取原版规则包");
  runtime.unpackArchive(await response.arrayBuffer(), "zip", {extractDir:"/game"});
  runtime.runPython("import sys; sys.path.insert(0, '/game'); from web_game import command");
  return runtime.globals.get("command");
}

const ready = start();
self.onmessage = async ({data}) => {
  try {
    const command = await ready;
    const result = await command(JSON.stringify(data.request));
    self.postMessage({id:data.id, result:JSON.parse(result)});
  } catch (error) {
    self.postMessage({id:data.id, error:String(error)});
  }
};
