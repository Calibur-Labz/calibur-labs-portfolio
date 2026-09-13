import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Self-hosted on the VPS: emits `.next/standalone/server.js` plus only the
   * node_modules it needs. `deploy/deploy.sh` copies `public` and
   * `.next/static` in beside it, which standalone deliberately leaves out.
   */
  output: "standalone",
  images: {
    /**
     * Next 16 requires this allowlist — an unlisted `quality` on `<Image>` is
     * a build-time warning and the optimizer refuses it. 75 stays the default
     * for everything; 90 exists for the hero artwork, whose long dark
     * gradients band visibly at 75.
     */
    qualities: [75, 90],
  },
};

export default nextConfig;
