import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const absolute = resolve(root, relative || "index.html");
  if (absolute !== root && !absolute.startsWith(root + sep)) return null;
  return absolute;
}

const server = createServer(async (request, response) => {
  const filePath = safePath(request.url || "/");
  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Acceso denegado");
    return;
  }

  try {
    let target = filePath;
    const info = await stat(target).catch(() => null);
    if (info?.isDirectory()) target = join(target, "index.html");
    const content = await readFile(target);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "camera=*, microphone=*",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("404 · Recurso no encontrado");
  }
});

server.listen(port, host, () => {
  console.log(`Rafy MR listo en http://${host}:${port}`);
});
