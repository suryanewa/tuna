const FALLBACK_SITE_URL = "https://tuna.dev";

function withHttps(url: string) {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

function normalizeSiteUrl(url: string | undefined) {
  if (!url) return undefined;

  try {
    const parsed = new URL(withHttps(url));
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export const siteUrl =
  normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalizeSiteUrl(process.env.VERCEL_URL) ??
  FALLBACK_SITE_URL;
