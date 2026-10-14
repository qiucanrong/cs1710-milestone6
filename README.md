# Milestone 6 — access change × OB-GYN supply dashboard

SvelteKit + Svelte 5 + D3. See `CLAUDE.md` for data definitions and conventions.

```bash
npm install
npm run data    # rebuild static/data/ from data/ + us-atlas and print data/join checks
npm run dev
npm run build   # static site in build/; for a subdirectory: BASE_PATH=/repo-name npm run build
```

## Deploying (GitHub Pages)

`.github/workflows/deploy.yml` builds with `BASE_PATH=/<repo-name>` and publishes `build/` on
every push to `main`. In the GitHub repo: Settings → Pages → Source: **GitHub Actions**.
The site is now served at `https://qiucanrong.github.io/cs1710-milestone6/`.
