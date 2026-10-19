/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { domains: ['bofgjrslnvtlvikdopxi.supabase.co'] },
  experimental: { serverActions: { bodySizeLimit: '2mb' } }
};
export default nextConfig;