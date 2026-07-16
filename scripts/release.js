const { execSync } = require("node:child_process");
const path = require("node:path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const platform = process.argv[2];

if (!platform || !["win", "mac"].includes(platform)) {
  console.error("Usage: node scripts/release.js <win|mac>");
  process.exit(1);
}

if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error("\nGH_TOKEN is missing.\n");
  console.error("Option 1 - add to .env file in project root:");
  console.error("  GH_TOKEN=your_github_token_here\n");
  console.error("Option 2 - Windows PowerShell (same window, before release):");
  console.error('  $env:GH_TOKEN = "your_github_token_here"\n');
  console.error("Then run:");
  console.error(`  npm run release:${platform}\n`);
  process.exit(1);
}

console.log(`Publishing ${platform} release to GitHub...`);

execSync("npm run build", { stdio: "inherit", env: process.env });
execSync(`npx electron-builder --${platform} --publish always`, {
  stdio: "inherit",
  env: process.env,
  shell: true
});
