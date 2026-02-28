#!/usr/bin/env node

import puppeteer from "puppeteer-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.USERPROFILE || process.env.HOME;
const SCRAPING_DIR = join(HOME, ".cache", "browser-tools");
const AGENT_WINDOW_FILE = join(SCRAPING_DIR, "agent-window-url");

const browser = await puppeteer.connect({
	browserURL: "http://localhost:9222",
	defaultViewport: null,
}).catch(e => {
	console.error("✗ Could not connect to browser:", e.message);
	console.error("  Run: browser-start.js");
	process.exit(1);
});

try {
	// Unique anchor URL — pass directly to createTarget, no listener + goto needed
	const anchorUrl = `data:text/html,agent-window-${Date.now()}`;

	const client = await browser.target().createCDPSession();
	await client.send("Target.createTarget", { url: anchorUrl, newWindow: true });
	await client.detach();

	mkdirSync(SCRAPING_DIR, { recursive: true });
	writeFileSync(AGENT_WINDOW_FILE, anchorUrl, "utf8");

	console.log("✓ Agent window opened — browser agent will work here");
} finally {
	await browser.disconnect();
}
