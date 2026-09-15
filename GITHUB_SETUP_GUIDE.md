# How to Host on GitHub Pages & Operate Without a Server

This guide explains how to upload this mock exam website to **GitHub Pages** so you never have to run a server on your Mac. The website will run 24/7 online for free, accessible to both you and your friends from any device.

---

## Step 1: Create a GitHub Repository

1. Go to [https://github.com/new](https://github.com/new) in your browser (log in to your GitHub account).
2. Set **Repository name**: `gate-mock-exam` (or any name you choose).
3. Set visibility to **Public** (required for free GitHub Pages).
4. Do **not** check "Add a README file" (we already have all files ready).
5. Click **Create repository**.

---

## Step 2: Upload Files to GitHub

Choose **Option A (Terminal - Fastest)** or **Option B (Browser Drag & Drop)**:

### Option A: Using Terminal (Takes 30 Seconds)
Open Terminal on your Mac and run these commands:
```bash
cd "/Users/urmiladebnath/Desktop/Exam prepration"
git init
git add .
git commit -m "GATE Mock Exam CBT Portal with LaTeX and Leaderboard"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```
*(Replace `<YOUR_GITHUB_USERNAME>` and `<YOUR_REPO_NAME>` with your actual GitHub username and repository name).*

### Option B: Using GitHub Web Browser
If you prefer not to use git terminal commands:
1. On your newly created GitHub repository page, click **"uploading an existing file"**.
2. Drag and drop all the folders and files (`index.html`, `css/`, `js/`, `data/`, etc.) from your `Exam prepration` folder into GitHub.
3. Click **Commit changes**.

---

## Step 3: Turn On GitHub Pages (Free 24/7 Hosting)

1. In your GitHub repository, click on **Settings** (tab at the top right).
2. In the left sidebar menu, click **Pages** (under "Code and automation").
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and folder `/ (root)`.
4. Click **Save**.
5. Wait 60 seconds. Refresh the page. You will see a banner:
   > **"Your site is live at `https://<YOUR_USERNAME>.github.io/<YOUR_REPO_NAME>/`"**

**Send this link to your friend!** That's the permanent link you and your friend will open.

---

## How to Change / Upload Questions for Each Day

You do not need a server to change question papers. You have two easy ways:

### Method 1: Edit `today_paper.json` Directly on GitHub.com (Easiest)
1. Open your repository on [GitHub.com](https://github.com).
2. Click on the `data` folder &rarr; click on `today_paper.json`.
3. Click the **Pencil icon** (Edit this file).
4. Select all and paste your new JSON question paper with your answers and solutions.
5. Click **Commit changes**.
6. GitHub Pages will automatically refresh with today's new question paper!

### Method 2: From the Website Admin Portal
1. Open your live exam website.
2. Click **⚙️ Admin Portal** (passcode: `admin123`).
3. Under **"Upload Paper for Today"**, select your new `.json` file or paste the JSON text. The portal validates all LaTeX equations and shows a live preview.
4. Click **"📥 Download today_paper.json"**, then drop the downloaded file into your GitHub repository `data/` folder.
5. *(Optional)* If you enter your GitHub Personal Access Token once in **Admin Settings**, you can click **"☁️ Push Directly to GitHub Repository"** to update GitHub directly from the webpage with 1 click!

---

## How You and Your Friend Compare Scores (Leaderboard)

1. At 9:00 PM, both you and your friend open the GitHub link on your phones or laptops.
2. Enter your names (e.g. "Urmila" and "Friend's Name").
3. Take the 40-minute test.
4. After completing the exam, on the results screen:
   - Click **"🔗 Share Score Link"**.
   - A link is copied to your clipboard (e.g. `https://...?score=...`).
   - Send this link to your friend on WhatsApp or Telegram!
5. When your friend clicks the link, your score is automatically verified and added to their **🏆 Leaderboard**!
6. Alternatively, in the Leaderboard modal, either of you can paste the score link into the **"Add / Compare Friend's Score"** box to view side-by-side rankings.
