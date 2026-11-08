import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep heavy / native-ish Node packages out of the Next bundler.
  serverExternalPackages: ["unpdf", "mammoth", "pg-boss", "@aws-sdk/client-s3", "@aws-sdk/lib-storage"],
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default config;
