// Build identity, baked in at image-build time (CI passes the commit SHA as
// VITE_BUILD_ID). Shown in the Settings and Sign-in footers so any device —
// installed PWA or browser — can answer "which build am I actually running?"
// without developer tools. Local dev shows "dev".
export const BUILD_ID = (import.meta.env.VITE_BUILD_ID || 'dev').slice(0, 7)
