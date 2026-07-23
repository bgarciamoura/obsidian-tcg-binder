import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Usage: node release.mjs [patch|minor|major]
// Bumps manifest.json + package.json + versions.json, type-checks, commits,
// tags and pushes. The pushed tag triggers the GitHub release workflow.

const bump = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(bump)) {
	console.error(`Unknown bump type "${bump}" — use patch, minor or major.`);
	process.exit(1);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, data) => writeFileSync(path, JSON.stringify(data, null, "\t") + "\n");

const manifest = readJson("manifest.json");
const pkg = readJson("package.json");
const versions = readJson("versions.json");

const [major, minor, patch] = manifest.version.split(".").map(Number);
const next =
	bump === "major" ? `${major + 1}.0.0` :
	bump === "minor" ? `${major}.${minor + 1}.0` :
	`${major}.${minor}.${patch + 1}`;

console.log(`Bumping ${manifest.version} → ${next}`);

manifest.version = next;
pkg.version = next;
versions[next] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json", pkg);
writeJson("versions.json", versions);

// Type-check gate — abort the release on any type error.
execSync("npx tsc -noEmit -skipLibCheck", { stdio: "inherit" });

execSync("git add manifest.json versions.json package.json", { stdio: "inherit" });
execSync(`git commit -m "chore: bump version to ${next}"`, { stdio: "inherit" });
execSync(`git tag ${next}`, { stdio: "inherit" });
execSync(`git push && git push origin ${next}`, { stdio: "inherit" });

console.log(`Released ${next} — the tag push triggers the GitHub release workflow.`);
