import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../axios';

// Query keys for subscription
export const subscriptionKeys = {
  all: ['subscription'],
  detail: () => [...subscriptionKeys.all, 'detail'],
};

// API functions
const subscriptionApi = {
  // Get subscription
  get: async () => {
    const response = await apiClient.get('/api/subscription');
    return response.data;
  },

  // Create subscription
  create: async (subscriptionData) => {
    const response = await apiClient.post('/api/subscription', subscriptionData);
    return response.data;
  },

  // Cancel subscription (developer only)
  cancel: async () => {
    const response = await apiClient.put('/api/subscription');
    return response.data;
  },

  // Auto-expire subscription (any authenticated user)
  expire: async () => {
    const response = await apiClient.patch('/api/subscription', {}, {
      validateStatus: (status) => {
        // Accept 200-299 as success, and also 400/401 as they mean subscription expiration was handled
        return (status >= 200 && status < 300) || status === 400 || status === 401;
      }
    });
    return response.data;
  },
};

// React Query hooks
export const useSubscription = (options = {}) => {
  return useQuery({
    queryKey: subscriptionKeys.detail(),
    queryFn: () => subscriptionApi.get(),
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchIntervalInBackground: false,
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    retry: 2,
    retryDelay: 1000,
    ...options,
  });
};

// Mutations
export const useCreateSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subscriptionData) => subscriptionApi.create(subscriptionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
  });
};

export const useCancelSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.cancel(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
  });
};

export const useExpireSubscription = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.expire(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.detail() });
    },
    // Don't retry on 401/400 errors - they're expected if token is invalid
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status === 401 || status === 400) {
        return false; // Don't retry on auth errors
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
  });
};

