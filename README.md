# 🎯 Reach The Target

A real-time two-player number strategy game built with plain HTML, CSS, JavaScript, and Firebase Firestore.

---

## How to Play

1. **Player 1** clicks **Create Game** and shares the 6-character room code (or link) with Player 2.
2. **Player 2** enters the code and clicks **Join Game**.
3. **Player 1** sets a **target number** (between 5 and 100).
4. Players take turns adding **1, 2, 3, or 4** to a running total that starts at 0.
5. The player who reaches the **target exactly** wins! Moves that would exceed the target are disabled automatically.

---

## Project Files

| File | Purpose |
|---|---|
| `index.html` | All HTML screens (home, lobby, game, winner overlay) |
| `style.css` | Responsive styles — dark glass theme, mobile-first |
| `app.js` | Game logic, Firebase integration, confetti animation |
| `firebase-rules.txt` | Firestore security rules to paste into Firebase Console |
| `README.md` | This file |

---

## Tech Stack

- **HTML / CSS / JavaScript** — no build tools, no frameworks
- **Firebase Firestore** — real-time NoSQL database for multiplayer sync
- **Firebase JS SDK v10** loaded via CDN ES modules

---

## Step 1 — Set Up Firebase

### 1.1 Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Enter a project name (e.g. `reach-the-target`)
4. Choose whether to enable Google Analytics (optional — not required by this game)
5. Click **Create project** and wait for it to be ready
6. Click **Continue**

### 1.2 Register a Web App

1. On the project overview page, click the **`</>`** (Web) icon under "Get started by adding Firebase to your app"
2. Enter a nickname for the app (e.g. `reach-the-target-web`)
3. Leave "Also set up Firebase Hosting" **unchecked** for now (we'll use GitHub Pages or Netlify)
4. Click **Register app**
5. Copy the `firebaseConfig` object — you'll need it in the next step:

```javascript
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

6. Click **Continue to console**

### 1.3 Paste Config into app.js

Open `app.js` and replace the placeholder `firebaseConfig` block (lines 25–33) with your values from the step above.

### 1.4 Enable Firestore

1. In the Firebase Console left menu, click **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll add proper rules next)
4. Select a Firestore location closest to your users (e.g. `europe-west2` for UK, `us-central` for US)
5. Click **Enable**

### 1.5 Set Firestore Security Rules

1. In the Firestore panel, click the **Rules** tab
2. Delete the existing content
3. Open `firebase-rules.txt` from this project and paste its entire contents into the Rules editor
4. Click **Publish**

---

## Step 2 — Test Locally

Because `app.js` uses ES modules (`import`/`export`), you cannot open `index.html` directly by double-clicking — browsers block module imports from `file://` URLs. Use any local server:

**Option A — VS Code Live Server**
Install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer), right-click `index.html`, choose **Open with Live Server**.

**Option B — Python**
```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080
```

**Option C — Node.js**
```bash
npx serve .
# then open the URL it prints
```

Open two browser tabs/windows to the same localhost URL to play both sides.

---

## Step 3 — Deploy

### Option A — GitHub Pages (free)

1. Create a free account at [github.com](https://github.com) if you don't have one
2. Click **New repository**, name it anything (e.g. `reach-the-target`), set it to **Public**, click **Create repository**
3. Upload all five project files (`index.html`, `style.css`, `app.js`, `firebase-rules.txt`, `README.md`) using the **Add file → Upload files** button
4. After upload, go to **Settings → Pages** (left sidebar)
5. Under **Source**, select **Deploy from a branch**
6. Set branch to `main` and folder to `/ (root)`, click **Save**
7. Wait ~1 minute. Your game will be live at:
   `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

> **Firebase domain allow-listing:** Go to Firebase Console → Authentication → Settings → Authorised domains and add your `github.io` domain if you see any Firebase errors.

---

### Option B — Netlify (free, drag-and-drop)

1. Create a free account at [netlify.com](https://netlify.com)
2. From the Netlify dashboard, drag your entire project folder (containing all 5 files) onto the **"Drag and drop your site folder here"** area
3. Netlify deploys in seconds and gives you a URL like `https://random-name.netlify.app`
4. To use a custom subdomain: **Site settings → Domain management → Options → Edit site name**

**Deploy via GitHub instead:**
1. Push your files to a GitHub repository (see Option A steps 1–3)
2. In Netlify, click **Add new site → Import an existing project**
3. Choose **GitHub** and authorise Netlify
4. Select your repository
5. Leave build settings blank (no build command needed)
6. Click **Deploy site**

Every `git push` to your repo will automatically redeploy.

---

## Firestore Data Structure

All games are stored in the `reach_the_target_rooms` Firestore collection.

Each document is identified by its **6-character room code** (e.g. `AB3XY7`) and contains:

```json
{
  "roomCode":     "AB3XY7",
  "creatorName":  "Alice",
  "joinerName":   "Bob",
  "targetNumber": 21,
  "currentTotal": 14,
  "currentTurn":  "joiner",
  "status":       "playing",
  "winner":       null,
  "moves": [
    { "by": "creator", "val": 3, "total": 3  },
    { "by": "joiner",  "val": 4, "total": 7  },
    { "by": "creator", "val": 2, "total": 9  }
  ],
  "createdAt":    "2026-09-29T10:00:00Z"
}
```

**Status values:**

| Status | Meaning |
|---|---|
| `waiting` | Room created, waiting for a second player |
| `set_target` | Joiner has joined; creator needs to set the target |
| `playing` | Game in progress |
| `finished` | A winner has been declared |

---

## Features

- Real-time multiplayer via Firestore `onSnapshot`
- Join via shared URL (`?room=XXXXXX`)
- Copy room code to clipboard
- Web Share API (`navigator.share`) on mobile
- Move validation — can't go out of turn, can't exceed target
- Moves that would exceed the target are visually disabled
- Progress bar showing current total vs target
- Move history log
- Confetti animation for the winner
- Play Again / rematch in the same room (same code, new target)
- Mobile-friendly responsive layout
- Works on phones, tablets, and laptops

---

## Customisation Tips

- **Change target range:** Edit `min="5" max="100"` on the target input in `index.html` and the matching validation in `handleStartGame()` in `app.js`
- **Change move options:** The four `<button class="move-btn">` elements in `index.html` control the available moves — you could add a `+5` button, for example
- **Change colours:** Edit the CSS variables at the top of `style.css` (`:root { --primary: ... }`)
- **Change collection name:** Update `GAMES_COLLECTION` in `app.js` and the path in `firebase-rules.txt` to match

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Blank page / Firebase error | Check you replaced `firebaseConfig` in `app.js` with your real values |
| "Room not found" when joining | Confirm both players are using the same `projectId` in their config |
| Changes not updating in real-time | Check Firestore rules are published and allow reads/writes |
| "Failed to load module" console error | Use a local server — don't open `index.html` directly from the filesystem |
| Confetti not showing | Confetti only plays for the winner; it's canvas-based and requires no libraries |

---

## License

MIT — free to use, modify, and deploy for personal or commercial projects.
