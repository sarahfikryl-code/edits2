import "@/styles/globals.css";
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getApiBaseUrl } from "../config";
import apiClient from "../lib/axios";
import Image from "next/image";
import ErrorBoundary from "../components/ErrorBoundary";
import CustomHeader from "../components/publicHeader";

// PWA Service Worker Registration handled by next-pwa

// Preloader Component
function Preloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(380deg, #1FA8DC 0%, #FEB954 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-in-out'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          position: 'relative',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <Image 
            src="/logo.png" 
            alt="Mr. Ahmed Badr Logo" 
            width={150}
            height={150}
            style={{
              objectFit: 'cover',
              background: 'transparent'
            }}
          />
        </div>
        
        {/* Loading ring */}
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid rgb(27, 33, 36)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1; 
          }
          50% { 
            transform: scale(1.05); 
            opacity: 0.8; 
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Access Denied Preloader Component
function AccessDeniedPreloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: 'bold',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderTop: '4px solid #1FA8DC',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>🔒 Access Denied</div>
      <div style={{ fontSize: '1rem', opacity: 0.8 }}>Redirecting to login...</div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Redirect to Login Preloader Component
function RedirectToLoginPreloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: 'bold',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderTop: '4px solid #1FA8DC',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>🔒 Redirecting to login...</div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  // Create a new QueryClient instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
      },
      mutations: {
        retry: 1,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
      },
    },
  }));

  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [isCheckingAdminAccess, setIsCheckingAdminAccess] = useState(false);
  const [isRouteChanging, setIsRouteChanging] = useState(false);
  const [showRedirectToLogin, setShowRedirectToLogin] = useState(false);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const hasExpiredRef = useRef(false); // Track if we've already expired this subscription
  const hasLoggedOutRef = useRef(false); // Track if we've already called logout

  // Define public pages using useMemo to prevent recreation on every render
  const publicPages = useMemo(() => ["/", "/404", "/contact_developer", "/dashboard/student_info", "/student_not_found"], []);
  
  // Define admin-only pages
  const adminPages = useMemo(() => [
    "/manage_assistants", 
    "/manage_assistants/add_assistant", 
    "/manage_assistants/edit_assistant", 
    "/manage_assistants/delete_assistant", 
    "/manage_assistants/all_assistants"
  ], []);

  // Define developer-only pages
  const developerPages = useMemo(() => [
    "/subscription_dashboard",
    "/subscription_dashboard/yearly",
    "/subscription_dashboard/monthly",
    "/subscription_dashboard/daily",
    "/subscription_dashboard/hourly",
    "/subscription_dashboard/minutely",
    "/subscription_dashboard/cancel"
  ], []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check authentication with server (cookies are sent automatically)
        const response = await apiClient.get('/api/auth/me', {
          validateStatus: (status) => status < 500 // Accept 200-499 as valid responses
        });

        if (response.status === 200) {
          setIsAuthenticated(true);
          setUserRole(response.data.role);
          
          // Check if user is trying to access admin pages but is not admin or developer
          if (adminPages.includes(router.pathname) && response.data.role !== 'admin' && response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to dashboard after showing preloader
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/dashboard");
            }, 1000);
          }

          // Check if user is trying to access developer pages but is not developer
          if (developerPages.includes(router.pathname) && response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to dashboard after showing preloader
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/dashboard");
            }, 1000);
          }
        } else {
          // Token invalid (401 or other 4xx)
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (error) {
        // Only log unexpected errors (not 401 which is expected after logout)
        if (error.response?.status !== 401) {
          console.error('Unexpected auth error:', error);
        }
        // Token invalid or expired
        setIsAuthenticated(false);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router.pathname, adminPages, developerPages, router]);

  // Handle route changes for main preloader
  useEffect(() => {
    const handleRouteStart = () => {
      setIsRouteChanging(true);
    };

    const handleRouteComplete = () => {
      setIsRouteChanging(false); // Hide preloader immediately when page loads
    };

    const handleRouteError = () => {
      setIsRouteChanging(false);
    };

    router.events.on('routeChangeStart', handleRouteStart);
    router.events.on('routeChangeComplete', handleRouteComplete);
    router.events.on('routeChangeError', handleRouteError);

    return () => {
      router.events.off('routeChangeStart', handleRouteStart);
      router.events.off('routeChangeComplete', handleRouteComplete);
      router.events.off('routeChangeError', handleRouteError);
    };
  }, [router]);

  // Redirect to login if not authenticated and trying to access protected page
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !publicPages.includes(router.pathname)) {
      // Show redirect to login preloader before redirect
      setShowRedirectToLogin(true);
      
      // Save the current path for redirect after login (except dashboard)
      if (router.pathname !== "/dashboard") {
        // Store redirect path in a cookie or use router state
        document.cookie = `redirectAfterLogin=${router.pathname}; path=/; max-age=300`; // 5 minutes
      }
      
      // Redirect after showing preloader for 1 second
      setTimeout(() => {
        setShowRedirectToLogin(false); // Reset the state
        router.push("/");
      }, 1000); // Show preloader for 1 second
    }
  }, [isLoading, isAuthenticated, router.pathname, publicPages, router]);

  // Check admin or developer access for current route
  useEffect(() => {
    const checkAdminOrDeveloperAccess = async () => {
      // Only check if user is authenticated and trying to access admin pages
      if (isAuthenticated && adminPages.includes(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          // Allow both admin and developer roles
          if (response.data.role !== 'admin' && response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to dashboard after showing preloader
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/dashboard");
            }, 1000);
          }
        } catch (error) {
          console.error("❌ Error checking admin/developer access:", error);
          // If token validation fails, redirect to login
          setIsAuthenticated(false);
        }
      }
    };

    // Only check admin/developer access when route changes to an admin page
    if (isAuthenticated && adminPages.includes(router.pathname)) {
      checkAdminOrDeveloperAccess();
    }
  }, [router.pathname, isAuthenticated, adminPages, router]);

  // Reset Access Denied state when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      setShowAccessDenied(false);
    }
  }, [isAuthenticated]);

  // Fetch subscription data when authenticated
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isAuthenticated || publicPages.includes(router.pathname)) {
        setSubscription(null);
        return;
      }

      try {
        setIsLoadingSubscription(true);
        const response = await apiClient.get('/api/subscription');
        setSubscription(response.data);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    fetchSubscription();
    
    // Refetch subscription every 5 minutes
    const interval = setInterval(fetchSubscription, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, router.pathname, publicPages]);

  // Check subscription expiration and redirect non-developers to login
  useEffect(() => {
    // Only check if authenticated, not on public pages, and subscription data is loaded
    if (!isAuthenticated || publicPages.includes(router.pathname) || isLoadingSubscription || !subscription) {
      return;
    }

    // Allow developers to access regardless of subscription status
    if (userRole === 'developer') {
      return;
    }

    // Check if subscription is inactive
    if (!subscription.active) {
      console.log('⏰ Subscription is inactive, redirecting to login...');
      // Remove token from cookies by calling logout before redirect
      (async () => {
        try {
          await apiClient.post('/api/auth/logout');
        } catch (err) {
          console.error('Error logging out:', err);
        }
        setShowRedirectToLogin(true);
        setTimeout(() => {
          setShowRedirectToLogin(false);
          router.push("/");
        }, 1000);
      })();
      return;
    }

    // Check if subscription has expired (remaining time is 00:00:00:00)
    if (subscription.active && subscription.date_of_expiration) {
      const checkExpiration = () => {
        const now = new Date();
        const expiration = new Date(subscription.date_of_expiration);
        const diff = expiration - now;

        if (diff <= 0) {
          // Subscription has expired
          console.log('⏰ Subscription has expired, redirecting to login...');
                  // Remove token from cookies by calling logout before redirect
          (async () => {
                  if (!hasLoggedOutRef.current) {
                    hasLoggedOutRef.current = true;
                    try {
                      await apiClient.post('/api/auth/logout', {}, {
                        validateStatus: (status) => status < 500 // Accept 200-499 as success
                      }).catch(() => {
                        // Ignore errors - continue with redirect even if logout fails
                      });
                    } catch (err) {
                      // Ignore errors - continue with redirect even if logout fails
                      if (err.response?.status !== 400 && err.response?.status !== 401) {
                        console.error('Error logging out (continuing anyway):', err);
                      }
                    }
              }
              setShowRedirectToLogin(true);
              setTimeout(() => {
                setShowRedirectToLogin(false);
                router.push("/");
              }, 1000);
            })();
          return;
        }

        // Calculate remaining time
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Check if all time components are zero (00:00:00:00)
        if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
          console.log('⏰ Subscription remaining time is 00:00:00:00, removing token and redirecting to login...');
                  // Remove token from cookies by calling logout before redirect
          (async () => {
                  if (!hasLoggedOutRef.current) {
                    hasLoggedOutRef.current = true;
                    try {
                      await apiClient.post('/api/auth/logout', {}, {
                        validateStatus: (status) => status < 500 // Accept 200-499 as success
                      }).catch(() => {
                        // Ignore errors - continue with redirect even if logout fails
                      });
                    } catch (err) {
                      // Ignore errors - continue with redirect even if logout fails
                      if (err.response?.status !== 400 && err.response?.status !== 401) {
                        console.error('Error logging out (continuing anyway):', err);
                      }
                    }
              }
              setShowRedirectToLogin(true);
              setTimeout(() => {
                setShowRedirectToLogin(false);
                router.push("/");
              }, 1000);
            })();
        }
      };

      // Check immediately
      checkExpiration();
      
      // Set up interval to check every second
      const interval = setInterval(checkExpiration, 1000);
      
      return () => {
        clearInterval(interval);
        hasLoggedOutRef.current = false; // Reset logout flag when effect cleans up
      };
    }
  }, [isAuthenticated, subscription, isLoadingSubscription, router.pathname, publicPages, userRole, router]);

  // Note: Token expiry checking removed since we now use HTTP-only cookies
  // The server will handle token validation and expiry

  // Show loading while checking authentication, subscription, or during route changes
  if (isLoading || (isAuthenticated && isLoadingSubscription && !publicPages.includes(router.pathname)) || isRouteChanging) {
    return <Preloader />;
  }

  // Show redirect to login preloader if redirecting due to unauthorized access
  if (showRedirectToLogin) {
    return <RedirectToLoginPreloader />;
  }

  // Show access denied preloader if redirecting due to admin access denied
  if (showAccessDenied) {
    return <AccessDeniedPreloader />;
  }

  // For unauthorized users on protected pages, show loading (will redirect)
  if (!isAuthenticated && !publicPages.includes(router.pathname)) {
    return <Preloader />;
  }

  // Only show Header/Footer if user is authenticated
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MantineProvider>
            {router.pathname === "/dashboard/student_info" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "100vh",
                }}
              >
                <CustomHeader />
                <div style={{ flex: 1 }}>
                  <Component {...pageProps} />
                </div>
                <Footer />
              </div>
            ) : (
              <Component {...pageProps} />
            )}
            <ReactQueryDevtools initialIsOpen={false} />
          </MantineProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }
  

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <MantineProvider>
          <div className="page-container" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh' 
          }}>
            {router.pathname !== "/" && <Header />}
            
            {/* Session Expiry Warning */}
            {showExpiryWarning && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                backgroundColor: '#ff6b6b',
                color: 'white',
                padding: '10px',
                textAlign: 'center',
                zIndex: 9999,
                fontWeight: 'bold'
              }}>
                ⚠️ Your session will expire soon. Please save your work and log in again.
              </div>
            )}
            
            <div className="content" style={{ flex: 1 }}>
              <Component {...pageProps} />
            </div>
            {router.pathname !== "/" && <Footer />}
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </MantineProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
