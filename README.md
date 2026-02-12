<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/19wYRF4fgqqr6oLA0DVFq7MZFAJf9nEtX

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create `.env` or `.env.local` with:
   - `GEMINI_API_KEY` – your Gemini API key
   - `EMAIL_USER` – Gmail address (sender)
   - `EMAIL_PASS` – Gmail App Password ([create one](https://myaccount.google.com/apppasswords))
   - `EMAIL_TO` – (optional) recipient email; defaults to `EMAIL_USER`
3. Run the app (uses Netlify Dev so functions work locally):
   `npm run dev`
