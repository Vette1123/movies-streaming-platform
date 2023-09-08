export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: 'Sadge',
  description: 'Build your Sadge UI with Tailwind CSS and Next.js.',
  mainNav: [
    {
      title: 'Home',
      href: '/',
    },
    {
      title: 'Movies',
      href: '/movies',
    },
    {
      title: 'TV Shows',
      href: '/tv-shows',
    },
  ],
  personalLogo:
    'https://pbs.twimg.com/profile_images/1446549954231738370/IVkXC16N_400x400.jpg',
  links: {
    twitter: 'https://twitter.com/Sadge1996',
    github: 'https://github.com/Vette1123',
    website: 'https://www.mohamedgado.info/',
  },
}
