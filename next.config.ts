import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Opt-in LAN access to the dev server, e.g. ALLOWED_DEV_ORIGINS=192.168.1.189.
  // Unset keeps Next's default of trusting only the server's own hostname.
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(","),
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
    ];
    // Deployed pages refuse to be framed; development stays embeddable in editor previews.
    // Sandboxed srcdoc previews are unaffected: they are not fetched, so no header applies.
    if (process.env.NODE_ENV === "production")
      headers.push({ key: "X-Frame-Options", value: "DENY" });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
