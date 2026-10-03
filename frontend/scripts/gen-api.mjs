// 백엔드를 띄우지 않고 OpenAPI를 뽑아 TS 타입을 만든다. 백엔드 스키마를 고치면 다시 실행한다.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.resolve(root, "../backend");
const isWindows = process.platform === "win32";
const python = path.join(backend, ".venv", isWindows ? "Scripts/python.exe" : "bin/python");

const spec = execFileSync(
  python,
  ["-c", "import json; from app.main import app; print(json.dumps(app.openapi()))"],
  { cwd: backend, encoding: "utf-8" },
);
writeFileSync(path.join(root, "openapi.json"), spec);
execFileSync("npx openapi-typescript openapi.json -o lib/api/schema.d.ts", {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
