# My Life at a Glance

A private dashboard that works on your phone and computer, syncs between them, and keeps working offline.
Hosted on **Firebase** (sign-in + database + hosting), code kept on **GitHub**.

> Keep your GitHub repo **private**. Never commit `my-data-seed.json` or any backup file. They hold your balances. `.gitignore` already blocks them.

## 1. Firebase setup (about 10 minutes)
1. Go to https://console.firebase.google.com and **Create a project**.
2. **Build → Authentication → Get started.** Turn on **Email/Password** (and **Google** if you like).
3. **Build → Firestore Database → Create database** (production mode, any nearby region).
4. **Project settings → Your apps → Web (`</>`).** Register an app and copy the config.
5. Paste it into `public/firebase-config.js`.

## 2. Deploy from your computer
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy               # publishes the site and the security rules
```
Your app is live at `https://YOUR_PROJECT_ID.web.app`.

## 3. Put it on GitHub
```bash
git init
git add .
git commit -m "My life dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/my-life-dashboard.git   # create this repo first, set to Private
git push -u origin main
```
Optional auto-deploy on every push: run `firebase init hosting:github` (it sets the secret for you), and change `YOUR_PROJECT_ID` in `.github/workflows/firebase-hosting.yml`.

## 4. Bring your data over (nothing lost)
1. Open your live site and **create your account** (email and password, or Google).
2. Go to **Settings → Import data file** and choose `my-data-seed.json`.
3. Go to **Today → Import calendar (.ics)** and choose your exported `Family.ics`.

## 5. Install on your phone
- **iPhone:** open the site in Safari → Share → **Add to Home Screen**.
- **Android:** Chrome menu → **Install app**.
Use email and password to sign in on iPhone (Google pop-ups can be unreliable in home-screen apps).

## 6. FireCMS (admin screen for your data)
FireCMS gives you a form-style screen on your computer for editing balances, debts, Bible plans, books, supplements and goals. The app and FireCMS read and write the same data, so edits show up on your phone right away.
1. **Use a brand-new Firebase project for this app** (for example `my-life`). Do not reuse your basketball tryouts project: it has its own data, its own rules, and other coaches use it.
2. Open https://app.firecms.co and **connect your new project** (about a minute; it needs your Google account permissions).
3. Sign in to the live app once and import `my-data-seed.json` (step 4) so there is data for FireCMS to read.
4. In FireCMS, add the `life` collection. Each document there is your data, with sections for savings, debts, plans, books and goals.
5. `firestore.rules` already includes the FireCMS rule. Keep it when you redeploy.

## What works and what doesn't
- **Works:** tasks, Bible plan hearts, workouts, weigh-ins, steps, balances, HYS plan, charts, backups, offline use, sync across devices.
- **Calendar:** re-import the `.ics` file to refresh it. It doesn't update itself from Apple.
- **Reminders and the 5am email:** a web app can't send these on its own. Use repeating iPhone Reminders for your supplements.
- **Bank, Kindle, YouVersion, Apple Health:** not connected. Balances and steps are typed in; plans and books are updated in the app.

## Easier path: GitHub + Vercel (no terminal)
Firebase still stores your data and signs you in, but Vercel can host the site straight from GitHub with clicks only.
1. Do Firebase steps 1 to 5 above (project, sign-in, database, web config pasted into `public/firebase-config.js`).
2. In Firebase: **Firestore Database → Rules**, paste the contents of `firestore.rules`, and click **Publish**.
3. On github.com: **New repository** (set to **Private**) → **uploading an existing file** → drag in everything from this folder → **Commit**.
4. On vercel.com: sign up with GitHub → **Add New → Project** → pick the repo → **Deploy** (`vercel.json` already points it at `public`).
5. In Firebase: **Authentication → Settings → Authorized domains → Add domain**, and add your `something.vercel.app` address.
6. Open the site, create your account, then import `my-data-seed.json` (Settings) and `Family.ics` (Today).
