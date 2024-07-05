export type SiteConfig = typeof siteConfig

export const siteConfig = {
  name: 'Reely',
  description: 'Reely is a movie and tv show tracker built by Mohamed Gado.',
  mainNav: [
    {
      title: 'Home',
      href: '/',
      scroll: true,
    },
    {
      title: 'Movies',
      href: '/movies',
      scroll: true,
    },
    {
      title: 'TV Shows',
      href: '/tv-shows',
      scroll: true,
    },
    {
      title: 'Disclaimer',
      href: '/disclaimer',
      scroll: false,
    },
  ],
  personalLogo:
    'https://pbs.twimg.com/profile_images/1446549954231738370/IVkXC16N_400x400.jpg',
  links: {
    twitter: 'https://twitter.com/Sadge1996',
    github: 'https://github.com/Vette1123',
    website: 'https://www.mohamedgado.info/',
    buyMeACoffee: 'https://buymeacoffee.com/vetteotp',
  },
  openGraph: {
    locale: 'en_US',
    type: 'website',
  },
  email: 'boogado@yahoo.com',
  websiteURL: 'https://www.reely.live',
  twitterTag: '@Sadge1996',
  image:
    'https://pbs.twimg.com/profile_images/1446549954231738370/IVkXC16N_400x400.jpg',
  keywords: [
    'Software Engineer',
    'Frontend Engineer',
    'Web Developer',
    'React',
    'TypeScript',
    'JavaScript',
    'Node.js',
    'Mohamed Gado',
    'Gado',
    'Mohamed',
    'Gado Mohamed',
    'React Developer',
    'React Engineer',
    'React.js',
    'ReactJS',
    'React Developer',
    'Next.js',
    'NextJS',
    'Next.js Developer',
    'Next.js Engineer',
  ],
}
