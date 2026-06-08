/** @type {import('next').NextConfig} */
const path = require("path");
const fs = require("fs");

const overlayPkg = path.join(__dirname, "..", "packages", "overlay");
const overlayDist = path.join(overlayPkg, "dist");
const overlaySrc = path.join(overlayPkg, "src");

function readRetuneVersion() {
  const candidates = [
    path.join(__dirname, "node_modules", "retune", "package.json"),
    path.join(overlayPkg, "package.json"),
  ];

  for (const pkgPath of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.version) return pkg.version;
    } catch {}
  }

  return "0.0.0";
}

const nextConfig = {
  transpilePackages: ["retune"],
  outputFileTracingRoot: path.join(__dirname, ".."),
  env: {
    RETUNE_VERSION: readRetuneVersion(),
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        followSymlinks: true,
        ignored: [
          "**/node_modules/**",
          `!${overlayDist}/**`,
          `!${overlaySrc}/**`,
        ],
      };
      config.snapshot = {
        ...config.snapshot,
        managedPaths: [/^(.+?[\\/]node_modules[\\/])(?!retune)/],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
