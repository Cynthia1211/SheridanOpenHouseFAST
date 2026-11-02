# Smart Chat Setup

The app can stay on GitHub Pages. A separate Cloudflare Worker calls Gemini for chat and quiz requests. The Gemini API key is stored as a Worker secret and is never placed in the browser code.

## Run locally

1. Install Node.js, then run `npm install` from the project directory.
2. Create a `.dev.vars` file in the project directory with this line: `GEMINI_API_KEY="paste-your-new-key-here"`. This file is listed in `.gitignore` and should not be committed.
3. In one terminal, run `npm run dev:chat` to start the Worker locally.
4. In another terminal, run `python3 -m http.server 8000` to serve the app.
5. Open `http://localhost:8000` in your browser.

## Deploy

1. Push the project to GitHub and publish the static site from **Settings → Pages**.
2. In `wrangler.jsonc`, set `ALLOWED_ORIGIN` to your GitHub Pages site origin, for example `https://your-name.github.io`. To allow multiple origins, separate them with commas. Include only the scheme and domain, without the project path.
3. Run `npx wrangler login` and authorize Cloudflare in the browser.
4. Run `npm run deploy:chat` to create the Worker. Wrangler prints the Worker URL.
5. Run `npx wrangler secret put GEMINI_API_KEY` and paste a new key created in Google AI Studio. This command updates the Worker deployment.
6. Set the URL in `chat-config.js` to your Worker URL with the `/api/chat` suffix, for example `https://sheridan-open-house-chat.your-account.workers.dev/api/chat`, then push the change to GitHub.

Never put the Gemini API key in `app.js`, `chat-config.js`, or the GitHub repository. If a key was previously placed in frontend code, revoke it in Google AI Studio and create a new key for the Worker.
