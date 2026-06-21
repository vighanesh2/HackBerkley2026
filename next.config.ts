import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["tldraw", "@tldraw/editor", "@tldraw/store", "@tldraw/tlschema", "@tldraw/utils"],
};

export default nextConfig;
