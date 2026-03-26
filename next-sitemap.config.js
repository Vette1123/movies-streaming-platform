/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://reely.space',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    additionalSitemaps: ['https://reely.space/server-sitemap-index.xml'],
  },
}
