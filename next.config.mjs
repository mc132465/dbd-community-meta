/** @type {import('next').NextConfig} */
// Strict build verification (type + lint errors fail the build) is ON by default.
// On low-memory hosts (e.g. a Raspberry Pi) the in-build type-check + lint and the
// webpack compile itself can exhaust the JS heap, which leaves `.next` without the
// standalone output. Set NEXT_STRICT_BUILD=false for the image build to (a) skip the
// in-build checks and (b) shrink the build's peak memory so it fits on a small host
// (run `pnpm typecheck` / `pnpm lint` separately). Default builds are unchanged.
const strictBuild = process.env.NEXT_STRICT_BUILD !== "false";

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  typescript: { ignoreBuildErrors: !strictBuild },
  eslint: { ignoreDuringBuilds: !strictBuild },
  // Production browser source maps are off (also reduces build memory). This is
  // the Next.js default; set explicitly so it can't regress.
  productionBrowserSourceMaps: false,
  // argon2 (native) and pg must not be bundled; load them as external Node
  // modules in Server Components / Server Actions.
  experimental: {
    serverComponentsExternalPackages: ["argon2", "pg"],
  },
  images: {
    // Asset icons are served locally from public/assets (Path B). No remote
    // image hosts are required for the default setup.
    remotePatterns: [],
  },
};

if (!strictBuild) {
  // Low-memory build: disable webpack's cache. Its in-memory build + on-disk
  // serialization ("Serializing big strings") is a primary source of heap
  // pressure and OOM crashes on small hosts. Default (strict) builds keep the
  // cache for speed; this only applies when NEXT_STRICT_BUILD=false.
  nextConfig.webpack = (config) => {
    config.cache = false;
    return config;
  };
}

export default nextConfig;
