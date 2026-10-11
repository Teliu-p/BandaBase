import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const host = "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"]
]);

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store"
  });
  response.end(body);
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    send(response, 400, "Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";

  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.some(segment => segment === "." || segment === ".." || segment.startsWith(".")) ||
    segments.some(segment => ["tests", "supabase", "node_modules"].includes(segment))
  ) {
    send(response, 404, "Not found");
    return;
  }

  const filePath = resolve(projectRoot, "." + pathname);
  if (filePath !== projectRoot && !filePath.startsWith(projectRoot + sep)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    let body = await readFile(filePath);
    if (pathname === "/index.html") {
      const html = body.toString("utf8");
      body = Buffer.from(
        html.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ""),
        "utf8"
      );
    }

    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Content-Length": body.length
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      send(response, 404, "Not found");
      return;
    }

    console.error("Static test server error:", error);
    send(response, 500, "Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`BandaBase test server listening at http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
