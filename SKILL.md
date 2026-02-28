# Sign into Luma via Google OAuth

## Description
Sign into the Luma (lu.ma) event platform using Google OAuth authentication, dismiss the passkey setup prompt, and navigate to the home events feed.

## Steps

### 1. Navigate to Luma sign-in page
- **Tool:** `browser-tools`
- **Action:** Open `https://lu.ma/signin` in a new tab
- **Expected:** The Luma sign-in page loads with "Welcome to Luma" heading, email input, and social sign-in buttons

### 2. Click "Sign in with Google"
- **Tool:** `browser-tools`
- **Action:** Click the "Sign in with Google" button
- **Expected:** A Google OAuth popup window opens

### 3. Select Google account
- **Tool:** `browser-tools`
- **Action:** In the Google OAuth popup, wait for the "Choose an account" dialog to load, then click on the account `jyc.onlinebusiness@gmail.com` (Jayce Batallones)
- **Expected:** Google shows a consent/confirmation screen titled "You're signing back in to Luma"

### 4. Confirm Google sign-in
- **Tool:** `browser-tools`
- **Action:** Click the "Continue" button on the Google consent screen
- **Expected:** The popup closes and Luma shows a "Linking Google Account" transition screen with Luma and Google logos

### 5. Dismiss passkey prompt
- **Tool:** `browser-tools`
- **Action:** Wait for the "Create a Passkey" modal to appear, then click "Not Now"
- **Expected:** The passkey modal dismisses and a welcome animation plays showing the user's profile photo and "Welcome to Luma"

### 6. Verify home feed loaded
- **Tool:** `browser-tools`
- **Action:** Wait for redirect to `lu.ma/home` and verify the Events feed loads with upcoming events
- **Expected:** The Events page shows with "Upcoming" tab active and event cards visible
