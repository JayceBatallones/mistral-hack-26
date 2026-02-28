#!/usr/bin/env node

import puppeteer from "puppeteer-core";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const newTab = args.includes("--new");
const reload = args.includes("--reload");
const url = args.find(a => !a.startsWith("--"));

if (!url) {
	console.log("Usage: browser-nav.js <url> [--new] [--reload]");
	console.log("\nExamples:");
	console.log("  browser-nav.js https://example.com          # Navigate current tab");
	console.log("  browser-nav.js https://example.com --new    # Open in agent window (if running), else new tab");
	console.log("  browser-nav.js https://example.com --reload # Navigate and force reload");
	process.exit(1);
}

const HOME = process.env.USERPROFILE || process.env.HOME;
const AGENT_WINDOW_FILE = join(HOME, ".cache", "browser-tools", "agent-window-url");

const b = await Promise.race([
	puppeteer.connect({
		browserURL: "http://localhost:9222",
		defaultViewport: null,
	}),
	new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
]).catch((e) => {
	console.error("✗ Could not connect to browser:", e.message);
	console.error("  Run: browser-start.js");
	process.exit(1);
});

try {
	if (newTab) {
		let opened = false;

		// If an agent window exists, open the new tab inside it
		if (existsSync(AGENT_WINDOW_FILE)) {
			const anchorUrl = readFileSync(AGENT_WINDOW_FILE, "utf8").trim();
			const anchorPage = (await b.pages()).find(p => p.url() === anchorUrl);

			if (anchorPage) {
				// window.open(url) directly — no blank+capture+goto needed
				await anchorPage.evaluate((u) => window.open(u, "_blank"), url);
				console.log("✓ Opened in agent window:", url);
				opened = true;
			}
		}

		if (!opened) {
			const p = await b.newPage();
			await p.goto(url, { waitUntil: "domcontentloaded" });
			console.log("✓ Opened:", url);
		}
	} else {
		const pages = await b.pages();
		const p = pages.at(-1);
		await p.goto(url, { waitUntil: "domcontentloaded" });
		if (reload) {
			await p.reload({ waitUntil: "domcontentloaded" });
		}
		console.log("✓ Navigated to:", url);
	}
} finally {
	await b.disconnect();
}
