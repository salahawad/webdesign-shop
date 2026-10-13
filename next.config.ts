import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // Lets LAN devices hydrate the dev server when it is bound to 0.0.0.0.
  allowedDevOrigins: ["192.168.*.*", "*.lan"],
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
