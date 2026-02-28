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

// Listen for the new page — use .on() not .once() since other targets
// (e.g. omnibox popups) may fire first and consume the once listener
const newPagePromise = new Promise(resolve => {
	const handler = async (target) => {
		if (target.type() === "page") {
			browser.off("targetcreated", handler);
			resolve(await target.page());
		}
	};
	browser.on("targetcreated", handler);
});

// Use browser-level CDP session so Target.createTarget is properly handled
const browserTarget = browser.target();
const client = await browserTarget.createCDPSession();
await client.send("Target.createTarget", { url: "about:blank", newWindow: true });
await client.detach();

const anchorPage = await Promise.race([
	newPagePromise,
	new Promise((_, reject) => setTimeout(() => reject(new Error("timeout waiting for window")), 5000)),
]);

// Navigate anchor tab to a unique identifiable URL so we can find it later
const anchorUrl = `data:text/html,agent-window-${Date.now()}`;
await anchorPage.goto(anchorUrl);

mkdirSync(SCRAPING_DIR, { recursive: true });
writeFileSync(AGENT_WINDOW_FILE, anchorUrl, "utf8");

await browser.disconnect();
console.log("✓ Agent window opened — browser agent will work here");
