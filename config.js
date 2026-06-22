// Read by index.html as window.QA_CONFIG. Points the board at its repos and
// themes it to match the NYUS app (cream + teal, DM Sans). Keys must match the
// board's expectations: { owner, repo, privateRepo, branch, title, theme }.
// Omitting theme.accent keeps the board's hand-tuned teal CSS defaults.
window.QA_CONFIG = {
  "owner": "shakeebshaan",
  "repo": "nyus-qa-issues",
  "privateRepo": "nyus-qa-private",
  "branch": "main",
  "title": "NYUS QA",
  "theme": {
    "fontFamily": "\"DM Sans\", system-ui, -apple-system, sans-serif",
    "googleFontHref": "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap",
    "source": "src/index.css (NYUS design tokens)"
  }
};
