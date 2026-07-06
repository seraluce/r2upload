export const siteConfig = {
  name: 'R2 上传',
  shortName: 'R2Upload',
  description: '使用 Cloudflare R2 的文件上传服务，支持预签名 URL 直传',
  url: 'https://upload.nelv.cn',
  logo: '/favicon.svg',
  author: {
    name: 'Seraluce',
    url: 'https://nelv.cn',
  },
  nav: [
    { name: '首页', href: '/' },
    { name: '管理后台', href: '/admin' },
  ],
  seo: {
    title: 'R2 上传 - Cloudflare R2 文件上传服务',
    description: '简单快速的文件上传服务，基于 Cloudflare R2 存储，支持预签名 URL 直传',
    keywords: 'R2上传,文件上传,Cloudflare,对象存储,图片上传',
    ogImage: '/og-image.png',
    twitterHandle: '',
  },
  upload: {
    maxSizeMB: 100,
    allowedTypes: [],
    blockedExtensions: ['.php', '.exe', '.sh', '.bat', '.html', '.htm', '.asp', '.jsp', '.py', '.pl'],
  },
  admin: {
    defaultPassword: 'admin123',
  },
  pwa: {
    enabled: true,
    themeColor: '#000000',
    backgroundColor: '#ffffff',
    display: 'standalone',
    orientation: 'portrait',
  },
  footer: {
    text: '',
    links: [
      { name: '管理后台', href: '/admin' },
    ],
  },
}
