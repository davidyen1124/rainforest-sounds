/**
 * URL of a file in public/assets/. Vite does not rewrite paths inside JS strings, so they go through
 * BASE_URL: './' in the build (works at a domain root or under a sub-path), '/' in dev.
 */
export const asset = (file: string) => `${import.meta.env.BASE_URL}assets/${file}`;
