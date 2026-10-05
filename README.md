# MTS AUV-ZHCET Club Blog (React + Express + Neon)

A dynamic club blog for MTS AUV-ZHCET using the PERN stack: PostgreSQL (Neon), Express, React, and Node.js. Posts, admin accounts, and private editor sessions are stored in PostgreSQL. PDF uploads are converted into editable Markdown drafts.

## What you need

- Node.js 20 or newer (Node.js 24 is installed on the development computer).
- A Neon PostgreSQL database.

## Start it on Windows

1. Open PowerShell in this project folder.
2. Copy the environment example and edit it:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

3. In the Neon dashboard, copy the connection string for your database. Set it as `DATABASE_URL` in `.env`. Keep the `sslmode=require` query option in the connection string. Generate a private session secret by running `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`, then replace `CHANGE_ME` in `.env` with its output.
4. Install the Node packages:

   ```powershell
   npm install
   ```

5. Add an admin username and a unique password of at least 12 characters to `.env`:

   ```dotenv
   ADMIN_USERNAME=your-private-username
   ADMIN_PASSWORD=choose-a-long-unique-password
   ```

   Create the admin account:

   ```powershell
   npm run create-admin
   ```

   The password is hashed before it is stored in Neon. You can remove the two `ADMIN_...` lines from `.env` after setup.

6. Start the Express API and React development site:

   ```powershell
   npm run dev
   ```

   Open `http://127.0.0.1:5173/`. The private editor is at `http://127.0.0.1:5173/admin/login`. There is no login link on the public site and no public sign-up.

## Sign in and manage posts

Start the API and site with `npm run dev`, then open `http://127.0.0.1:5173/admin/login`. Sign in with the `ADMIN_USERNAME` and `ADMIN_PASSWORD` values you set before running `npm run create-admin`. There is no default account, public sign-up, or login link on the public site. If you need to change the password, set a new `ADMIN_PASSWORD` in `.env` and run `npm run create-admin` again.

In the private editor, upload a text PDF to create a draft. Review the converted Markdown, upload JPG, PNG, WebP, or GIF images (up to 4 MB each), and the editor inserts each image into the Markdown at the cursor. Images and articles are stored in Neon. Choose **Save & publish article** to publish at `/<article-slug>/`. From the article list, you can edit an article, publish or unpublish it, or delete it. Deleting an article also deletes its uploaded images.

Scanned PDFs contain images instead of selectable text, so run OCR on them before uploading. PDF conversion is best-effort; review headings, line breaks, and tables before publishing.

## Production build

Set `NODE_ENV=production`, use HTTPS, and keep `SESSION_SECRET` secret and persistent. Build the React app, then start the Express server:

```powershell
npm run build
npm start
```

Express serves the built React files and API together. Keep `.env` private. Neon stores your articles and admin records in PostgreSQL.

## Deploy to Vercel

This repository includes `vercel.json` and an API function entry point for a single Vercel project. Push the repository to GitHub, then import it from the Vercel dashboard. Keep the project root set to the repository root (not the `client` folder). Vercel builds the React app into `client/dist` and routes the API through the Node function in `api/`.

In **Project Settings → Environment Variables**, add these for Production (and Preview if you want preview deployments to use the database):

- `DATABASE_URL`: the Neon **pooled** connection string, including `sslmode=require`.
- `SESSION_SECRET`: a random persistent secret of at least 32 characters.

For the first admin account, set `DATABASE_URL`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in your local `.env`, then run `npm run create-admin` once. Do not add the admin password to Vercel; the password hash is saved in Neon. After Vercel deploys, sign in at `https://<your-vercel-domain>/admin/login`.

Vercel Functions limit request bodies to 4.5 MB, so the PDF and image upload limits are set to 4 MB. Larger uploads require direct-to-object-storage uploads (for example, Vercel Blob) instead of sending the file through the function.
