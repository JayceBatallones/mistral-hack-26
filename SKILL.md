# Skill: Luma Login via Google OAuth

## Context
- Video: luma_login_test.mov
- URL: https://lu.ma
- Purpose: Log in to Luma using an existing Google account and land on the authenticated Events page

## Steps

1. Navigate to `https://lu.ma`
2. Wait for the login page to load — verify "Welcome to Luma" heading is visible
3. Click the email input field
4. Type `ashk.0704@gmail.com` into the email field (dismiss autocomplete if it appears)
5. Click the "Continue with Email" button
6. If a "Guest Passcode" modal appears, dismiss it by clicking outside or closing it
7. Wait for the Google account selection page to load — verify "Sign in with Google" / "Choose an account" heading is visible
8. Click the account card for `yusuke0704@gmail.com` (displayed as "Yusuke Miyashita")
9. Wait for the Luma confirmation dialog — verify "You're signing back in to Luma" text is visible
10. Click the "Confirm" button
11. Wait for the "Linking Google Account" loading screen to complete
12. Wait for the Luma Events page to fully load — verify "Events" heading and event cards are visible

## Notes
- The Google OAuth flow redirects away from lu.ma temporarily — wait for redirects to complete before interacting
- Step 6 (Guest Passcode modal) may or may not appear; treat it as optional
- Steps 11–12 involve two loading phases: account linking spinner, then the Events feed skeleton loading
- Verify login success by checking for the Events page heading, not just URL change
- Email used: `ashk.0704@gmail.com` / Google account: `yusuke0704@gmail.com`
