import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const outputDir = path.join(process.cwd(), "out");
const port = Number(process.env.PORT || 3000);

if (!fs.existsSync(outputDir)) {
  console.error("Static output not found. Run `pnpm build` first.");
  process.exit(1);
}

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".xml": "application/xml; charset=utf-8",
};

function resolveRequestPath(urlPath: string): string | null {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath = decodedPath.replace(/^\/+/, "");
  const candidates = [
    path.join(outputDir, relativePath),
    path.join(outputDir, relativePath, "index.html"),
    path.join(outputDir, `${relativePath}.html`),
  ];

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(`${path.resolve(outputDir)}${path.sep}`)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }

  return null;
}

http
  .createServer((request, response) => {
    const filePath = resolveRequestPath(request.url || "/");
    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(response);
  })
  .listen(port, () => {
    console.log(`Static preview: http://localhost:${port}`);
  });
