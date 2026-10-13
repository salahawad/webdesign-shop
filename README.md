# SA Studio

A shared workspace for product managers, designers, and developers to upload AI-generated HTML prototypes, preserve every revision, and review what changed before handoff.

## Features

- Upload self-contained HTML files up to 750 KB.
- Add revisions to an existing design without replacing earlier files.
- Preserve author, role, source tool, notes, timestamp, and handoff status.
- Compare any two revisions through side-by-side previews or a highlighted HTML diff.
- Export source HTML and change reports, and share links to individual designs.
- Use a compact comparison workspace with more room for both previews.

The three example designs are labeled as examples. Uploading a revision to an example copies its history into your own database. Change summaries use deterministic HTML/CSS checks; they are not an AI interpretation or a pixel comparison. Uploaded previews execute in an isolated iframe without access to the studio origin. Use inline CSS/JavaScript, embedded assets, or absolute asset URLs; a single HTML upload does not include sibling files.

## Run locally

Requires Node.js 22.13 or newer in the Node 22 release line, and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Without `DATABASE_URL`, development automatically stores designs in `.data/studio.sqlite`. This directory is ignored by Git. Local uploads remain on this machine and are separate from any hosted database.

To test PostgreSQL or sign-in locally, copy `.env.example` to `.env.local` and fill in the values. Without `SESSION_SECRET`, the development server allows local access without signing in and binds to loopback. Production always requires user sign-in and PostgreSQL.

## Deploy on Vercel

1. Push this repository to GitHub and import it into Vercel. Choose **Next.js**, root directory **`.`**, and Node.js **22.x**. `vercel.json` supplies the install and build commands; keep the framework's default output directory.
2. Provision PostgreSQL through the Vercel Marketplace, or connect an existing PostgreSQL database. Prefer the provider's pooled connection URL with TLS enabled.
3. Add these server-side environment variables to the appropriate Vercel environments:

| Variable         | Purpose                                                         |
| ---------------- | --------------------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection URL. Never prefix it with `NEXT_PUBLIC_`. |
| `SESSION_SECRET` | Random signing secret, at least 32 characters.                  |

Generate the signing secret with this command:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Run the schema migration once against the target database before opening the deployment. In a local checkout, put that target `DATABASE_URL` in your ignored `.env.local`, then run:

```sh
npm run db:migrate
```

The migration is transactional, preserves existing rows, and can be rerun. Database credentials must have permission to create tables and indexes. Deploying the app does not run migrations automatically.

5. Create an account for each teammate against the same database (see [Team access](#team-access)), then deploy through Vercel and share the URL and each person's password through your usual private channel. Preview deployments also need their own environment variables and migrated database. Use a separate database for previews when you want to isolate test uploads.

The production app refuses database writes without a configured login and refuses filesystem storage on Vercel. The previous Cloudflare/Sites deployment and its data are separate; this conversion does not migrate that hosted database or change that deployment.

Vercel documentation: [Next.js deployment](https://vercel.com/docs/frameworks/full-stack/nextjs), [environment variables](https://vercel.com/docs/environment-variables/manage-across-environments), and [Marketplace integrations](https://vercel.com/docs/integrations).

## Team access

Each teammate signs in with their own username and password. Passwords are stored as salted scrypt hashes, and the HTTP-only signed session cookie expires after seven days. Create an account, or reset an existing account's password, with:

```sh
npm run user:add -- maya
```

The command prints a generated password once. It writes to PostgreSQL when `DATABASE_URL` is set (for example in `.env.local`), otherwise to the local SQLite file. To remove an account, delete its row from the `users` table; the person's sessions stop working on their next request.

All signed-in teammates can see all designs, upload revisions, and change handoff status. Author names and roles are entered by the uploader; they are attribution fields, not tied to the signed-in account. Changing `SESSION_SECRET` invalidates existing sessions. Public source code does not make the running studio or its uploaded designs public.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

GitHub Actions runs these checks on pushes and pull requests, starts a disposable PostgreSQL service, applies the schema, and tests simultaneous PostgreSQL uploads. Locally, that PostgreSQL test is skipped unless `STUDIO_TEST_DATABASE_URL` points to a migrated test database. Other tests cover revision preservation, concurrent local numbering, handoff persistence, missing designs, signed sessions, and request origin checks. PostgreSQL uploads use a transaction and a lock on the design row to serialize version numbers. Validate your actual hosted database connection after configuration.

## Public repository hygiene

Commit `.env.example`, the SQL schema, source files, generated brand assets, and the lockfile. Keep real `.env` files, database files, uploads, `.vercel`, build output, and `.sites-runtime` out of Git. The ignored `.sites-runtime` directory may contain local migration backups and is not part of the application or deployment.
