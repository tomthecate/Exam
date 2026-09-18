# How to Host and Share This Mock Exam Portal with Your Friends

This guide explains how you can post and share this website so your friends can take scheduled mock exams with you, compare scores on the shared leaderboard, and manage questions through the Admin Portal. Exam duration is always calculated at two minutes per question.

---

## Quick Start: Starting the Backend Server

The included server (`server.js`) requires **zero npm packages** and runs on any standard Node.js installation:

1. Open your Terminal on your Mac.
2. Navigate to your project folder:
   ```bash
   cd "/Users/urmiladebnath/Desktop/Exam prepration"
   ```
3. Start the server:
   ```bash
   node server.js
   ```
4. You will see output like this:
   ```text
   ====================================================
     MOCK GATE CBT EXAMINATION SERVER STARTED
   ====================================================
     Local URL:        http://localhost:3000
     Friend Wi-Fi URL: http://192.168.1.15:3000
     Admin Passcode:   admin123
   ====================================================
   ```

---

## 3 Easy Ways to Share with Your Friend

### Option 1: Local Wi-Fi / Hotspot (Instant, No Internet Needed)

If your friend is in the same room, house, library, or connected to your phone's Wi-Fi hotspot:
1. Copy the **Friend Wi-Fi URL** shown in your terminal (e.g. `http://192.168.1.15:3000`).
2. Send that link to your friend (via WhatsApp, Telegram, or email).
3. When your friend opens the link on their phone, tablet, or laptop, they will be prompted to enter their Name and Roll Number.
4. Both of you take the exam, and both of your scores will automatically appear on the shared **Leaderboard**!

---

### Option 2: Instant Free Public URL (Anywhere in the World)

If your friend is at their own home or in another city, you can generate a free, secure public HTTPS link in seconds without paying for hosting:

1. Keep `node server.js` running in one terminal.
2. In a second terminal window, run:
   ```bash
   npx cloudflared tunnel --url http://localhost:3000
   ```
   *(Or alternatively, using ngrok: `npx ngrok http 3000`)*
3. Cloudflare will print a free public URL such as:
   `https://random-words-1234.trycloudflare.com`
4. Send that URL to your friend! They can access it from anywhere in the world on any device.

---

### Option 3: Permanent Free 24/7 Cloud Hosting (Render.com / Railway.app)

To keep the website online 24/7 even when your laptop is turned off:

#### Step A: Push code to a GitHub repository
```bash
cd "/Users/urmiladebnath/Desktop/Exam prepration"
git init
git add .
git commit -m "GATE Mock CBT portal with admin and leaderboard"
# Push to your GitHub account (public or private repo)
```

#### Step B: Deploy on Render.com (100% Free)
1. Go to [https://render.com](https://render.com) and sign in with GitHub.
2. Click **New +** &rarr; **Web Service**.
3. Select your repository.
4. Configure:
   - **Environment**: Node
   - **Build Command**: *(leave empty)*
   - **Start Command**: `node server.js`
   - **Environment Variables** (Optional): `ADMIN_PASSCODE=your_secret_passcode`
5. Click **Deploy Web Service**.
6. Render will generate your permanent link (e.g., `https://gate-mock-exam.onrender.com`).
7. Share that link with your friend!

---

## How the Admin Portal Works

Only you have access to the **Admin Portal** to upload new questions and monitor scores:

1. Click the **"⚙️ Admin Portal"** button in the top header.
2. Enter the admin passcode: **`admin123`** (you can change this anytime in `server.js`).
3. You will have access to 4 tabs:

### 1. Upload Paper for Today
- Choose a `.json` question paper from your computer or paste raw JSON.
- Set the scheduled date (defaults to today).
- Check **"Set as Active Question Paper for Today"**.
- The system automatically validates question count, options, answer keys, and renders a live KaTeX math preview.
- Click **"Save & Activate Paper for Exam"**. The new paper instantly becomes live for both you and your friend!

### 2. Papers Library
- View all uploaded question papers.
- Switch between different test papers with one click.

### 3. Student Submissions & Live Scoreboard
- See all friends who took the exam.
- Shows their Rank, Candidate Name, Score (/40), Accuracy %, Correct/Incorrect counts, and submission time.
- Click **"Export to CSV"** to download an Excel-compatible spreadsheet of the results.

### 4. Schedule Settings
- Set the schedule inside each question-paper JSON:
  - `examDate`: exam date in `YYYY-MM-DD` format
  - `startTime`: exam start in 24-hour `HH:MM` format
  - `resultDate` and `resultTime`: published-result availability
- Do not add an end time or duration. The portal calculates the end as `questions.length × 2 minutes`.
- Each candidate sees their own result immediately after submission or timeout.
