import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Avoid bundling libsql/Turso client in server build to prevent README/binary parsing issues
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
  webpack: (config) => {
    // Ignore README.md import from @libsql/isomorphic-ws
    config.module.rules.push({
      test: /README\.md$/,
      use: [
        {
          loader: require.resolve("raw-loader"),
        },
      ],
    });
    return config;
  },
};

export default nextConfig;
