WAYFORWARD CRM - GITHUB FRONTEND

1. Upload index.html, config.js, all 6 *-client.js files and .nojekyll to your GitHub repository root.
2. Edit config.js -> set window.WAYFORWARD_API_ORIGIN to your NEW GoDaddy API hostname (HTTPS, no trailing slash).
3. GitHub -> Settings -> Pages -> Deploy from branch, main, root.
4. In GoDaddy .env / Secrets set WAYFORWARD_FRONTEND_ORIGIN to exact GitHub Pages origin.
    e.g. https://YOURNAME.github.io (not /REPO; URL origin contains no path).
5. Open GitHub Pages URL and login.
6. NOTE: GitHub.io and GoDaddy are cross-site. Some browsers block the session cookie as a third-party cookie.
   Preferred production deployment: use GitHub Pages custom domain crm.yourdomain.in and GoDaddy api.yourdomain.in; same site, different origins.
7. Frontend contains NO API access tokens, WhatsApp credentials, MySQL passwords or Admin key.

This frontend requires the matching GoDaddy backend and data migration.
