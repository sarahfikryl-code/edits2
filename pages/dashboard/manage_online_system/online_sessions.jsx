import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import AttendanceWeekSelect from '../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../components/GradeSelect';
import OnlineSessionPaymentStateSelect from '../../../components/OnlineSessionPaymentStateSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// Extract week number from week string (e.g., "week 01" -> 1)
function extractWeekNumber(weekString) {
  if (!weekString) return null;
  const match = weekString.match(/week\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Convert week number to week string (e.g., 1 -> "week 01")
function weekNumberToString(weekNumber) {
  if (weekNumber === null || weekNumber === undefined) return '';
  return `week ${String(weekNumber).padStart(2, '0')}`;
}

// Build embed URL
function buildEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&modestbranding=1&disablekb=1&fs=1`;
}

function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by lesson name..."
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled" onClick={props.onButtonClick}>
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}

export default function OnlineSessions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [popupOpen, setPopupOpen] = useState(false);
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [videoPopupOpen, setVideoPopupOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'session' | 'video', id: string, videoId?: string }
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [formData, setFormData] = useState({
    name: '',
    video_urls: [''],
    description: ''
  });
  const [selectedGrade, setSelectedGrade] = useState('');
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [paymentState, setPaymentState] = useState('paid'); // Default to 'paid'
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const videoContainerRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const sessionItemRefs = useRef({});
  
  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterPaymentState, setFilterPaymentState] = useState('');
  const [filterGradeDropdownOpen, setFilterGradeDropdownOpen] = useState(false);
  const [filterWeekDropdownOpen, setFilterWeekDropdownOpen] = useState(false);
  const [filterPaymentStateDropdownOpen, setFilterPaymentStateDropdownOpen] = useState(false);

  // Fetch online sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['online_sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_sessions');
      return response.data;
    },
    refetchInterval: false, // No auto-refresh - only manual refresh
    refetchOnWindowFocus: true, // refetch on window focus
    refetchOnMount: true, // refetch on mount if data exists
    refetchOnReconnect: true, // refetch on reconnect
  });

  const sessions = sessionsData?.sessions || [];

  // Filter sessions based on search and filters
  const filteredSessions = sessions.filter(session => {
    // Search filter (contains, case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = session.name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Grade filter
    if (filterGrade) {
      if (session.grade !== filterGrade) {
        return false;
      }
    }

    // Week filter
    if (filterWeek) {
      const weekNumber = extractWeekNumber(filterWeek);
      if (session.week !== weekNumber) {
        return false;
      }
    }

    // Payment state filter
    if (filterPaymentState) {
      if (session.payment_state !== filterPaymentState) {
        return false;
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      // If input is cleared but search term still has value, automatically clear search
      setSearchTerm("");
    }
  }, [searchInput, searchTerm]);

  // Handle search
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/online_sessions', data);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Session added successfully!');
      setFormData({ name: '', video_urls: [''], description: '' });
      setSelectedGrade('');
      setSelectedWeek('');
      setPaymentState('paid');
      setErrors({});
      setPopupOpen(false);
      queryClient.invalidateQueries(['online_sessions']);
      
      // Auto-hide success message after 6 seconds
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to add session';
      const error = errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`;
      setErrors({ general: error });
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
    },
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/api/online_sessions?id=${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Session updated successfully!');
      setFormData({ name: '', video_urls: [''], description: '' });
      setSelectedGrade('');
      setSelectedWeek('');
      setPaymentState('paid');
      setErrors({});
      setEditPopupOpen(false);
      setSelectedSession(null);
      queryClient.invalidateQueries(['online_sessions']);
      
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to update session';
      const error = errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`;
      setErrors({ general: error });
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/online_sessions?id=${id}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Session deleted successfully!');
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries(['online_sessions']);
      
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete session';
      const error = errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`;
      setErrors({ general: error });
      setConfirmDeleteOpen(false);
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
    },
  });

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

  // Handle click outside to collapse expanded sessions (mobile only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle on mobile (check if mobile layout is active)
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) return;

      // Check if click is outside any session item
      let clickedInsideAnySession = false;
      Object.values(sessionItemRefs.current).forEach((ref) => {
        if (ref && ref.contains(event.target)) {
          clickedInsideAnySession = true;
        }
      });

      // If clicked outside all session items and any session is expanded, collapse all
      if (!clickedInsideAnySession && expandedSessions.size > 0) {
        setExpandedSessions(new Set());
      }
    };

    // Only add listener if on mobile and there are expanded sessions
    if (window.innerWidth <= 768 && expandedSessions.size > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [expandedSessions]);

  // Open video popup
  const openVideoPopup = (session) => {
    // If session has video_ID, use it; otherwise extract from video_ID_1, video_ID_2, etc.
    let videoId = session.video_ID;
    if (!videoId) {
      let index = 1;
      while (session[`video_ID_${index}`]) {
        videoId = session[`video_ID_${index}`];
        break; // Use first video if no specific video_ID provided
      }
    }
    setSelectedVideo({ ...session, video_ID: videoId });
    setVideoPopupOpen(true);
  };

  // Close video popup
  const closeVideoPopup = () => {
    setVideoPopupOpen(false);
    setSelectedVideo(null);
  };

  // Add video URL input
  const addVideoUrl = () => {
    setFormData({
      ...formData,
      video_urls: [...formData.video_urls, '']
    });
  };

  // Remove video URL input
  const removeVideoUrl = (index) => {
    if (formData.video_urls.length > 1) {
      const newUrls = formData.video_urls.filter((_, i) => i !== index);
      setFormData({ ...formData, video_urls: newUrls });
      // Clear error for removed field
      if (errors[`video_url_${index}`]) {
        const newErrors = { ...errors };
        delete newErrors[`video_url_${index}`];
        setErrors(newErrors);
      }
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    if (errors.general) {
      setErrors({ ...errors, general: '' });
    }
  };

  // Handle video URL change
  const handleVideoUrlChange = (index, value) => {
    const newUrls = [...formData.video_urls];
    newUrls[index] = value;
    setFormData({ ...formData, video_urls: newUrls });
    // Clear error for this field
    if (errors[`video_url_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`video_url_${index}`];
      setErrors(newErrors);
    }
    if (errors.general) {
      setErrors({ ...errors, general: '' });
    }
  };

  // Open edit popup
  const openEditPopup = (session) => {
    // Extract video URLs from session
    const videoUrls = [];
    let videoIndex = 1;
    while (session[`video_ID_${videoIndex}`]) {
      videoUrls.push(`https://www.youtube.com/watch?v=${session[`video_ID_${videoIndex}`]}`);
      videoIndex++;
    }
    
    setFormData({
      name: session.name || '',
      video_urls: videoUrls.length > 0 ? videoUrls : [''],
      description: session.description || ''
    });
    // Convert week number to week string for the select component
    setSelectedWeek(session.week ? weekNumberToString(session.week) : '');
    setSelectedGrade(session.grade || '');
    setPaymentState(session.payment_state || 'paid');
    setSelectedSession(session);
    setEditPopupOpen(true);
    setErrors({});
  };

  // Handle form submit (create)
  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate grade
    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    // Validate week
    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Attendance week is required';
    }

    // Validate payment state
    if (!paymentState || (paymentState !== 'paid' && paymentState !== 'free')) {
      newErrors.paymentState = '❌ Video Payment State is required';
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = '❌ Name is required';
    }

    // Validate video URLs
    const validUrls = formData.video_urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      newErrors.video_url_0 = '❌ At least one video URL is required';
    } else {
      // Validate each YouTube URL
      validUrls.forEach((url, index) => {
        const videoId = extractYouTubeId(url.trim());
        if (!videoId) {
          newErrors[`video_url_${formData.video_urls.indexOf(url)}`] = '❌ Invalid YouTube URL';
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Extract week number from week string
    const weekNumber = extractWeekNumber(selectedWeek);
    if (!weekNumber) {
      newErrors.week = '❌ Invalid week selection';
      setErrors(newErrors);
      return;
    }

    // Check for duplicate grade and week combination
    const duplicateSession = sessions.find(
      session => session.grade === selectedGrade.trim() && session.week === weekNumber
    );
    if (duplicateSession) {
      newErrors.general = '❌ A session with this grade and week already exists';
      setErrors(newErrors);
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
      return;
    }

    // Submit form
    createSessionMutation.mutate({
      name: formData.name.trim(),
      grade: selectedGrade.trim(),
      week: weekNumber,
      video_urls: validUrls,
      description: formData.description.trim() || null,
      payment_state: paymentState
    });
  };

  // Handle form submit (update)
  const handleUpdateSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate grade
    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    // Validate week
    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Attendance week is required';
    }

    // Validate payment state
    if (!paymentState || (paymentState !== 'paid' && paymentState !== 'free')) {
      newErrors.paymentState = '❌ Video Payment State is required';
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = '❌ Name is required';
    }

    // Validate video URLs
    const validUrls = formData.video_urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      newErrors.video_url_0 = '❌ At least one video URL is required';
    } else {
      // Validate each YouTube URL
      validUrls.forEach((url, index) => {
        const videoId = extractYouTubeId(url.trim());
        if (!videoId) {
          newErrors[`video_url_${formData.video_urls.indexOf(url)}`] = '❌ Invalid YouTube URL';
        }
      });
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Extract week number from week string
    const weekNumber = extractWeekNumber(selectedWeek);
    if (!weekNumber) {
      newErrors.week = '❌ Invalid week selection';
      setErrors(newErrors);
      return;
    }

    // Check for duplicate grade and week combination (exclude current session)
    const duplicateSession = sessions.find(
      session => 
        session._id !== selectedSession._id && 
        session.grade === selectedGrade.trim() && 
        session.week === weekNumber
    );
    if (duplicateSession) {
      newErrors.general = '❌ A session with this grade and week already exists';
      setErrors(newErrors);
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
      return;
    }

    // Submit update
    updateSessionMutation.mutate({
      id: selectedSession._id,
      data: {
        name: formData.name.trim(),
        grade: selectedGrade.trim(),
        week: weekNumber,
        video_urls: validUrls,
        description: formData.description.trim() || null,
        payment_state: paymentState
      }
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deleteTarget && deleteTarget.type === 'session') {
      deleteSessionMutation.mutate(deleteTarget.id);
    }
  };

  // Open delete confirmation
  const openDeleteConfirm = (session) => {
    setDeleteTarget({ type: 'session', id: session._id });
    setConfirmDeleteOpen(true);
  };


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/play-pause.svg" alt="Play Pause" width={32} height={32} />
            Online Sessions
          </div>
        </Title>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
        <div className="filters-container" style={{
          background: 'white',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          marginBottom: 24,
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div className="filter-row" style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap'
          }}>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Grade
              </label>
              <GradeSelect
                selectedGrade={filterGrade}
                onGradeChange={(grade) => {
                  setFilterGrade(grade);
                }}
                isOpen={filterGradeDropdownOpen}
                onToggle={() => {
                  setFilterGradeDropdownOpen(!filterGradeDropdownOpen);
                  setFilterWeekDropdownOpen(false);
                  setFilterPaymentStateDropdownOpen(false);
                }}
                onClose={() => setFilterGradeDropdownOpen(false)}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Week
              </label>
              <AttendanceWeekSelect
                selectedWeek={filterWeek}
                onWeekChange={(week) => {
                  setFilterWeek(week);
                }}
                isOpen={filterWeekDropdownOpen}
                onToggle={() => {
                  setFilterWeekDropdownOpen(!filterWeekDropdownOpen);
                  setFilterGradeDropdownOpen(false);
                  setFilterPaymentStateDropdownOpen(false);
                }}
                onClose={() => setFilterWeekDropdownOpen(false)}
                placeholder="Select Week"
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Payment State
              </label>
              <OnlineSessionPaymentStateSelect
                value={filterPaymentState || null}
                onChange={(state) => {
                  setFilterPaymentState(state || '');
                }}
                placeholder="Select Payment State"
                style={{ marginBottom: 0, hideLabel: true }}
                isOpen={filterPaymentStateDropdownOpen}
                onToggle={() => {
                  setFilterPaymentStateDropdownOpen(!filterPaymentStateDropdownOpen);
                  setFilterGradeDropdownOpen(false);
                  setFilterWeekDropdownOpen(false);
                }}
                onClose={() => setFilterPaymentStateDropdownOpen(false)}
              />
            </div>
          </div>
        </div>

        {/* White Background Container */}
        <div className="sessions-container">

      {/* Add Video Popup */}
      {popupOpen && (
        <div
          className="add-video-popup-overlay"
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
                  setPopupOpen(false);
                  setFormData({ name: '', video_urls: [''], description: '' });
                  setSelectedGrade('');
                  setSelectedWeek('');
                  setPaymentState('paid');
                  setErrors({});
                }
              }}
        >
          <div
            className="add-video-popup"
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>
              {popupOpen ? 'Add Video Session' : 'Edit Video Session'}
            </h2>

            <form onSubmit={popupOpen ? handleSubmit : handleUpdateSubmit}>
              {/* Video Grade */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Video Grade <span style={{ color: 'red' }}>*</span>
                </label>
                <GradeSelect
                  selectedGrade={selectedGrade}
                  onGradeChange={(grade) => {
                    setSelectedGrade(grade);
                    if (errors.grade) {
                      setErrors({ ...errors, grade: '' });
                    }
                  }}
                  isOpen={gradeDropdownOpen}
                  onToggle={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                  onClose={() => setGradeDropdownOpen(false)}
                  required={true}
                />
                {errors.grade && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.grade}
                  </div>
                )}
              </div>

              {/* Video Week */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Video Week <span style={{ color: 'red' }}>*</span>
                </label>
                <AttendanceWeekSelect
                  selectedWeek={selectedWeek}
                  onWeekChange={(week) => {
                    setSelectedWeek(week);
                    if (errors.week) {
                      setErrors({ ...errors, week: '' });
                    }
                  }}
                  isOpen={weekDropdownOpen}
                  onToggle={() => setWeekDropdownOpen(!weekDropdownOpen)}
                  onClose={() => setWeekDropdownOpen(false)}
                  required={true}
                  placeholder="Select Video Week"
                />
                {errors.week && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.week}
                  </div>
                )}
              </div>

              {/* Video Payment State Radio */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                  Video Payment State <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'paid' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'paid' ? '#f0f8ff' : 'white' }}>
                    <input
                      type="radio"
                      name="payment_state"
                      value="paid"
                      checked={paymentState === 'paid'}
                      onChange={(e) => {
                        setPaymentState(e.target.value);
                        if (errors.paymentState) {
                          setErrors({ ...errors, paymentState: '' });
                        }
                      }}
                      style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Paid</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'free' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'free' ? '#f0f8ff' : 'white' }}>
                    <input
                      type="radio"
                      name="payment_state"
                      value="free"
                      checked={paymentState === 'free'}
                      onChange={(e) => {
                        setPaymentState(e.target.value);
                        if (errors.paymentState) {
                          setErrors({ ...errors, paymentState: '' });
                        }
                      }}
                      style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Free</span>
                  </label>
                </div>
                {errors.paymentState && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.paymentState}
                  </div>
                )}
              </div>

              {/* Name Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter Session Name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: errors.name ? '2px solid #dc3545' : '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.name && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Youtube Links Inputs */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Youtube link <span style={{ color: 'red' }}>*</span>
                </label>
                {formData.video_urls.map((url, index) => (
                  <div key={index} style={{ marginBottom: index < formData.video_urls.length - 1 ? '12px' : '0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                        placeholder="Enter The Youtube Video URL."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: errors[`video_url_${index}`] ? '2px solid #dc3545' : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      {errors[`video_url_${index}`] && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors[`video_url_${index}`]}
                        </div>
                      )}
                    </div>
                    {index === formData.video_urls.length - 1 && (
                      <button
                        type="button"
                        onClick={addVideoUrl}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          height: '40px'
                        }}
                        title="Add another video"
                      >
                        +
                      </button>
                    )}
                    {formData.video_urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideoUrl(index)}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          height: '40px'
                        }}
                        title="Remove this video"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Description Textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter Descrption if you want..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                <button
                  type="submit"
                  disabled={popupOpen ? createSessionMutation.isLoading : updateSessionMutation.isLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: (popupOpen ? createSessionMutation.isLoading : updateSessionMutation.isLoading) ? 'not-allowed' : 'pointer',
                    opacity: (popupOpen ? createSessionMutation.isLoading : updateSessionMutation.isLoading) ? 0.6 : 1
                  }}
                >
                  {(popupOpen ? createSessionMutation.isLoading : updateSessionMutation.isLoading) ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (popupOpen) {
                      setPopupOpen(false);
                    } else {
                      setEditPopupOpen(false);
                      setSelectedSession(null);
                    }
                    setFormData({ name: '', video_urls: [''], description: '' });
                    setSelectedGrade('');
                    setSelectedWeek('');
                    setPaymentState('paid');
                    setErrors({});
                  }}
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

              {/* General Error - Centered at bottom */}
              {errors.general && (
                <div style={{
                  color: '#dc3545',
                  fontSize: '0.875rem',
                  marginTop: '16px',
                  padding: '8px 12px',
                  backgroundColor: '#f8d7da',
                  borderRadius: '6px',
                  border: '1px solid #f5c6cb',
                  textAlign: 'center'
                }}>
                  {errors.general}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Edit Video Popup */}
      {editPopupOpen && selectedSession && (
        <div
          className="add-video-popup-overlay"
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
                  setEditPopupOpen(false);
                  setSelectedSession(null);
                  setFormData({ name: '', video_urls: [''], description: '' });
                  setSelectedWeek('');
                  setPaymentState('paid');
                  setErrors({});
                }
              }}
        >
          <div
            className="add-video-popup"
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Edit Video Session</h2>

            <form onSubmit={handleUpdateSubmit}>
              {/* Video Grade */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Video Grade <span style={{ color: 'red' }}>*</span>
                </label>
                <GradeSelect
                  selectedGrade={selectedGrade}
                  onGradeChange={(grade) => {
                    setSelectedGrade(grade);
                    if (errors.grade) {
                      setErrors({ ...errors, grade: '' });
                    }
                  }}
                  isOpen={gradeDropdownOpen}
                  onToggle={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                  onClose={() => setGradeDropdownOpen(false)}
                  required={true}
                />
                {errors.grade && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.grade}
                  </div>
                )}
              </div>

              {/* Video Week */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Video Week <span style={{ color: 'red' }}>*</span>
                </label>
                <AttendanceWeekSelect
                  selectedWeek={selectedWeek}
                  onWeekChange={(week) => {
                    setSelectedWeek(week);
                    if (errors.week) {
                      setErrors({ ...errors, week: '' });
                    }
                  }}
                  isOpen={weekDropdownOpen}
                  onToggle={() => setWeekDropdownOpen(!weekDropdownOpen)}
                  onClose={() => setWeekDropdownOpen(false)}
                  required={true}
                  placeholder="Select Video Week"
                />
                {errors.week && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.week}
                  </div>
                )}
              </div>

              {/* Video Payment State Radio */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                  Video Payment State <span style={{ color: 'red' }}>*</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'paid' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'paid' ? '#f0f8ff' : 'white' }}>
                    <input
                      type="radio"
                      name="payment_state"
                      value="paid"
                      checked={paymentState === 'paid'}
                      onChange={(e) => {
                        setPaymentState(e.target.value);
                        if (errors.paymentState) {
                          setErrors({ ...errors, paymentState: '' });
                        }
                      }}
                      style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Paid</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'free' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'free' ? '#f0f8ff' : 'white' }}>
                    <input
                      type="radio"
                      name="payment_state"
                      value="free"
                      checked={paymentState === 'free'}
                      onChange={(e) => {
                        setPaymentState(e.target.value);
                        if (errors.paymentState) {
                          setErrors({ ...errors, paymentState: '' });
                        }
                      }}
                      style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '500' }}>Free</span>
                  </label>
                </div>
                {errors.paymentState && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.paymentState}
                  </div>
                )}
              </div>

              {/* Name Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter Session Name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: errors.name ? '2px solid #dc3545' : '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
                {errors.name && (
                  <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                    {errors.name}
                  </div>
                )}
              </div>

              {/* Youtube Links Inputs */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Youtube link <span style={{ color: 'red' }}>*</span>
                </label>
                {formData.video_urls.map((url, index) => (
                  <div key={index} style={{ marginBottom: index < formData.video_urls.length - 1 ? '12px' : '0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => handleVideoUrlChange(index, e.target.value)}
                        placeholder="Enter The Youtube Video URL."
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: errors[`video_url_${index}`] ? '2px solid #dc3545' : '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      {errors[`video_url_${index}`] && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors[`video_url_${index}`]}
                        </div>
                      )}
                    </div>
                    {index === formData.video_urls.length - 1 && (
                      <button
                        type="button"
                        onClick={addVideoUrl}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          height: '40px'
                        }}
                        title="Add another video"
                      >
                        +
                      </button>
                    )}
                    {formData.video_urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideoUrl(index)}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '40px',
                          height: '40px'
                        }}
                        title="Remove this video"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Description Textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter Descrption if you want..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
                <button
                  type="submit"
                  disabled={updateSessionMutation.isLoading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: updateSessionMutation.isLoading ? 'not-allowed' : 'pointer',
                    opacity: updateSessionMutation.isLoading ? 0.6 : 1
                  }}
                >
                  {updateSessionMutation.isLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditPopupOpen(false);
                    setSelectedSession(null);
                    setFormData({ name: '', video_urls: [''], description: '' });
                    setPaymentState('paid');
                    setErrors({});
                  }}
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

              {/* General Error - Centered at bottom */}
              {errors.general && (
                <div style={{
                  color: '#dc3545',
                  fontSize: '0.875rem',
                  marginTop: '16px',
                  padding: '8px 12px',
                  backgroundColor: '#f8d7da',
                  borderRadius: '6px',
                  border: '1px solid #f5c6cb',
                  textAlign: 'center'
                }}>
                  {errors.general}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteOpen && deleteTarget && (
        <div
          className="confirm-modal"
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
              setConfirmDeleteOpen(false);
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="confirm-content"
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center' }}>
              Confirm Delete
            </h3>
            <p style={{ textAlign: 'center', marginBottom: '24px', color: '#6c757d' }}>
              {(() => {
                const sessionToDelete = sessions.find(s => s._id === deleteTarget.id);
                return `Are you sure you want to delete "${sessionToDelete?.name || 'this session'}"? This action cannot be undone.`;
              })()}
            </p>
            <div className="confirm-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteSessionMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteSessionMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteSessionMutation.isLoading ? 0.7 : 1
                }}
              >
                {deleteSessionMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setDeleteTarget(null);
                }}
                disabled={deleteSessionMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteSessionMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteSessionMutation.isLoading ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Video Button */}
      <div className="add-video-btn-container" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="add-video-btn"
          onClick={() => setPopupOpen(true)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1FA8DC',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#0d5a7a';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#1FA8DC';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
          }}
        >
          ➕ Add Video
        </button>
      </div>

      {/* Video List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>Loading sessions...</div>
      ) : filteredSessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          {sessions.length === 0 ? 'No sessions yet. Add your first video!' : 'No sessions match your filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSessions.map((session, index) => {
            // Calculate video length (count of videos)
            let videoLength = 0;
            let videoIndex = 1;
            while (session[`video_ID_${videoIndex}`]) {
              videoLength++;
              videoIndex++;
            }
            
            return (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) {
                      sessionItemRefs.current[index] = el;
                    } else {
                      delete sessionItemRefs.current[index];
                    }
                  }}
                  className="session-item"
                  onClick={() => toggleSession(index)}
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
              {/* Desktop Layout */}
              <div className="session-item-desktop">
              {/* Header with Edit/Delete buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                    {[session.grade, session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                  </div>
                    <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                      {[session.payment_state || 'paid', `${videoLength} video${videoLength !== 1 ? 's' : ''}`, session.date].filter(Boolean).join(' • ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPopup(session); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1FA8DC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Edit session"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteConfirm(session); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Delete session"
                  >
                    🗑️ Delete
                    </button>
                    <div 
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
                      return videoIds.map((video, vidIndex) => (
                      <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <div
                            onClick={(e) => { e.stopPropagation(); openVideoPopup({ ...session, video_ID: video.id }); }}
                            style={{
                              flex: 1,
                              padding: '10px 15px',
                              backgroundColor: '#1FA8DC',
                              color: 'white',
                              borderRadius: '6px',
                              textAlign: 'center',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#0d5a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#1FA8DC';
                            }}
                          >
                           Video {video.index}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

              {/* Mobile Layout */}
              <div className="session-item-mobile">
                {/* Title with Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', flex: 1 }}>
                    {[session.grade, session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                  </div>
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      color: '#1FA8DC',
                      cursor: 'pointer',
                      marginLeft: '8px'
                    }}
                  >
                    {expandedSessions.has(index) ? (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 448 512"
                        style={{ 
                          width: '20px', 
                          height: '20px'
                        }}
                        fill="currentColor"
                      >
                        <path d="M201.4 342.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 274.7 86.6 137.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
                      </svg>
                    ) : (
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 320 512"
                        style={{ 
                          width: '20px', 
                          height: '20px'
                        }}
                        fill="currentColor"
                      >
                        <path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/>
                      </svg>
                    )}
                  </div>
                </div>
                {/* Metadata */}
                <div style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '12px' }}>
                  {[session.payment_state || 'paid', `${videoLength} video${videoLength !== 1 ? 's' : ''}`, session.date].filter(Boolean).join(' • ')}
                </div>
                {/* Edit/Delete Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '15px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPopup(session); }}
                    style={{
                      padding: '5px 20px',
                      backgroundColor: '#1FA8DC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}
                    title="Edit session"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteConfirm(session); }}
                    style={{
                      padding: '5px 20px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}
                    title="Delete session"
                  >
                    🗑️ Delete
                  </button>
                </div>
                {/* Video Buttons - Collapsible on mobile */}
                {expandedSessions.has(index) && (
                  <div style={{ marginTop: '12px' }}>
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
                      return videoIds.map((video, vidIndex) => (
                        <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                          <div
                            onClick={(e) => { e.stopPropagation(); openVideoPopup({ ...session, video_ID: video.id }); }}
                            style={{
                              width: '100%',
                              padding: '10px 15px',
                              backgroundColor: '#1FA8DC',
                              color: 'white',
                              borderRadius: '8px',
                              textAlign: 'center',
                              fontWeight: '500',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              fontSize: '1rem'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#0d5a7a';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#1FA8DC';
                            }}
                          >
                            Video {video.index}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

          {/* Success message - at bottom */}
          {successMessage && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '8px',
              marginTop: '24px',
              border: '1px solid #c3e6cb',
              textAlign: 'center'
            }}>
              {successMessage}
            </div>
          )}
        </div>

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

              {/* Top UI Mask Overlay - Hides YouTube's top UI elements (logo, date, copy link) */}
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
          
          .session-item-desktop {
            display: block;
          }
          
          .session-item-mobile {
            display: none;
          }
          
          .add-video-btn-container {
            display: flex;
            justify-content: flex-end;
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
            }
            
            .filters-container {
              padding: 16px !important;
            }
            
            .filter-group {
              flex: 1 1 100% !important;
              min-width: 100% !important;
            }
            
            .sessions-container {
              padding: 16px !important;
            }
            
            .session-item-desktop {
              display: none !important;
            }
            
            .session-item-mobile {
              display: block !important;
            }
            
            .add-video-btn-container {
              justify-content: stretch;
            }
            
            .add-video-btn {
              width: 100% !important;
            }
            
            .add-video-popup-overlay {
              padding: 15px !important;
            }
            
            .add-video-popup {
              padding: 20px !important;
              max-width: 100% !important;
              margin: 10px;
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
          }
          
          @media (min-width: 769px) and (max-width: 1024px) {
            .filter-group {
              flex: 1 1 calc(50% - 6px) !important;
              min-width: calc(50% - 6px) !important;
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
            
            .add-video-popup-overlay {
              padding: 10px !important;
            }
            
            .add-video-popup {
              padding: 16px !important;
              margin: 5px;
              border-radius: 8px !important;
            }
            
            .add-video-popup h2 {
              font-size: 1.2rem !important;
              margin-bottom: 16px !important;
            }
            
            .video-popup-overlay {
              padding: 5px !important;
            }
            
            .video-player-container {
              border-radius: 0 !important;
            }
            
            .video-player-container h3 {
              font-size: 0.9rem !important;
              padding: 12px !important;
            }
            
            .confirm-modal-overlay {
              padding: 10px !important;
            }
            
            .confirm-modal {
              padding: 16px !important;
              margin: 5px;
              border-radius: 8px !important;
            }
            
            .confirm-modal h3 {
              font-size: 1.1rem !important;
              margin-bottom: 12px !important;
            }
            
            .confirm-modal p {
              font-size: 0.9rem !important;
              margin-bottom: 20px !important;
            }
            
            .confirm-modal button {
              padding: 8px 16px !important;
              font-size: 0.9rem !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

