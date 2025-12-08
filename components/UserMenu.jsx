import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useProfile } from '../lib/api/auth';
import { useSubscription } from '../lib/api/subscription';
import apiClient from '../lib/axios';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();
  
  // Use React Query to get user profile data
  const { data: user, isLoading, error } = useProfile();
  const { data: subscription } = useSubscription();

  // Fallback user object if data is not available yet
  const userData = user || { name: '', id: '', phone: '', role: '' };

  // Subscription countdown timer
  const [timeRemaining, setTimeRemaining] = useState(null);
  const hasLoggedOutRef = useRef(false); // Track if we've already called logout

  useEffect(() => {
    const isDeveloper = userData.role === 'developer';

    // Simple logic: if active = false AND date_of_expiration = null, show expired
    // Otherwise, if date_of_expiration exists, calculate timer
    if (!subscription || (subscription.active === false && !subscription.date_of_expiration)) {
      setTimeRemaining(null);
      hasLoggedOutRef.current = false;
      return;
    }

    // If date_of_expiration exists, calculate timer
    if (!subscription.date_of_expiration) {
      setTimeRemaining(null);
      hasLoggedOutRef.current = false;
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const diff = expiration - now;

      // Calculate time components (use Math.max to ensure non-negative)
      const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      const minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
      const seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

      // Update timer with calculated values (always set, even if zero)
      setTimeRemaining({ days, hours, minutes, seconds });

      // Check if all time components are zero (00:00:00:00) or diff <= 0
      // Only auto-logout for non-developers
      if (!isDeveloper && (diff <= 0 || (days === 0 && hours === 0 && minutes === 0 && seconds === 0))) {
        // If timer reaches 00:00:00:00, delete token and redirect to login
        if (!hasLoggedOutRef.current) {
          hasLoggedOutRef.current = true;
          (async () => {
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
            router.push('/');
          })();
        }
      }
    };

    // Calculate timer immediately
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(interval);
      hasLoggedOutRef.current = false; // Reset logout flag when effect cleans up
    };
  }, [subscription, userData.role, router]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      router.push('/');
    }
  };

  const handleManageAssistants = () => {
    router.push('/manage_assistants');
  };

  const handleEditProfile = () => {
    router.push('/manage_assistants/edit_my_profile');
  };

  const handleContactDeveloper = () => {
    router.push('/contact_developer');
  };

  const handleSubscriptionDashboard = () => {
    router.push('/subscription_dashboard');
  };

  return (
    <div style={{ position: 'relative', marginRight: 32 }} ref={menuRef}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: '#e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? '0 2px 8px rgba(31,168,220,0.15)' : 'none',
          border: open ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          transition: 'box-shadow 0.2s, border 0.2s'
        }}
        onClick={() => setOpen((v) => !v)}
        title={userData.name || userData.id}
      >
        {/* Use user image if available, else fallback to initial */}
        <span style={{ 
          fontWeight: 700, 
          fontSize: 22, 
          color: '#1FA8DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          lineHeight: 1,
          textAlign: 'center'
        }}>
          {userData.name ? userData.name[0].toUpperCase() : (userData.id ? userData.id[0].toUpperCase() : 'U')}
        </span>
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: 54,
          right: 0,
          minWidth: 270,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(31,168,220,0.18)',
          border: '1.5px solid #e9ecef',
          zIndex: 100,
          padding: '0 0 8px 0',
        }}>
          <div style={{
            padding: '18px 20px 12px 20px',
            borderBottom: '1px solid #e9ecef',
            textAlign: 'left',
            marginBottom: 8
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1FA8DC', marginBottom: 2 }}>{userData.name || userData.id}</div>
            <div style={{ color: '#495057', fontSize: 15, fontWeight: 600 }}>
              {userData.id ? `Username: ${userData.id}` : 'No Username'}
            </div>
          </div>
          {subscription && (
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #e9ecef',
              marginBottom: 8
            }}>
              {/* Show "Subscription Expired" only if active = false AND date_of_expiration = null */}
              {subscription.active === false && !subscription.date_of_expiration ? (
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#dc3545',
                  lineHeight: 1.4
                }}>
                  Subscription Expired
                </div>
              ) : subscription.date_of_expiration && timeRemaining !== null ? (
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#495057',
                  lineHeight: 1.4
                }}>
                  <div style={{ marginBottom: 4, color: '#313437', fontSize: 15 }}>Subscription time remaining:</div>
                  <div style={{ 
                    fontFamily: 'Courier New, monospace',
                    letterSpacing: 0.5,
                    fontSize: 15
                  }}>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.days || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> days : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.hours || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> hours : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.minutes || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> min : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.seconds || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> sec</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <button style={menuBtnStyle} onClick={handleLogout}>Logout</button>
          {(userData.role === 'admin' || userData.role === 'developer') && (
            <button style={menuBtnStyle} onClick={handleManageAssistants}>Manage Assistants</button>
          )}
          {userData.role === 'developer' && (
            <button style={menuBtnStyle} onClick={handleSubscriptionDashboard}>Subscription Dashboard</button>
          )}
          <button style={menuBtnStyle} onClick={handleEditProfile}>Edit My Profile</button>
          <button style={menuBtnStyle} onClick={handleContactDeveloper}>Contact Developer</button>
        </div>
      )}
    </div>
  );
}

const menuBtnStyle = {
  width: '100%',
  background: 'none',
  border: 'none',
  color: '#1FA8DC',
  fontWeight: 700,
  fontSize: 16,
  padding: '10px 20px',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 8,
  transition: 'background 0.15s',
  marginBottom: 2,
  outline: 'none',
};
