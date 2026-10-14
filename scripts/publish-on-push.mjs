import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = readFileSync(0, "utf8");
const pushingMain = input.split("\n").some((line) => {
  const [, localSha, remoteRef] = line.split(" ");
  return (
    remoteRef === "refs/heads/main" &&
    localSha !== "0000000000000000000000000000000000000000"
  );
});

if (!pushingMain) {
  process.exit(0);
}

const { name, version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

if (published(name, version)) {
  process.stdout.write(`${name}@${version} is already on npm.\n`);
  process.exit(0);
}

const publish = spawnSync("npm", ["publish"], { stdio: "inherit" });
process.exit(publish.status ?? 1);

function published(name, version) {
  const result = spawnSync(
    "npm",
    ["view", `${name}@${version}`, "version", "--json"],
    { encoding: "utf8" },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.status === 0) {
    return true;
  }

  if (output.includes("E404")) {
    return false;
  }

  process.stderr.write(output);
  process.exit(result.status ?? 1);
}
