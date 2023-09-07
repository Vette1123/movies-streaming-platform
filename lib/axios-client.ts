// import axios from 'axios'
// import queryString from 'query-string'
// import { toast } from 'sonner'

// import { apiConfig } from '@/lib/tmdbConfig'

// export const axiosClient = axios.create({
//   baseURL: apiConfig.baseUrl,
//   headers: {
//     'Content-Type': 'application/json',
//   },
//   params: {
//     page: 1,
//   },
//   paramsSerializer: (params) =>
//     queryString.stringify({ ...params, api_key: apiConfig.apiKey }),
// })

// axiosClient.interceptors.request.use(async (config) => config)

// axiosClient.interceptors.response.use(
//   (response) => {
//     if (response && response.data) {
//       return response.data
//     }

//     return response
//   },
//   (error) => {
//     toast.error(error.message)
//     throw error
//   }
// )
