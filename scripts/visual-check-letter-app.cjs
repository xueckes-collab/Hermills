const { mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

const targetUrl = process.argv[2] || "http://127.0.0.1:5177";
const targetIsFile = targetUrl.startsWith("file:");
const outputDir = path.resolve("test-results", "letter-app");
const preloadPath = path.join(outputDir, "visual-preload.cjs");
const apiBaseUrl = process.env.VISUAL_HERMILLS_API_BASE_URL || "http://127.0.0.1:47322";
const desktopToken = process.env.VISUAL_HERMILLS_DESKTOP_TOKEN || "dev-token";
const viewports = [
  { name: "desktop", width: 1366, height: 768 },
  { name: "narrow", width: 760, height: 820 }
];
const views = ["工作台", "客户管理", "自动化", "发件人资料", "邮箱设置"];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function loadUrlWithRetry(win, url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await withTimeout(win.loadURL(url), 15000, `load ${url}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(900);
    }
  }
  throw lastError;
}

async function runViewport({ name, width, height }) {
  console.log(`checking ${name} ${width}x${height}`);
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !targetIsFile,
      preload: preloadPath
    }
  });

  await loadUrlWithRetry(win, targetUrl);
  await delay(1500);

  const opened = await win.webContents.executeJavaScript(`
    (() => {
      const textOf = (node) => ((node.getAttribute('aria-label') || '') + ' ' + (node.textContent || '')).trim();
      const button = [...document.querySelectorAll('button')].find((item) => /开发信|外联|outreach|Open outreach/i.test(textOf(item)));
      if (button) button.click();
      return Boolean(button);
    })()
  `);
  await delay(1200);

  const hasShell = await win.webContents.executeJavaScript(`Boolean(document.querySelector('.letter-app-shell'))`);
  if (!hasShell) {
    const bodyText = await win.webContents.executeJavaScript(`document.body.innerText.slice(0, 1200)`);
    const diagnostics = await win.webContents.executeJavaScript(`
      (async () => {
        const headers = { 'x-hermills-token': ${JSON.stringify(desktopToken)} };
        const appState = await fetch(${JSON.stringify(`${apiBaseUrl}/api/app-state`)}, { headers }).then((r) => r.text()).catch((error) => String(error));
        const runtime = await fetch(${JSON.stringify(`${apiBaseUrl}/api/runtime/status`)}, { headers }).then((r) => r.text()).catch((error) => String(error));
        return { appState, runtime };
      })()
    `);
    throw new Error(`Letter workspace did not open for ${name}. opened=${opened}. diagnostics=${JSON.stringify(diagnostics)} Body: ${bodyText}`);
  }

  const failures = [];
  for (const view of views) {
    await win.webContents.executeJavaScript(`
      (() => {
        const button = [...document.querySelectorAll('.letter-nav button')].find((item) => item.textContent.includes(${JSON.stringify(view)}));
        if (button) button.click();
      })()
    `);
    await delay(250);
    const result = await win.webContents.executeJavaScript(`
      (() => {
        const shell = document.querySelector('.letter-app-shell');
        const visible = (el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const main = shell.querySelector('.letter-main');
        const overflowEls = [...shell.querySelectorAll('button, input, textarea, .letter-panel, .letter-stat-card, .letter-lead-row, .letter-toolbar, .letter-filter-row, .letter-leads-layout, .letter-form-grid, .letter-action-row')]
          .filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX !== 'auto')
          .slice(0, 8)
          .map((el) => ({
            tag: el.tagName,
            className: el.className,
            text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 80),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth
          }));
        return {
          docOverflow: document.documentElement.scrollWidth > window.innerWidth + 3,
          shellOverflow: shell.scrollWidth > shell.clientWidth + 3,
          mainOverflow: main ? main.scrollWidth > main.clientWidth + 3 : false,
          shellHeight: shell.getBoundingClientRect().height,
          viewportHeight: window.innerHeight,
          overflowEls
        };
      })()
    `);
    if (result.docOverflow || result.shellOverflow || result.mainOverflow || result.overflowEls.length) {
      failures.push({ view, result });
    }
  }

  const image = await win.webContents.capturePage();
  await writeFile(path.join(outputDir, `letter-${name}.png`), image.toPNG());
  win.destroy();
  return { name, width, height, failures };
}

app.commandLine.appendSwitch("disable-gpu");
app.on("window-all-closed", () => {
  // Keep the Electron process alive while the script cycles through multiple viewports.
});

async function main() {
  await app.whenReady();
  await mkdir(outputDir, { recursive: true });
  await writeFile(preloadPath, `
    const { contextBridge } = require("electron");
    contextBridge.exposeInMainWorld("hermillsDesktop", {
      getConfig: async () => ({
        apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
        desktopToken: ${JSON.stringify(desktopToken)},
        platform: process.platform,
        version: "visual-test"
      }),
      selectWorkspaceDirectory: async () => ({ canceled: true })
    });
  `);

  const results = [];
  for (const viewport of viewports) results.push(await runViewport(viewport));
  const failures = results.flatMap((result) => result.failures.map((failure) => ({ viewport: result.name, ...failure })));
  const exitCode = failures.length ? 1 : 0;
  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, screenshots: results.map((result) => path.join(outputDir, `letter-${result.name}.png`)) }, null, 2));
  }
  app.exit(exitCode);
  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
  process.exit(1);
});
