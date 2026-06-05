/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't run ESLint during `next build`. Next walks up the directory tree for
  // an ESLint config and picks up a stray `D:\.eslintrc.js` (outside this
  // project) that references a module it can't resolve, which fails the build.
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;