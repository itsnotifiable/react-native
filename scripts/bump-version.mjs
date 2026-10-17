import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { nextVersion } from "./next-version.mjs";

const packagePath = new URL("../package.json", import.meta.url);
const lockPath = new URL("../package-lock.json", import.meta.url);

const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const headVersion = readHeadVersion() ?? packageJson.version;

if (packageJson.version === nextVersion(headVersion)) {
  process.stdout.write(`Version ${packageJson.version} is already staged.\n`);
  process.exit(0);
}

const version = nextVersion(packageJson.version);
packageJson.version = version;
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
writeLockVersion(version);
process.stdout.write(`Version ${version}\n`);

function readHeadVersion() {
  try {
    const file = execFileSync("git", ["show", "HEAD:package.json"], {
      encoding: "utf8",
    });
    const parsed = JSON.parse(file);
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

function writeLockVersion(version) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  lock.version = version;

  if (lock.packages?.[""]) {
    lock.packages[""].version = version;
  }

  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}
