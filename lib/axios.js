import axios from 'axios';
import { getApiBaseUrl } from '../config';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // This ensures cookies are sent with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      withCredentials: config.withCredentials,
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for debugging
apiClient.interceptors.response.use(
  (response) => {
    // Only log successful responses in development, skip 401s and expected errors
    if (process.env.NODE_ENV === 'development' && response.status !== 401) {
      console.log('✅ API Response:', {
        status: response.status,
        url: response.config.url,
        data: response.data,
      });
    }
    return response;
  },
  (error) => {
    // Don't log expected errors (401 after logout, 400 from subscription expiration)
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isExpectedError = 
      status === 401 || // Unauthorized (expected after logout)
      (status === 400 && url.includes('/api/subscription')); // Subscription expiration check
    
    if (!isExpectedError && process.env.NODE_ENV === 'development') {
      console.error('❌ API Error:', {
        status: status,
        url: url,
        message: error.message,
        data: error.response?.data,
      });
    }
    return Promise.reject(error);
  }
);

export default apiClient;

