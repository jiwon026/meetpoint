// E2E용 백엔드. 전용 SQLite 파일을 새로 만들어 파이프라인 산출물을 적재한 뒤 서버를 띄운다.
// 카카오 키를 비워 외부 호출이 나가지 않게 한다 (콘텐츠 요청은 테스트가 가로챈다).
import { execFileSync, spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backend");
const python = path.join(backend, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const env = {
  ...process.env,
  DATABASE_URL: "sqlite:///./e2e.db",
  CORS_ORIGINS: "http://localhost:3100",
  KAKAO_REST_KEY: "",
  PYTHONIOENCODING: "utf-8",
};

// fs.rmSync는 Node 24의 Windows에서 한글 경로를 만나면 프로세스가 비정상 종료해서 unlinkSync를 쓴다.
const db = path.join(backend, "e2e.db");
if (existsSync(db)) unlinkSync(db);
execFileSync(python, ["-m", "scripts.init_db"], { cwd: backend, env, stdio: "inherit" });
execFileSync(python, ["-m", "pipeline.load"], { cwd: backend, env, stdio: "inherit" });

const server = spawn(python, ["-m", "uvicorn", "app.main:app", "--port", "8010"], { cwd: backend, env, stdio: "inherit" });
const stop = () => server.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop); // Windows에서는 신호 처리기가 거의 불리지 않아 종료 시에도 서버를 끈다
server.on("exit", (code) => process.exit(code ?? 0));
