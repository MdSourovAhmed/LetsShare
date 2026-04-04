// import axios from 'axios';

// const api = axios.create({
//   baseURL: 'http://localhost:3000/api', // Updated to match backend port
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   console.log('API Request:', {
//     method: config.method.toUpperCase(),
//     url: config.url,
//     data: config.data,
//   });
//   return config;
// });

// api.interceptors.response.use(
//   (response) => {
//     console.log('API Response:', {
//       url: response.config.url,
//       data: response.data,
//     });
//     return response;
//   },
//   (error) => {
//     console.log('API Error:', {
//       url: error.config.url,
//       error: error.response?.data || error.message,
//     });
//     return Promise.reject(error);
//   }
// );

// export default api;




import axios from 'axios';

const api = axios.create({
  // baseURL: import.meta.env.VITE_API_URL,
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;