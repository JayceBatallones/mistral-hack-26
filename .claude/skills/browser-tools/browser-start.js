#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const useProfile = process.argv.includes("--profile");
const profileDirIdx = process.argv.indexOf("--profile-directory");
const profileDir = profileDirIdx !== -1 ? process.argv[profileDirIdx + 1] : null;

const knownFlags = ["--profile", "--profile-directory"];
const unknownArgs = process.argv.slice(2).filter(a => !knownFlags.includes(a) && !(profileDirIdx !== -1 && a === process.argv[profileDirIdx + 1]));
if (unknownArgs.length > 0) {
	console.log("Usage: browser-start.js [--profile] [--profile-directory <name>]");
	console.log("\nOptions:");
	console.log("  --profile                Copy your Chrome profile (cookies, logins)");
	console.log("  --profile-directory <n>  Chrome profile directory to use (e.g. 'Profile 2')");
	process.exit(1);
}

import { existsSync, mkdirSync, unlinkSync, cpSync } from "node:fs";
import { join } from "node:path";

const isWin = process.platform === "win32";
const HOME = process.env.USERPROFILE || process.env.HOME;
const SCRAPING_DIR = join(HOME, ".cache", "browser-tools");

// Check if already running on :9222
try {
	const browser = await puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	});
	await browser.disconnect();
	console.log("✓ Chrome already running on :9222");
	process.exit(0);
} catch {}

// Setup profile directory
mkdirSync(SCRAPING_DIR, { recursive: true });

// Remove SingletonLock to allow new instance
for (const lockFile of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
	try { unlinkSync(join(SCRAPING_DIR, lockFile)); } catch {}
}

if (useProfile) {
	console.log("Syncing profile...");
	const sourceProfile = isWin
		? join(HOME, "AppData", "Local", "Google", "Chrome", "User Data")
		: join(HOME, "Library", "Application Support", "Google", "Chrome");
	if (existsSync(sourceProfile)) {
		if (isWin) {
			// Use robocopy on Windows — it handles locked files gracefully
			// (skips them and continues, unlike cpSync which aborts).
			// /E = recursive, /R:0 = no retries on locked files, /W:0 = no wait,
			// /XF = exclude files, /XD = exclude dirs, /NFL /NDL /NJH /NJS = quiet
			const excludeFiles = ["SingletonLock", "SingletonSocket", "SingletonCookie"];
			const excludeDirs = ["Sessions", "Current Session", "Current Tabs", "Last Session", "Last Tabs"];
			const args = [
				`"${sourceProfile}"`, `"${SCRAPING_DIR}"`,
				"/E", "/R:0", "/W:0", "/MT:8",
				"/XF", ...excludeFiles.map(f => `"${f}"`),
				"/XD", ...excludeDirs.map(d => `"${d}"`),
				"/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS",
			];
			try {
				execSync(`robocopy ${args.join(" ")}`, { stdio: "pipe", timeout: 120000 });
			} catch (e) {
				// Robocopy exit codes 0-7 are success/warnings, 8+ are errors
				if (e.status >= 8) {
					console.log("⚠ Some files could not be copied (non-critical)");
				}
			}
		} else {
			try {
				cpSync(sourceProfile, SCRAPING_DIR, {
					recursive: true,
					force: true,
					filter: (src) => {
						const name = src.split(/[\\/]/).pop();
						return !["SingletonLock", "SingletonSocket", "SingletonCookie",
							"Sessions", "Current Session", "Current Tabs",
							"Last Session", "Last Tabs"].includes(name);
					},
				});
			} catch (e) {
				console.log("⚠ Some files could not be copied (non-critical):", e.message?.slice(0, 100));
			}
		}
	} else {
		console.log("⚠ Chrome profile not found at:", sourceProfile);
	}
}

// Determine Chrome executable path
let chromePath;
if (isWin) {
	const candidates = [
		join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe"),
		join(process.env["PROGRAMFILES(X86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
		join(HOME, "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
	];
	chromePath = candidates.find(p => existsSync(p));
	if (!chromePath) {
		console.error("✗ Chrome not found. Checked:", candidates.join(", "));
		process.exit(1);
	}
} else {
	chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

// Start Chrome with flags to force new instance
const chromeArgs = [
	"--remote-debugging-port=9222",
	`--user-data-dir=${SCRAPING_DIR}`,
	"--no-first-run",
	"--no-default-browser-check",
];
if (profileDir) {
	chromeArgs.push(`--profile-directory=${profileDir}`);
	console.log(`Using profile directory: ${profileDir}`);
}
spawn(
	chromePath,
	chromeArgs,
	{ detached: true, stdio: "ignore" },
).unref();

// Wait for Chrome to be ready
let connected = false;
for (let i = 0; i < 30; i++) {
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		connected = true;
		break;
	} catch {
		await new Promise((r) => setTimeout(r, 500));
	}
}

if (!connected) {
	console.error("✗ Failed to connect to Chrome");
	process.exit(1);
}

const profileMsg = [
	useProfile ? "with your profile" : "",
	profileDir ? `(${profileDir})` : "",
].filter(Boolean).join(" ");
console.log(`✓ Chrome started on :9222${profileMsg ? " " + profileMsg : ""}`);
