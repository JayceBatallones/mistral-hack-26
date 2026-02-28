#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Chrome profile (cookies, logins)");
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
spawn(
	chromePath,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${SCRAPING_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
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

console.log(`✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`);
