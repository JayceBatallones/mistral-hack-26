# Skill: Luma Login via Google OAuth

## Context
- Video: luma_login_test.mov
- URL: https://lu.ma
- Purpose: Log in to Luma using an existing Google account and land on the authenticated Events dashboard

## Steps

1. Navigate to `https://lu.ma`
2. Wait for the login page to load — verify "Welcome to Luma" heading is visible
3. Click the "Sign in with Google" link (located below the "Continue with Email" button)
4. Wait for the Google OAuth consent modal to appear — verify Google branding and account selector are visible
5. Click the "Continue" button (cyan/turquoise) on the Google consent modal
6. If an email confirmation or verification modal appears, confirm or enter the required details
7. Wait for redirect back to Luma — verify the Events dashboard loads with an "Events" heading and event cards visible

## Verification

| Step | Signal |
|------|--------|
| Login page loaded | "Welcome to Luma" heading visible |
| Google OAuth modal open | Modal overlay with account selector and "Continue" button |
| OAuth granted | Modal closes and page redirects |
| Login success | Events page with "Events" heading; personal event feed with multiple event cards |

## Notes
- The login page shows both "Sign in with Google" and "Sign up with Google" links — use **"Sign in with Google"** for existing accounts
- The Google OAuth modal may show account selector if multiple Google accounts are active — select the intended account
- After login, the authenticated state is confirmed by the absence of a login form and the presence of the events feed
