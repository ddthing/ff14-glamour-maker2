const { spawn } = require("node:child_process");

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 2000);
    child.once("exit", finish);
  });
  if (child.exitCode !== null || process.platform !== "win32") return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.once("close", resolve);
    killer.once("error", resolve);
  });
}

module.exports = { stopChild };
