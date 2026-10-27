import { spawnSync } from "node:child_process";
import { createReadStream, createWriteStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

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

await publishPackage();

async function publishPackage() {
  let result = runPublish();

  if (result.status !== 0 && output(result).includes("EOTP")) {
    const otp = await askOtp();

    if (otp.length === 0) {
      process.stderr.write("npm publish needs an authenticator code.\n");
      process.exit(1);
    }

    result = runPublish(otp);
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status ?? 1);
}

function runPublish(otp) {
  const env = { ...process.env };

  if (otp !== undefined) {
    env.npm_config_otp = otp;
  }

  return spawnSync("npm", ["publish", "--access", "public"], {
    encoding: "utf8",
    env,
    stdio: ["inherit", "pipe", "pipe"],
  });
}

function output(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function askOtp() {
  const input = createReadStream("/dev/tty");
  const sink = createWriteStream("/dev/tty");
  const prompt = createInterface({ input, output: sink });

  return new Promise((resolve) => {
    prompt.question("npm authenticator code: ", (code) => {
      prompt.close();
      input.destroy();
      sink.end();
      resolve(code.trim());
    });
  });
}

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
