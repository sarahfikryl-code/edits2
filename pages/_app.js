import "@/styles/globals.css";
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getApiBaseUrl } from "../config";
import apiClient from "../lib/axios";
import Image from "next/image";
import ErrorBoundary from "../components/ErrorBoundary";

// PWA Service Worker Registration handled by next-pwa

// DevTools Protection Component (only active in production)
function DevToolsProtection({ userRole }) {
  const router = useRouter();
  const [devToolsDetected, setDevToolsDetected] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [timer, setTimer] = useState(15);

  // Check if on login page
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const isLoginPage = currentPath === '/';

  // On login page, show message for ALL users (including developers)
  // On other pages, bypass for developers
  if (!isLoginPage && userRole === 'developer') {
    return null;
  }

  useEffect(() => {
    // Enable protection in both development and production for testing

    // Disable right-click (but allow left-click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    // Disable keyboard shortcuts
    const handleKeyDown = (e) => {
      // Disable F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Disable Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j' || e.keyCode === 74)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Disable Ctrl+Shift+C (Element Inspector)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.keyCode === 67)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      
      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // DevTools detection using multiple methods
    let devToolsCheckInterval;
    let devToolsDetectedFlag = false;

    const detectDevTools = () => {
      if (devToolsDetectedFlag) return;

      // Method 1: Check window size difference (devtools open changes dimensions)
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      
      if (widthDiff > 160 || heightDiff > 160) {
        devToolsDetectedFlag = true;
        setDevToolsDetected(true);
        return;
      }

      // Method 2: Use debugger statement (triggers when devtools is open)
      let devtoolsOpen = false;
      const start = performance.now();
      
      // Create a function that will be detected if devtools is open
      const checkDevTools = () => {
        // Use native browser Image constructor, not Next.js Image component
        const element = new window.Image();
        let detected = false;
        
        Object.defineProperty(element, 'id', {
          get: function() {
            detected = true;
            devtoolsOpen = true;
          }
        });
        
        // This will trigger the getter if console is open
        requestAnimationFrame(() => {
          console.log(element);
          console.clear();
        });
        
        return detected;
      };

      // Method 3: Check console timing
      const consoleStart = performance.now();
      console.log('%c', '');
      const consoleEnd = performance.now();
      
      if (consoleEnd - consoleStart > 1) {
        devToolsDetectedFlag = true;
        setDevToolsDetected(true);
        return;
      }

      // Method 4: Use debugger to detect
      try {
        debugger; // This will pause if devtools is open
      } catch (e) {
        // Ignore
      }

      // Check using the getter method
      if (checkDevTools()) {
        devToolsDetectedFlag = true;
        setDevToolsDetected(true);
        return;
      }
    };

    // Start detection with multiple intervals for better coverage
    devToolsCheckInterval = setInterval(detectDevTools, 500);
    
    // Initial check
    setTimeout(detectDevTools, 1000);

    // Add event listeners with capture phase
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('keydown', handleKeyDown, true);

    // Cleanup
    return () => {
      clearInterval(devToolsCheckInterval);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Handle logout when devtools detected (only after 15 seconds if still open, skip on login page)
  useEffect(() => {
    // Check if on login page
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isLoginPage = currentPath === '/';
    
    // On login page, only check if devtools are closed (no timer, no redirect)
    if (isLoginPage && devToolsDetected) {
      const checkInterval = setInterval(() => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        
        if (widthDiff < 160 && heightDiff < 160) {
          const consoleStart = performance.now();
          console.log('%c', '');
          const consoleEnd = performance.now();
          
          if (consoleEnd - consoleStart < 1) {
            clearInterval(checkInterval);
            setDevToolsDetected(false);
          }
        }
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
    
    // For non-login pages, set up timer and redirect
    if (devToolsDetected && !isLoggingOut && !isLoginPage) {
      let redirectTimeout;
      let checkInterval;
      let timerInterval;
      
      // Reset timer to 15 when devtools detected
      setTimer(15);
      
      let currentTime = 15;
      
      // Countdown timer that updates every second
      timerInterval = setInterval(() => {
        currentTime = currentTime - 1;
        setTimer(currentTime);
        
        if (currentTime <= 0) {
          clearInterval(timerInterval);
          setTimer(0);
        }
      }, 1000);
      
      // Set 15 second timer for redirect
      redirectTimeout = setTimeout(() => {
        // Clear timer interval if still running
        clearInterval(timerInterval);
        
        // Check if devtools are still open
        if (devToolsDetected) {
          setIsLoggingOut(true);
          setTimer(0);
          
          // Call logout API to clear HttpOnly token cookie
          const logout = async () => {
            try {
              await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
              });
            } catch (error) {
              // Ignore errors, continue with cleanup
            }
            
            // Clear all other cookies (non-HttpOnly ones)
            const cookies = document.cookie.split(";");
            cookies.forEach((c) => {
              const eqPos = c.indexOf("=");
              const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
              if (name) {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
              }
            });
            
            // Clear localStorage
            try {
              localStorage.clear();
            } catch (e) {
              // Ignore
            }
            
            // Clear sessionStorage
            try {
              sessionStorage.clear();
            } catch (e) {
              // Ignore
            }
            
            // Redirect to login
            window.location.href = '/';
          };
          
          logout();
        }
      }, 15000); // 15 seconds
      
      // Check if devtools are closed (every 500ms)
      checkInterval = setInterval(() => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        
        // If devtools appear to be closed (dimensions normalized)
        if (widthDiff < 160 && heightDiff < 160) {
          // Double check with console timing
          const consoleStart = performance.now();
          console.log('%c', '');
          const consoleEnd = performance.now();
          
          if (consoleEnd - consoleStart < 1) {
            // Devtools appear to be closed, reset state
            clearTimeout(redirectTimeout);
            clearInterval(checkInterval);
            clearInterval(timerInterval);
            setDevToolsDetected(false);
            setIsLoggingOut(false);
            setTimer(15);
          }
        }
      }, 500);
      
      return () => {
        clearTimeout(redirectTimeout);
        clearInterval(checkInterval);
        clearInterval(timerInterval);
      };
    } else if (!devToolsDetected) {
      // Reset timer when devtools are not detected
      setTimer(15);
    }
  }, [devToolsDetected, isLoggingOut]);

  // Render protection in both development and production for testing
  // Show protection on all pages including login page (but with different behavior)
  if (devToolsDetected) {
    return (
      <>
        {/* Dark overlay background with blur */}
        <div
          data-devtools-overlay
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 99999,
            pointerEvents: 'auto',
            cursor: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        
        {/* Popup message container with black background */}
        <div
          data-devtools-message-container
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100000,
            backgroundColor: '#000000',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '20px',
            minWidth: '400px',
            maxWidth: '90%',
            cursor: 'none',
            pointerEvents: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div 
            className="devtools-icon"
            style={{
              color: 'white',
              fontSize: '3rem'
            }}
          >🔒</div>
          <div 
            className="devtools-message"
            style={{
              color: 'white',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              textAlign: 'center',
              lineHeight: '1.5'
            }}
          >
            {isLoginPage ? (
              <>Developer tools detected. Please close them to continue.</>
            ) : (
              <>
                Developer tools detected. Close them to continue or you'll be redirected to login in{' '}
                <span className="devtools-timer" style={{
                  color: '#1FA8DC',
                  fontSize: '1.8rem',
                  fontWeight: 'bold'
                }}>{timer.toString().padStart(2, '0')}</span>
                {' '}seconds.
              </>
            )}
          </div>
          {isLoggingOut && (
            <div 
              className="devtools-spinner"
              style={{
                width: '50px',
                height: '50px',
                border: '4px solid rgba(255, 255, 255, 0.3)',
                borderTop: '4px solid #1FA8DC',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginTop: '10px'
              }} 
            />
          )}
        </div>
        
        <style jsx global>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          * {
            cursor: none !important;
            pointer-events: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
          }
          body {
            overflow: hidden !important;
          }
          input, textarea, select, button, a {
            pointer-events: none !important;
            cursor: none !important;
          }
          *:focus {
            outline: none !important;
          }
          [data-devtools-message-container] {
            filter: none !important;
            -webkit-filter: none !important;
          }
          [data-devtools-message-container] * {
            filter: none !important;
            -webkit-filter: none !important;
          }
          
          /* Responsive styles for devtools message */
          @media (max-width: 768px) {
            [data-devtools-message-container] {
              min-width: 90% !important;
              max-width: 95% !important;
              padding: 30px 20px !important;
              border-radius: 15px !important;
              gap: 16px !important;
            }
            .devtools-icon {
              font-size: 2.5rem !important;
            }
            .devtools-message {
              font-size: 1.2rem !important;
              line-height: 1.4 !important;
            }
            .devtools-timer {
              font-size: 1.5rem !important;
            }
            .devtools-spinner {
              width: 40px !important;
              height: 40px !important;
              border-width: 3px !important;
            }
          }
          
          @media (max-width: 480px) {
            [data-devtools-message-container] {
              min-width: 95% !important;
              max-width: 98% !important;
              padding: 24px 16px !important;
              border-radius: 12px !important;
              gap: 14px !important;
            }
            .devtools-icon {
              font-size: 2rem !important;
            }
            .devtools-message {
              font-size: 1rem !important;
              line-height: 1.3 !important;
            }
            .devtools-timer {
              font-size: 1.3rem !important;
            }
            .devtools-spinner {
              width: 35px !important;
              height: 35px !important;
              border-width: 3px !important;
            }
          }
          
          @media (max-width: 360px) {
            [data-devtools-message-container] {
              padding: 20px 12px !important;
              border-radius: 10px !important;
              gap: 12px !important;
            }
            .devtools-icon {
              font-size: 1.8rem !important;
            }
            .devtools-message {
              font-size: 0.9rem !important;
              line-height: 1.2 !important;
            }
            .devtools-timer {
              font-size: 1.2rem !important;
            }
            .devtools-spinner {
              width: 30px !important;
              height: 30px !important;
              border-width: 2px !important;
            }
          }
        `}</style>
      </>
    );
  }

  return null;
}

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
            alt="Demo Attendance System Logo" 
            width={150}
            height={150}
            style={{
              objectFit: 'cover',
              background: 'transparent',
              borderRadius: '50%'
            }}
          />
        </div>
        
        {/* Loading ring */}
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255, 255, 255, 0.3)',
          borderTop: '4px solid #00101f',
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
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
      </div>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        body {
          overflow: hidden !important;
        }
        * {
          pointer-events: none !important;
        }
        body > * {
          filter: blur(15px) !important;
          -webkit-filter: blur(15px) !important;
        }
      `}</style>
    </>
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

// Helper functions for route checking
const isDashboardRoute = (path) => {
  return path.startsWith('/dashboard');
};

const isStudentDashboardRoute = (path) => {
  return path.startsWith('/student_dashboard');
};

export default function App({ Component, pageProps }) {
  // Create a new QueryClient instance
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15 * 60 * 1000, // 15 minutes
        gcTime: 20 * 60 * 1000, // 20 minutes
        retry: 3,
        retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchOnMount: true,
        refetchInterval: false, // No auto-refresh - only manual refresh
        refetchIntervalInBackground: false,
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

  // Define public pages using useMemo to prevent recreation on every render
  const publicPages = useMemo(() => ["/", "/sign-up", "/contact_developer", "/contact_assistants", "/404", "/forgot_password"], []);
  
  // Define pages that should never show header/footer (even if authenticated)
  const noHeaderFooterPages = useMemo(() => ["/", "/sign-up", "/student_dashboard/my_homeworks/start", "/student_dashboard/my_quizzes/start"], []);
  
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
        const response = await apiClient.get('/api/auth/me');

        if (response.status === 200) {
          setIsAuthenticated(true);
          setUserRole(response.data.role);
          const role = response.data.role;
          
          // Check if student is trying to access staff dashboard
          if (isDashboardRoute(router.pathname) && role === 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/student_dashboard");
            }, 1000);
          }

          // Check if staff/admin/developer is trying to access student dashboard
          if (isStudentDashboardRoute(router.pathname) && role !== 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/dashboard");
            }, 1000);
          }
          
          // Check if user is trying to access admin pages but is not admin or developer
          if (adminPages.includes(router.pathname) && role !== 'admin' && role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }

          // Check if user is trying to access developer pages but is not developer
          if (developerPages.includes(router.pathname) && role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } else {
          // Token invalid
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } catch (error) {
        // Token invalid or expired - only set to false if we're not on a public page
        // This prevents redirect loops when the API call fails temporarily
        if (!publicPages.includes(router.pathname)) {
          setIsAuthenticated(false);
          setUserRole(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router.pathname, adminPages, router]);

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
      
      // Save the current path for redirect after login (except dashboards)
      if (router.pathname !== "/dashboard" && router.pathname !== "/student_dashboard") {
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

  // Check admin access for current route
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Only check if user is authenticated and trying to access admin pages
      if (isAuthenticated && adminPages.includes(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          if (response.data.role !== 'admin' && response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (response.data.role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking admin access:", error);
          }
        }
      }
    };

    // Only check admin access when route changes to an admin page
    if (isAuthenticated && adminPages.includes(router.pathname)) {
      checkAdminAccess();
    }
  }, [router.pathname, isAuthenticated, adminPages, router]);

  // Check developer access for current route
  useEffect(() => {
    const checkDeveloperAccess = async () => {
      // Only check if user is authenticated and trying to access developer pages
      if (isAuthenticated && developerPages.includes(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          if (response.data.role !== 'developer') {
            setShowAccessDenied(true);
            // Redirect to appropriate dashboard based on role
            setTimeout(() => {
              setShowAccessDenied(false);
              if (response.data.role === 'student') {
                router.push("/student_dashboard");
              } else {
                router.push("/dashboard");
              }
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking developer access:", error);
          }
        }
      }
    };

    // Only check developer access when route changes to a developer page
    if (isAuthenticated && developerPages.includes(router.pathname)) {
      checkDeveloperAccess();
    }
  }, [router.pathname, isAuthenticated, developerPages, router]);

  // Check dashboard access (staff/admin/developer only)
  useEffect(() => {
    const checkDashboardAccess = async () => {
      // Only check if user is authenticated and trying to access dashboard routes
      if (isAuthenticated && isDashboardRoute(router.pathname)) {
        try {
          const response = await apiClient.get('/api/auth/me');
          
          // Only allow assistant, admin, or developer roles
          if (response.data.role === 'student') {
            setShowAccessDenied(true);
            setTimeout(() => {
              setShowAccessDenied(false);
              router.push("/student_dashboard");
            }, 1000);
          }
        } catch (error) {
          // Handle 401 (Unauthorized) errors gracefully - token expired or invalid
          if (error.response?.status === 401) {
            // Token validation failed, user needs to re-authenticate
            setIsAuthenticated(false);
            setUserRole(null);
            // The redirect to login will be handled by the useEffect that watches isAuthenticated
          } else {
            // For other errors, log them but don't break the flow
          console.error("❌ Error checking dashboard access:", error);
          }
        }
      }
    };

    // Only check dashboard access when route changes to a dashboard page
    if (isAuthenticated && isDashboardRoute(router.pathname)) {
      checkDashboardAccess();
    }
  }, [router.pathname, isAuthenticated, router]);


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
        // Handle 401 (Unauthorized) errors silently - user may not be authenticated or token expired
        if (error.response?.status === 401) {
          console.log('Subscription fetch: Unauthorized (401) - user may not be authenticated');
          setSubscription(null);
        } else {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
        }
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    // Initial fetch
    fetchSubscription();
    
    // Manual control: Refetch subscription every 30 minutes (reduced frequency)
    const interval = setInterval(fetchSubscription, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, router.pathname, publicPages]);

  // Check subscription expiration and redirect non-developers/non-students to login
  useEffect(() => {
    // Only check if authenticated, not on public pages, and subscription data is loaded
    if (!isAuthenticated || publicPages.includes(router.pathname) || isLoadingSubscription || !subscription) {
      return;
    }

    // Allow developers and students to access regardless of subscription status
    if (userRole === 'developer' || userRole === 'student') {
      return;
    }

    // Check if subscription is inactive
    if (!subscription.active) {
      console.log('⏰ Subscription is inactive, redirecting to login...');
      setShowRedirectToLogin(true);
      setTimeout(() => {
        setShowRedirectToLogin(false);
        router.push("/");
      }, 1000);
      return;
    }

    // Check if subscription has expired (remaining time is 00:00:00:00)
    if (subscription.active && subscription.date_of_expiration) {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const diff = expiration - now;

      if (diff <= 0) {
        // Subscription has expired
        console.log('⏰ Subscription has expired, redirecting to login...');
        setShowRedirectToLogin(true);
        setTimeout(() => {
          setShowRedirectToLogin(false);
          router.push("/");
        }, 1000);
        return;
      }

      // Calculate remaining time
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Check if all time components are zero
      if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        console.log('⏰ Subscription remaining time is 00:00:00:00, redirecting to login...');
        setShowRedirectToLogin(true);
        setTimeout(() => {
          setShowRedirectToLogin(false);
          router.push("/");
        }, 1000);
      }
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
            <DevToolsProtection userRole={userRole} />
            <Component {...pageProps} />
            <ReactQueryDevtools initialIsOpen={true} />
          </MantineProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    );
  }

  // Check if current page should not show header/footer
  const shouldHideHeaderFooter = noHeaderFooterPages.includes(router.pathname);
  
  // If page should not show header/footer, render without them (like login page)
  if (shouldHideHeaderFooter) {
    return (
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <MantineProvider>
            <DevToolsProtection userRole={userRole} />
            <Component {...pageProps} />
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
          <DevToolsProtection userRole={userRole} />
          <div className="page-container" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '100vh' 
          }}>
            <Header />
            
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
            <Footer />
          </div>
          <ReactQueryDevtools initialIsOpen={false} />
        </MantineProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
