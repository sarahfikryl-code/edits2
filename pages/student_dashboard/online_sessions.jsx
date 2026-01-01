import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../components/Title';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { useProfile } from '../../lib/api/auth';
import NeedHelp from '../../components/NeedHelp';

// Build embed URL
function buildEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&modestbranding=1&disablekb=1&fs=1`;
}

export default function OnlineSessions() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [videoPopupOpen, setVideoPopupOpen] = useState(false);
  const [vvcPopupOpen, setVvcPopupOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [vvc, setVvc] = useState(['', '', '', '', '', '', '', '', '']);
  const [vvcError, setVvcError] = useState('');
  const [isCheckingVvc, setIsCheckingVvc] = useState(false);
  const videoContainerRef = useRef(null);
  const [unlockedSessions, setUnlockedSessions] = useState(new Map()); // Map of session_id -> { vvc_id, vvc_views }
  const videoStartTimeRef = useRef(null); // Track when video was opened
  const isClosingVideoRef = useRef(false); // Prevent multiple close calls

  // Fetch online sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['online_sessions-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_sessions/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const sessions = sessionsData?.sessions || [];

  // Fetch student's online_sessions
  const { data: studentSessionsData } = useQuery({
    queryKey: ['student-online-sessions', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const response = await apiClient.get(`/api/students/${profile.id}/online-sessions`);
      return response.data;
    },
    enabled: !!profile?.id,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  // Update unlockedSessions map when student sessions data changes
  useEffect(() => {
    if (studentSessionsData?.online_sessions) {
      const unlockedMap = new Map();
      studentSessionsData.online_sessions.forEach(session => {
        if (session.vvc_views > 0) {
          unlockedMap.set(session.video_id, {
            vvc_id: session.vvc_id,
            vvc_views: session.vvc_views
          });
        }
      });
      setUnlockedSessions(unlockedMap);
    }
  }, [studentSessionsData]);

  // Toggle session expansion (only one can be open at a time)
  const toggleSession = (index) => {
    if (expandedSessions.has(index)) {
      // If clicking on an already expanded session, close it
      setExpandedSessions(new Set());
    } else {
      // If opening a new session, close all others and open only this one
      setExpandedSessions(new Set([index]));
    }
  };

  // Handle VVC input change
  const handleVVCChange = (index, value) => {
    // Only allow alphanumeric characters, single character
    const sanitized = value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 1);
    const newVvc = [...vvc];
    newVvc[index] = sanitized;
    setVvc(newVvc);
    setVvcError('');
  };

  // Handle VVC paste
  const handleVVCPaste = (e, index) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = pastedText.replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);
    
    if (sanitized.length === 9) {
      // Fill all 9 inputs with the pasted code
      const newVvc = sanitized.split('').slice(0, 9);
      setVvc(newVvc);
      setVvcError('');
      
      // Focus on the last input after pasting
      setTimeout(() => {
        const lastInput = document.querySelector(`input[name="vvc-8"]`);
        if (lastInput) lastInput.focus();
      }, 0);
    } else if (sanitized.length > 0) {
      // If pasted text is less than 9 characters, fill from current index
      const newVvc = [...vvc];
      for (let i = 0; i < sanitized.length && (index + i) < 9; i++) {
        newVvc[index + i] = sanitized[i];
      }
      setVvc(newVvc);
      setVvcError('');
      
      // Focus on the next empty input or last input
      const nextIndex = Math.min(index + sanitized.length, 8);
      setTimeout(() => {
        const nextInput = document.querySelector(`input[name="vvc-${nextIndex}"]`);
        if (nextInput) nextInput.focus();
      }, 0);
    }
  };

  // Handle VVC key down
  const handleVVCKeyDown = (e, index) => {
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !vvc[index] && index > 0) {
      const prevInput = document.querySelector(`input[name="vvc-${index - 1}"]`);
      if (prevInput) prevInput.focus();
    }
    // Handle arrow keys
    else if (e.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.querySelector(`input[name="vvc-${index - 1}"]`);
      if (prevInput) prevInput.focus();
    } else if (e.key === 'ArrowRight' && index < 8) {
      const nextInput = document.querySelector(`input[name="vvc-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
    // Auto-advance to next input on character entry
    else if (e.key !== 'Backspace' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && vvc[index] && index < 8) {
      const nextInput = document.querySelector(`input[name="vvc-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  };

  // Open VVC popup for a session
  const openVvcPopup = (session) => {
    setSelectedSession(session);
    setVvc(['', '', '', '', '', '', '', '', '']);
    setVvcError('');
    setVvcPopupOpen(true);
  };

  // Close VVC popup
  const closeVvcPopup = () => {
    setVvcPopupOpen(false);
    setSelectedSession(null);
    setVvc(['', '', '', '', '', '', '', '', '']);
    setVvcError('');
  };

  // Handle VVC submit
  const handleVVCSubmit = async (e) => {
    e.preventDefault();
    
    const vvcCode = vvc.join('');
    if (vvcCode.length !== 9) {
      setVvcError('❌ Please enter the complete verification code');
      return;
    }

    setIsCheckingVvc(true);
    setVvcError('');

    try {
      const response = await apiClient.post('/api/vvc/check', { 
        VVC: vvcCode,
        session_id: selectedSession?._id 
      });
      
      if (response.data.success && response.data.valid) {
        // VVC is valid - close popup and open video
        closeVvcPopup();
        // Refresh student sessions to update unlocked status
        if (profile?.id) {
          // Refetch student sessions
          const refreshResponse = await apiClient.get(`/api/students/${profile.id}/online-sessions`);
          if (refreshResponse.data?.online_sessions) {
            const unlockedMap = new Map();
            refreshResponse.data.online_sessions.forEach(session => {
              if (session.vvc_views > 0) {
                unlockedMap.set(session.video_id, {
                  vvc_id: session.vvc_id,
                  vvc_views: session.vvc_views
                });
              }
            });
            setUnlockedSessions(unlockedMap);
          }
        }
        // Open first video in the session
        if (selectedSession) {
          let videoId = selectedSession.video_ID;
          if (!videoId) {
            let index = 1;
            while (selectedSession[`video_ID_${index}`]) {
              videoId = selectedSession[`video_ID_${index}`];
              break;
            }
          }
          if (videoId) {
            setSelectedVideo({ ...selectedSession, video_ID: videoId });
            setVideoPopupOpen(true);
            // Record when video was opened
            videoStartTimeRef.current = Date.now();
          }
        }
      } else {
        setVvcError(response.data.error || '❌ Sorry, this code is incorrect');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || '❌ Sorry, this code is incorrect';
      setVvcError(errorMsg);
    } finally {
      setIsCheckingVvc(false);
    }
  };

  // Open video popup (after VVC validation or if already unlocked)
  const openVideoPopup = async (session, videoId) => {
    // Check payment_state first - if free, unlock without VVC
    if (session.payment_state === 'free') {
      // Free video - open directly without VVC
      setSelectedVideo({ ...session, video_ID: videoId });
      setVideoPopupOpen(true);
      videoStartTimeRef.current = Date.now();
      return;
    }
    
    // For paid videos, check if video is unlocked (has entry in online_sessions with vvc_views > 0)
    const sessionId = session._id.toString();
    const unlocked = unlockedSessions.get(sessionId);
    
    if (!unlocked || unlocked.vvc_views <= 0) {
      // Video is locked - open VVC popup
      openVvcPopup(session);
      return;
    }

    // Video is unlocked - open video directly (no VVC popup needed)
    setSelectedVideo({ ...session, video_ID: videoId });
    setVideoPopupOpen(true);
    // Record when video was opened
    videoStartTimeRef.current = Date.now();
  };

  // Close video popup and mark attendance
  const closeVideoPopup = async () => {
    // Prevent multiple calls
    if (isClosingVideoRef.current) {
      return;
    }
    
    // Only decrement views and mark attendance if video was actually watched
    // (at least 5 seconds to prevent accidental closes)
    const minWatchTime = 5000; // 5 seconds in milliseconds
    const watchTime = videoStartTimeRef.current ? Date.now() - videoStartTimeRef.current : 0;
    
    // Close popup immediately (UI feedback)
    const currentVideo = selectedVideo;
    setVideoPopupOpen(false);
    setSelectedVideo(null);
    videoStartTimeRef.current = null;
    
    // Call watch-video API for both free and paid videos (mark attendance and create history)
    if (currentVideo && profile?.id && currentVideo._id && watchTime >= minWatchTime) {
      isClosingVideoRef.current = true;
      try {
        // Convert _id to string if it's an ObjectId
        const sessionId = typeof currentVideo._id === 'string' 
          ? currentVideo._id 
          : currentVideo._id.toString();
        
        await apiClient.post(`/api/students/${profile.id}/watch-video`, {
          session_id: sessionId,
          action: 'finish',
          payment_state: currentVideo.payment_state // Pass payment state to API
        });
        
        // Refresh unlocked sessions to update VVC views (only for paid videos)
        if (currentVideo.payment_state === 'paid' && profile?.id) {
          const refreshResponse = await apiClient.get(`/api/students/${profile.id}/online-sessions`);
          if (refreshResponse.data?.online_sessions) {
            const unlockedMap = new Map();
            refreshResponse.data.online_sessions.forEach(session => {
              if (session.vvc_views > 0) {
                unlockedMap.set(session.video_id, {
                  vvc_id: session.vvc_id,
                  vvc_views: session.vvc_views
                });
              }
            });
            setUnlockedSessions(unlockedMap);
          }
        }
      } catch (err) {
        console.error('Failed to mark video as finished:', err);
      } finally {
        isClosingVideoRef.current = false;
      }
    }
  };

  // Auto-hide error after 6 seconds
  useEffect(() => {
    if (vvcError) {
      const timer = setTimeout(() => setVvcError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [vvcError]);

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/play-pause.svg" alt="Play Pause" width={32} height={32} />
            Online Sessions
          </div>
        </Title>

        {/* White Background Container */}
        <div className="sessions-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>

          {/* Sessions List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>No sessions available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sessions.map((session, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); toggleSession(index); }}>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                        {[session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                      </div>
                      {session.description && (
                        <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                          {session.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>
                        {session.date}
                      </div>
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSession(index); }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        color: '#1FA8DC',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                      {expandedSessions.has(index) ? (
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 640 640"
                          style={{ 
                            width: '20px', 
                            height: '20px',
                            transform: 'rotate(90deg)'
                          }}
                          fill="currentColor"
                        >
                          <path d="M439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C266.6 515.2 246.3 515.2 233.8 502.7C221.3 490.2 221.3 469.9 233.8 457.4L371.2 320L233.9 182.6C221.4 170.1 221.4 149.8 233.9 137.3C246.4 124.8 266.7 124.8 279.2 137.3L439.2 297.3z"/>
                        </svg>
                      ) : (
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 640 640"
                          style={{ 
                            width: '20px', 
                            height: '20px'
                          }}
                          fill="currentColor"
                        >
                          <path d="M439.1 297.4C451.6 309.9 451.6 330.2 439.1 342.7L279.1 502.7C266.6 515.2 246.3 515.2 233.8 502.7C221.3 490.2 221.3 469.9 233.8 457.4L371.2 320L233.9 182.6C221.4 170.1 221.4 149.8 233.9 137.3C246.4 124.8 266.7 124.8 279.2 137.3L439.2 297.3z"/>
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedSessions.has(index) && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                      {/* Get all video IDs from session */}
                      {(() => {
                        const videoIds = [];
                        let videoIndex = 1;
                        while (session[`video_ID_${videoIndex}`]) {
                          videoIds.push({
                            id: session[`video_ID_${videoIndex}`],
                            index: videoIndex
                          });
                          videoIndex++;
                        }
                        const sessionId = session._id.toString();
                        const unlocked = unlockedSessions.get(sessionId);
                        // Free videos are always unlocked; paid videos need VVC
                        const isFreeVideo = session.payment_state === 'free';
                        const isUnlocked = isFreeVideo || (unlocked && unlocked.vvc_views > 0);
                        
                        return videoIds.map((video, vidIndex) => (
                          <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                              <div
                                onClick={() => openVideoPopup(session, video.id)}
                                style={{
                                  flex: 1,
                                  padding: '10px 15px',
                                  backgroundColor: isUnlocked ? '#28a745' : '#6c757d',
                                  color: 'white',
                                  borderRadius: '6px',
                                  textAlign: 'center',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '8px'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = isUnlocked ? '#218838' : '#5a6268';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = isUnlocked ? '#28a745' : '#6c757d';
                                }}
                              >
                                <Image 
                                  src={isUnlocked ? "/unlock.svg" : "/lock.svg"} 
                                  alt={isUnlocked ? "Unlocked" : "Locked"} 
                                  width={20} 
                                  height={20} 
                                />
                                Video {video.index}
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>

        {/* VVC Input Popup */}
        {vvcPopupOpen && selectedSession && (
          <div
            className="vvc-popup-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVvcPopup();
              }
            }}
          >
            <div
              className="vvc-popup"
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
                Enter Verification Code
              </h2>

              <form onSubmit={handleVVCSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                    Video Verification Code (VVC) <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                    {vvc.map((char, index) => (
                      <input
                        key={index}
                        name={`vvc-${index}`}
                        type="text"
                        maxLength="1"
                        value={char}
                        onChange={(e) => handleVVCChange(index, e.target.value)}
                        onKeyDown={(e) => handleVVCKeyDown(e, index)}
                        onPaste={(e) => handleVVCPaste(e, index)}
                        style={{
                          width: '40px',
                          height: '50px',
                          textAlign: 'center',
                          fontSize: '1.5rem',
                          fontWeight: '600',
                          border: vvcError ? '2px solid #dc3545' : '2px solid #ddd',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}
                        required
                      />
                    ))}
                  </div>
                  {vvcError && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', textAlign: 'center', marginTop: '8px' }}>
                      {vvcError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    type="submit"
                    disabled={isCheckingVvc}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: isCheckingVvc ? 'not-allowed' : 'pointer',
                      opacity: isCheckingVvc ? 0.6 : 1
                    }}
                  >
                    {isCheckingVvc ? 'Checking...' : 'Submit'}
                  </button>
                  <button
                    type="button"
                    onClick={closeVvcPopup}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Video Player Popup */}
        {videoPopupOpen && selectedVideo && (
          <div
            className="video-popup-overlay"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVideoPopup();
              }
            }}
          >
            <div
              ref={videoContainerRef}
              className="video-player-container"
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '900px',
                backgroundColor: '#000',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeVideoPopup}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 10,
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  lineHeight: '1',
                  fontWeight: 'bold'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#c82333';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#dc3545';
                }}
              >
                ✕
              </button>

              {/* Video Title */}
              <div style={{
                padding: '16px',
                backgroundColor: '#1a1a1a',
                color: 'white',
                borderBottom: '1px solid #333'
              }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedVideo.name}</h3>
              </div>

              {/* Video Iframe */}
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
                <iframe
                  src={buildEmbedUrl(selectedVideo.video_ID || selectedVideo.video_ID_1 || '')}
                  frameBorder="0"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen={true}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%'
                  }}
                />

                {/* Top UI Mask Overlay */}
                <div
                  className="youtube-ui-mask"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '80px',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.6) 70%, transparent 100%)',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                />
              </div>

              {/* Video Description */}
              {selectedVideo.description && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#1a1a1a',
                  color: '#ccc',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}>
                  {selectedVideo.description}
                </div>
              )}
            </div>
          </div>
        )}

        <style jsx>{`
          .sessions-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow-x: auto;
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
            }
            
            .sessions-container {
              padding: 16px;
            }
            
            .vvc-popup-overlay {
              padding: 15px !important;
            }
            
            .vvc-popup {
              padding: 20px !important;
              max-width: 100% !important;
              margin: 10px;
            }
            
            .vvc-popup input {
              width: 35px !important;
              height: 45px !important;
              font-size: 1.3rem !important;
            }
            
            .video-popup-overlay {
              padding: 10px !important;
            }
            
            .video-player-container {
              max-width: 100% !important;
              border-radius: 8px !important;
            }
            
            .video-player-container h3 {
              font-size: 1rem !important;
              padding: 12px !important;
            }
            
            .video-player-container button {
              width: 32px !important;
              height: 32px !important;
              font-size: 18px !important;
              top: 8px !important;
              right: 8px !important;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 5px !important;
            }
            
            .page-content {
              margin: 10px auto !important;
            }
            
            .sessions-container {
              padding: 12px;
              border-radius: 12px !important;
            }
            
            .vvc-popup-overlay {
              padding: 10px !important;
            }
            
            .vvc-popup {
              padding: 16px !important;
              margin: 5px;
              border-radius: 8px !important;
            }
            
            .vvc-popup h2 {
              font-size: 1.2rem !important;
              margin-bottom: 16px !important;
            }
            
            .vvc-popup input {
              width: 30px !important;
              height: 40px !important;
              font-size: 1.1rem !important;
            }
            
            .vvc-popup button {
              padding: 8px 16px !important;
              font-size: 0.9rem !important;
            }
            
            .video-popup-overlay {
              padding: 5px !important;
            }
            
            .video-player-container {
              border-radius: 0 !important;
            }
            
            .video-player-container h3 {
              font-size: 0.9rem !important;
              padding: 10px !important;
            }
            
            .video-player-container button {
              width: 28px !important;
              height: 28px !important;
              font-size: 16px !important;
              top: 5px !important;
              right: 5px !important;
            }
          }
          
          @media (max-width: 360px) {
            .vvc-popup input {
              width: 28px !important;
              height: 38px !important;
              font-size: 1rem !important;
            }
            
            .vvc-popup h2 {
              font-size: 1rem !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

