const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_TMDB_BASEURL,
  apiKey: process.env.TMDB_API_KEY,
  headerKey: process.env.TMDB_HEADER_KEY,
  originalImage: (imgPath: string) =>
    `https://ik.imagekit.io/6inz30h0z/original${imgPath}`,
  w500Image: (imgPath: string) =>
    `https://ik.imagekit.io/6inz30h0z/w500${imgPath}`,
}

// old
// originalImage: (imgPath: string) =>
// `https://image.tmdb.org/t/p/original${imgPath}`,
// w500Image: (imgPath: string) => `https://image.tmdb.org/t/p/w500${imgPath}`,

const category = {
  movie: 'movie',
  tv: 'tv',
}

const movieType = {
  upcoming: 'upcoming',
  popular: 'popular',
  top_rated: 'top_rated',
  now_playing: 'now_playing',
  trending: 'trending',
}

const tvType = {
  popular: 'popular',
  top_rated: 'top_rated',
  on_the_air: 'on_the_air',
  trending: 'trending',
}

export { apiConfig, category, movieType, tvType }
