import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import ChartTabs from "../../components/ChartTabs";
import { Table, ScrollArea, Modal } from '@mantine/core';
// Removed weeks import - using lessons instead
import styles from '../../styles/TableScrollArea.module.css';
import { useStudents, useStudent, useStudentPublic } from '../../lib/api/students';
import dynamic from 'next/dynamic';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { lessons } from '../../constants/lessons';
import { verifySignature } from '../../lib/hmac';

// Helper function to check if user has token by making API call
const hasToken = async () => {
  if (typeof window === 'undefined') return false;
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export default function StudentInfo() {
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [error, setError] = useState("");
  const [studentDeleted, setStudentDeleted] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results
  const [isValidSignature, setIsValidSignature] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(null);
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsType, setDetailsType] = useState('absent');
  const [detailsWeeks, setDetailsWeeks] = useState([]);
  const [detailsTitle, setDetailsTitle] = useState('');

  // Get all students for name-based search with real-time updates (only if authenticated)
  const { data: allStudents } = useStudents({}, { 
    enabled: !!hasAuthToken,
    // Real-time settings for live updates
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 2000, // Keep in cache for 2 seconds
    refetchOnMount: true, // Always refetch when component mounts/page entered
  });
  
  // React Query hook with real-time updates
  const { data: student, isLoading: studentLoading, error: studentError, refetch: refetchStudent, isRefetching, dataUpdatedAt } = useStudent(searchId, { 
    enabled: !!searchId && !!hasAuthToken,
    // Real-time settings for live updates
    refetchInterval: 3 * 1000, // Refetch every 3 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
    retry: 2, // Retry twice for better reliability
    retryDelay: 1000, // 1 second retry delay
  });

  // Public student hook for HMAC access with real-time updates
  const { data: publicStudent, isLoading: publicStudentLoading, error: publicStudentError, refetch: refetchPublicStudent } = useStudentPublic(studentId, router.query.sig, { 
    enabled: !!studentId && !!isValidSignature && !!router.query.sig && !hasAuthToken,
    // Real-time settings for live updates
    refetchInterval: 3 * 1000, // Refetch every 3 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
    retry: 2, // Retry twice for better reliability
    retryDelay: 1000, // 1 second retry delay
  });

  // Determine which student data to use
  const currentStudent = hasAuthToken ? student : publicStudent;
  const currentStudentLoading = hasAuthToken ? studentLoading : publicStudentLoading;
  const currentStudentError = hasAuthToken ? studentError : publicStudentError;

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await hasToken();
      setHasAuthToken(isAuthenticated);
    };
    checkAuth();
  }, []);

  // Handle URL parameters and HMAC verification
  useEffect(() => {
    if (!router.isReady || hasAuthToken === null) {
      return;
    }
    
    const { id, sig } = router.query;
    
        // Reset states quickly
        setIsLoading(false);
        setIsValidSignature(false);
        setStudentId("");
    
    // Check if signature is provided in URL - verify it regardless of token status
    if (sig) {
      const studentIdFromUrl = String(id || '').trim();
      const signature = String(sig).trim();
      
          // Validate parameters are not empty
          if (!studentIdFromUrl || !signature) {
            console.log('❌ Empty URL parameters with signature');
            router.push('/student_not_found');
            return;
          }
      
      console.log('🔍 Verifying HMAC signature:', { studentIdFromUrl, signature, hasToken: hasAuthToken });
      
      try {
        // Verify the signature
        const isValid = verifySignature(studentIdFromUrl, signature);
        
            if (isValid) {
              console.log('✅ HMAC signature is valid');
              setStudentId(studentIdFromUrl);
              setIsValidSignature(true);
              
              // If user has token, also set searchId to fetch via authenticated API
              if (hasAuthToken) {
                setSearchId(studentIdFromUrl);
              }
            } else {
              console.log('❌ HMAC signature is invalid');
              setIsValidSignature(false);
              router.push('/student_not_found');
            }
      } catch (error) {
        console.error('❌ Error verifying signature:', error);
        setIsValidSignature(false);
        router.push('/student_not_found');
      }
      return;
    }
    
    // No signature in URL - handle based on token status
    if (hasAuthToken) {
      // If authenticated and have ID, put it in search bar
      if (id) {
        setStudentId(String(id));
        setSearchId(String(id));
      }
      return;
    }
    
    // No token and no signature - redirect to login
    console.log('❌ No authentication token and no signature');
    router.push('/');
  }, [router.isReady, router.query.id, router.query.sig, router, hasAuthToken]);

  // Debug logging for React Query status
  useEffect(() => {
    if (currentStudent && (searchId || studentId)) {
      console.log('🔄 Student Info Page - Data Status:', {
        studentId: searchId || studentId,
        studentName: currentStudent.name,
        isRefetching,
        dataUpdatedAt: new Date(dataUpdatedAt).toLocaleTimeString(),
        attendanceStatus: currentStudent.weeks?.[0]?.attended || false
      });
      
      // Debug student data structure
      console.log('📊 Student Data Structure:', {
        grade: currentStudent.grade,
        course: currentStudent.course,
        parents_phone: currentStudent.parents_phone,
        parentsPhone: currentStudent.parentsPhone,
        parentsPhone1: currentStudent.parentsPhone1,
        allFields: Object.keys(currentStudent)
      });
    }
  }, [currentStudent, isRefetching, dataUpdatedAt, searchId, studentId]);

  useEffect(() => {
    if (error && !studentDeleted) {
      // Only auto-hide errors that are NOT "student deleted" errors
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, studentDeleted]);

  // Handle student error
  useEffect(() => {
    if (currentStudentError) {
      if (currentStudentError.response?.status === 404) {
        console.log('❌ Student Info Page - Student not found:', {
          searchId: searchId || studentId,
          error: 'Student deleted or does not exist',
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(true);
        
        // For public access (no token), redirect to student_not_found page immediately
        if (!hasAuthToken) {
          // Immediate redirect without delay
          router.push('/student_not_found');
          return;
        } else {
          setError("Student not exists - This student may have been deleted");
        }
      } else {
        console.log('❌ Student Info Page - Error fetching student:', {
          searchId: searchId || studentId,
          error: currentStudentError.message,
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(false);
        setError("Error fetching student data");
      }
    } else {
      // Clear error when student data loads successfully
      if (currentStudent && !currentStudentError) {
        setStudentDeleted(false);
        setError("");
      }
    }
  }, [currentStudentError, searchId, studentId, currentStudent, hasAuthToken]);

  // Force refetch student data when searchId changes (when student is searched)
  useEffect(() => {
    if (searchId && refetchStudent && hasAuthToken) {
      refetchStudent();
    }
  }, [searchId, refetchStudent, hasAuthToken]);

  // After successful fetch, replace the search input with the student's ID
  useEffect(() => {
    if (currentStudent && currentStudent.id != null && hasAuthToken) {
      const fetchedId = String(currentStudent.id);
      if (studentId !== fetchedId) {
        setStudentId(fetchedId);
      }
    }
  }, [currentStudent, hasAuthToken]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setStudentDeleted(false); // Reset deletion state for new search
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = studentId.trim();
    const isAllDigits = /^\d+$/.test(searchTerm);
    const isFullPhone = /^\d{11}$/.test(searchTerm);
    
    // Full phone -> API accepts directly
    if (isFullPhone) {
      if (allStudents) {
        const matchingStudents = allStudents.filter(s =>
          s.phone === searchTerm || s.parentsPhone1 === searchTerm || s.parentsPhone === searchTerm
        );
        if (matchingStudents.length === 1) {
          setSearchId(matchingStudents[0].id.toString());
          setStudentId(matchingStudents[0].id.toString()); // Auto-replace with ID
        } else {
          setSearchId(searchTerm);
        }
      } else {
        setSearchId(searchTerm);
      }
      return;
    }
    
    // Pure digits, treat as possible ID or partial phone
    if (isAllDigits) {
      // Try exact ID match in local list first
      if (allStudents) {
        const byId = allStudents.find(s => String(s.id) === searchTerm);
        if (byId) {
          setSearchId(String(byId.id));
          setStudentId(String(byId.id));
          return;
        }
        // Partial phone/parent phone startsWith match (like name selection logic)
        const term = searchTerm;
        const matchingStudents = allStudents.filter(s => {
          const phone = String(s.phone || '').replace(/[^0-9]/g, '');
          const parent = String(s.parents_phone || s.parentsPhone || '').replace(/[^0-9]/g, '');
          return phone.startsWith(term) || parent.startsWith(term);
        });
        if (matchingStudents.length === 1) {
          const foundStudent = matchingStudents[0];
          setSearchId(foundStudent.id.toString());
          setStudentId(foundStudent.id.toString());
          return;
        }
        if (matchingStudents.length > 1) {
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setError(`Found ${matchingStudents.length} students. Please select one.`);
          return;
        }
      }
      // Fallback: just use numeric as id
      setSearchId(searchTerm);
      return;
    }
    
    // Name search through all students
    if (allStudents) {
      const matchingStudents = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      if (matchingStudents.length === 1) {
        // Single match, use it directly
        const foundStudent = matchingStudents[0];
        setSearchId(foundStudent.id.toString());
        setStudentId(foundStudent.id.toString());
      } else if (matchingStudents.length > 1) {
        // Multiple matches, show selection
        setSearchResults(matchingStudents);
        setShowSearchResults(true);
        setError(`Found ${matchingStudents.length} students. Please select one.`);
      } else {
        setError(`No student found matching "${searchTerm}"`);
        setSearchId("");
      }
    } else {
      setError("Student data not loaded. Please try again.");
    }
  };

  // Clear student data when ID input is emptied
  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId(""); // Clear search ID to prevent auto-fetch
    if (!value.trim()) {
      setError("");
      setStudentDeleted(false); // Reset deletion state when clearing input
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  // Helper function to get attendance status for a lesson
  const getLessonAttendance = (lessonName) => {
    if (!currentStudent || !currentStudent.lessons) return { attended: false, hwDone: false, homework_degree: null, quizDegree: null, message_state: false, student_message_state: false, parent_message_state: false, lastAttendance: null };
    
    // Handle both new object format and old array format for backward compatibility
    let lessonData;
    if (typeof currentStudent.lessons === 'object' && !Array.isArray(currentStudent.lessons)) {
      // New object format
      lessonData = currentStudent.lessons[lessonName];
    } else if (Array.isArray(currentStudent.lessons)) {
      // Old array format - find by lesson name
      lessonData = currentStudent.lessons.find(l => l && l.lesson === lessonName);
    } else if (currentStudent.weeks && Array.isArray(currentStudent.weeks)) {
      // Very old weeks format - convert lesson name to week number
      const weekIndex = lessons.indexOf(lessonName);
      lessonData = weekIndex >= 0 ? currentStudent.weeks[weekIndex] : null;
    }
    
    if (!lessonData) return { attended: false, hwDone: false, homework_degree: null, quizDegree: null, message_state: false, student_message_state: false, parent_message_state: false, lastAttendance: null };
    
    return {
      attended: lessonData.attended || false,
      hwDone: lessonData.hwDone || false,
      homework_degree: lessonData.homework_degree || null,
      quizDegree: lessonData.quizDegree || null,
      comment: lessonData.comment || null,
      message_state: lessonData.message_state || false,
      student_message_state: lessonData.student_message_state || false,
      parent_message_state: lessonData.parent_message_state || false,
      lastAttendance: lessonData.lastAttendance || null
    };
  };

  // Helper function to get available lessons (all lessons that exist in the database)
  const getAvailableLessons = () => {
    if (!currentStudent) return [];
    
    // Handle new object format - get all lessons that exist in the student's database
    if (currentStudent.lessons && typeof currentStudent.lessons === 'object' && !Array.isArray(currentStudent.lessons)) {
      return Object.keys(currentStudent.lessons).map(lessonName => ({
        lesson: lessonName,
        ...currentStudent.lessons[lessonName]
      })).filter(lesson => lesson.lesson); // Filter out any invalid lessons
    }
    
    // Handle old array format
    if (currentStudent.lessons && Array.isArray(currentStudent.lessons)) {
      return currentStudent.lessons.filter(l => l && l.lesson);
    }
    
    // Handle very old weeks format
    if (currentStudent.weeks && Array.isArray(currentStudent.weeks)) {
      return currentStudent.weeks.map((week, index) => ({
        lesson: lessons[index] || `Lesson ${index + 1}`,
        ...week
      })).filter(week => week.attended !== undefined);
    }
    
    return [];
  };

  // Helper to compute totals for the student across all lessons
  const getTotals = () => {
    const availableLessons = getAvailableLessons();
    const totalLessons = availableLessons.length;
    
    // Count lessons where student attended (attended = true)
    const attendedLessons = availableLessons.filter(lesson => lesson.attended === true).length;
    
    // Count lessons where student was absent (attended = false)
    const absent = availableLessons.filter(lesson => lesson.attended === false).length;
    
    // Count missing homework (only for lessons that exist in student records)
    const lessons = getAvailableLessons();
    const missingHW = lessons.filter(l => l && (l.hwDone === false || l.hwDone === "Not Completed" || l.hwDone === "not completed" || l.hwDone === "NOT COMPLETED")).length;
    
    // Count unattended quizzes (only for lessons that exist in student records)
    const unattendQuiz = lessons.filter(l => l && (l.quizDegree === "Didn't Attend The Quiz" || l.quizDegree == null)).length;
    
    return { absent, missingHW, unattendQuiz };
  };

  // Helpers to build detailed lesson lists
  const getAbsentLessons = (lessons) => {
    const availableLessons = getAvailableLessons();
    
    return availableLessons
      .filter(lesson => {
        return lesson.attended === false; // Only include lessons where attended is explicitly false
      })
      .map(lesson => ({
        lesson: lesson.lesson,
        quizDegree: null // Absent lessons don't have quiz data
      }));
  };

  const getMissingHWLessons = (lessons) => {
    if (!Array.isArray(lessons)) return [];
    return lessons
      .filter(l => l && (l.hwDone === false || l.hwDone === "Not Completed" || l.hwDone === "not completed" || l.hwDone === "NOT COMPLETED"))
      .map(l => ({
        lesson: l.lesson,
        hwDone: l.hwDone,
        quizDegree: l.quizDegree
      }));
  };

  const getUnattendQuizLessons = (lessons) => {
    if (!Array.isArray(lessons)) return [];
    return lessons
      .filter(l => l && (l.quizDegree === "Didn't Attend The Quiz" || l.quizDegree == null))
      .map(l => ({
        lesson: l.lesson,
        quizDegree: l.quizDegree
      }));
  };

  const openDetails = (type) => {
    if (!currentStudent) return;
    let title = '';
    let lessonsList = [];
    const lessons = getAvailableLessons();
    if (type === 'absent') {
      title = `Absent Lessons for ${currentStudent.name} • ID: ${currentStudent.id}`;
      lessonsList = getAbsentLessons(); // No need to pass lessons parameter
    } else if (type === 'hw') {
      title = `Missing Homework for ${currentStudent.name} • ID: ${currentStudent.id}`;
      lessonsList = getMissingHWLessons(lessons);
    } else if (type === 'quiz') {
      title = `Unattended Quizzes for ${currentStudent.name} • ID: ${currentStudent.id}`;
      lessonsList = getUnattendQuizLessons(lessons);
    }
    setDetailsType(type);
    setDetailsWeeks(lessonsList);
    setDetailsTitle(title);
    setDetailsOpen(true);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #1FA8DC',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div style={{ fontSize: '18px', color: '#666' }}>Loading...</div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: "20px 5px 20px 5px"
    }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "auto", padding: 24 }}>
        <style jsx>{`
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
          }
          .fetch-form {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
          }
          .fetch-input {
            flex: 1;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
          }
          .fetch-input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .fetch-btn {
            background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 140px;
            justify-content: center;
          }
          .fetch-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
            background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%);
          }
          .fetch-btn:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .info-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-top: 20px;
          }
          .student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 30px;
          }
          
          .student-details .detail-item:last-child:nth-child(odd) {
            grid-column: 1 / -1;
          }
          
          @media (max-width: 768px) {
            .student-details {
              grid-template-columns: 1fr;
            }
          }
          .detail-item {
            padding: 20px;
            background: #ffffff;
            border-radius: 12px;
            border: 2px solid #e9ecef;
            border-left: 4px solid #1FA8DC;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
          }
          .detail-label {
            font-weight: 700;
            color: #6c757d;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .detail-value {
            font-size: 1rem;
            color: #212529;
            font-weight: 600;
            line-height: 1.4;
          }
          .weeks-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            text-align: center;
            border-bottom: 2px solid #1FA8DC;
            padding-bottom: 10px;
          }
          
          @media (max-width: 768px) {
            .fetch-form {
              flex-direction: column;
              gap: 12px;
            }
            .fetch-btn {
              width: 100%;
              padding: 14px 20px;
              font-size: 0.95rem;
            }
            .fetch-input {
              width: 100%;
            }
            .form-container, .info-container {
              padding: 24px;
            }
            .student-details {
              gap: 12px;
            }
          }
          
          @media (max-width: 480px) {
            .form-container, .info-container {
              padding: 20px;
            }
            .detail-item {
              padding: 12px;
            }
            .detail-label {
              font-size: 0.85rem;
            }
            .detail-value {
              font-size: 1rem;
            }
            .weeks-title {
              font-size: 1.3rem;
            }
          }
        `}</style>

        {/* Only show title if authenticated */}
        {hasAuthToken && <Title>Student Info</Title>}

        {/* Only show search form if authenticated */}
        {hasAuthToken && (
          <div className="form-container">
            <form onSubmit={handleIdSubmit} className="fetch-form">
              <input
                className="fetch-input"
                type="text"
                placeholder="Enter Student ID, Name, Phone Number"
                value={studentId}
                onChange={handleIdChange}
                required
              />
              <button type="submit" className="fetch-btn" disabled={currentStudentLoading}>
                {currentStudentLoading ? "Loading..." : "🔍 Search"}
          </button>
            </form>
            
            {/* Show search results if multiple matches found */}
            {showSearchResults && searchResults.length > 0 && (
              <div style={{ 
                marginTop: "16px", 
                padding: "16px", 
                background: "#f8f9fa", 
                borderRadius: "8px", 
                border: "1px solid #dee2e6" 
              }}>
                <div style={{ 
                  marginBottom: "12px", 
                  fontWeight: "600", 
                  color: "#495057" 
                }}>
                  Select a student:
                </div>
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => handleStudentSelect(student)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 16px",
                      margin: "8px 0",
                      background: "white",
                      border: "1px solid #dee2e6",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = "#e9ecef";
                      e.target.style.borderColor = "#1FA8DC";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "white";
                      e.target.style.borderColor = "#dee2e6";
                    }}
                  >
                    <div style={{ fontWeight: "600", color: "#1FA8DC" }}>
                      {student.name} (ID: {student.id})
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#495057", marginTop: 4 }}>
                      <span style={{ fontFamily: 'monospace' }}>{student.phone || 'N/A'}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#6c757d", marginTop: 2 }}>
                      {student.grade} • {student.main_center}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Welcome title for public access (no token) */}
        {currentStudent && !studentDeleted && !hasAuthToken && (
          <div style={{
            textAlign: "center",
            marginBottom: "24px"
          }}>
            <h1 style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              color: "white",
              margin: "0",
              textShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              Welcome to Trackify!
            </h1>
          </div>
        )}

        {currentStudent && !studentDeleted && (
          <div className="info-container">
            <div className="student-details">
              {/* Only show Student ID if user doesn't have token */}
              {!hasAuthToken && (
                <div className="detail-item">
                  <div className="detail-label">Student ID</div>
                  <div className="detail-value">{currentStudent.id}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Student Name</div>
                <div className="detail-value">{currentStudent.name}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Student Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{currentStudent.phone}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent's Phone (1)</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{currentStudent.parents_phone || currentStudent.parentsPhone || currentStudent.parentsPhone1 || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent's Phone (2)</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{currentStudent.parentsPhone2 || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">School</div>
                <div className="detail-value">{currentStudent.school || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Address</div>
                <div className="detail-value">{currentStudent.address || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Main Center</div>
                <div className="detail-value">{currentStudent.main_center}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course</div>
                <div className="detail-value">{currentStudent.grade || currentStudent.course || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Course Type</div>
                <div className="detail-value">{currentStudent.courseType || 'N/A'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Available Number of Sessions</div>
                <div className="detail-value" style={{ 
                  color: (currentStudent.payment?.numberOfSessions || 0) <= 2 ? '#dc3545' : '#212529',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <span style={{ 
                    fontSize: '18px', 
                    fontWeight: '800',
                    lineHeight: '1.2'
                  }}>
                    {(currentStudent.payment?.numberOfSessions || 0)}
                  </span>
                  <span style={{ 
                    fontSize: '17px', 
                    fontWeight: '600',
                    opacity: '0.9',
                    textTransform: 'lowercase'
                  }}>
                    sessions
                  </span>
                </div>
              </div>
              {/* Always show hidden comment if authenticated */}
              {hasAuthToken && (
                <div className="detail-item">
                  <div className="detail-label">Hidden Comment</div>
                  <div className="detail-value" style={{ fontSize: '1rem' }}>
                    {currentStudent.main_comment || 'No Comment'}
                  </div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Account Status</div>
                <div className="detail-value" style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  {currentStudent.account_state === 'Deactivated' ? (
                    <span style={{ color: '#dc3545' }}>❌ Deactivated</span>
                  ) : (
                    <span style={{ color: '#28a745' }}>✅ Activated</span>
                  )}
                </div>
              </div>
              {(() => {
                const totals = getTotals();
                return (
                  <>
                    <div className="detail-item" onClick={() => openDetails('absent')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Absent Lessons</div>
                      <div className="detail-value" style={{ color: '#dc3545', fontWeight: 600 }}>{totals.absent}</div>
                    </div>
                    <div className="detail-item" onClick={() => openDetails('hw')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Missing Homework</div>
                      <div className="detail-value" style={{ color: '#fd7e14', fontWeight: 600 }}>{totals.missingHW}</div>
                    </div>
                    <div className="detail-item" onClick={() => openDetails('quiz')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Unattend Quizzes</div>
                      <div className="detail-value" style={{ color: '#1FA8DC', fontWeight: 600 }}>{totals.unattendQuiz}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div className="weeks-title">All Lessons Records - Available Lessons ({getAvailableLessons().length} lessons)</div>
            {getAvailableLessons().length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6c757d',
                fontSize: '1.1rem',
                fontWeight: '500',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                📋 No lessons records found for this student
              </div>
            ) : (
              <ScrollArea h="auto" type="hover" className={styles.scrolled}>
                <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: '950px' }}>
                  <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Lesson</Table.Th>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Attendance Info</Table.Th>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Homework</Table.Th>
                      
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Quiz Degree</Table.Th>
                      <Table.Th style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}>Comment</Table.Th>
                      <Table.Th style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>Student Message State</Table.Th>
                      <Table.Th style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>Parent Message State</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {getAvailableLessons().map((lesson) => {
                      const lessonName = lesson.lesson;
                      const lessonData = getLessonAttendance(lessonName);
                      
                      return (
                        <Table.Tr key={lessonName}>
                          <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', width: '120px', minWidth: '120px', textAlign: 'center', fontSize: '1rem' }}>
                            {lessonName}
                          </Table.Td>
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            <span style={{ 
                              color: lessonData.attended ? (lessonData.lastAttendance ? '#212529' : '#28a745') : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {lessonData.attended ? (lessonData.lastAttendance || '✅ Yes') : '❌ Absent / Didn\'t attend yet'}
                            </span>
                          </Table.Td>
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            {(() => {
                              if (lessonData.hwDone === "No Homework") {
                                return <span style={{ 
                                  color: '#dc3545',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>🚫 No Homework</span>;
                              } else if (lessonData.hwDone === "Not Completed" || lessonData.hwDone === "not completed" || lessonData.hwDone === "NOT COMPLETED") {
                                return <span style={{ 
                                  color: '#ffc107',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>⚠️ Not Completed</span>;
                              } else if (lessonData.hwDone === true) {
                                // Check if there's a homework degree to display
                                const homeworkDegree = lessonData.homework_degree;
                                if (homeworkDegree && homeworkDegree !== null && homeworkDegree !== '') {
                                  return <span style={{ 
                                    color: '#28a745',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                  }}>✅ Done ({homeworkDegree})</span>;
                                } else {
                                  return <span style={{ 
                                    color: '#28a745',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                  }}>✅ Done</span>;
                                }
                              } else {
                                return <span style={{ 
                                  color: '#dc3545',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>❌ Not Done</span>;
                              }
                            })()}
                          </Table.Td>
                          
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            {(() => {
                              const value = lessonData.quizDegree !== null && lessonData.quizDegree !== undefined && lessonData.quizDegree !== '' ? lessonData.quizDegree : '0/0';
                              if (value === "Didn't Attend The Quiz") {
                                return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1rem' }}>❌ Didn't Attend The Quiz</span>;
                              } else if (value === "No Quiz") {
                                return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1rem' }}>🚫 No Quiz</span>;
                              }
                              return (
                                <span style={{ 
                                  fontWeight: 'bold',
                                  fontSize: '1rem',
                                  color: '#1FA8DC'
                                }}>
                                  {value}
                                </span>
                              );
                            })()}
                          </Table.Td>
                          <Table.Td style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}>
                            {(() => {
                              const weekComment = lessonData.comment;
                              const val = (weekComment && String(weekComment).trim() !== '') ? weekComment : 'No Comment';
                              return <span style={{ fontSize: '1rem' }}>{val}</span>;
                            })()}
                          </Table.Td>
                          <Table.Td style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>
                            <span style={{ 
                              color: lessonData.student_message_state ? '#28a745' : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {lessonData.student_message_state ? '✅ Sent' : '❌ Not Sent'}
                            </span>
                          </Table.Td>
                          <Table.Td style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>
                            <span style={{ 
                              color: lessonData.parent_message_state ? '#28a745' : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {lessonData.parent_message_state ? '✅ Sent' : '❌ Not Sent'}
                            </span>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
            
            {/* Mock Exam Results Section */}
            <div style={{ marginTop: '30px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#495057', marginBottom: '20px', textAlign: 'center', borderBottom: '2px solid #1FA8DC', paddingBottom: '10px' }}>
                Mock Exam Results
              </div>
              {currentStudent.mockExams && Array.isArray(currentStudent.mockExams) && currentStudent.mockExams.some(exam => exam && (exam.examDegree !== null || exam.percentage !== null)) ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {currentStudent.mockExams.map((exam, index) => {
                    if (exam && (exam.examDegree !== null || exam.percentage !== null)) {
                      return (
                        <div key={index} className="detail-item" style={{ padding: '12px' }}>
                          <div className="detail-label">Exam {index + 1}</div>
                          <div className="detail-value">
                            {exam.examDegree !== null && exam.outOf !== null && (
                              <div>Degree: {exam.examDegree} / {exam.outOf}</div>
                            )}
                            {exam.percentage !== null && (
                              <div style={{ color: '#28a745', fontWeight: 'bold', marginTop: '3px', marginBottom: '3px' }}>
                                Percentage: {exam.percentage}%
                              </div>
                            )}
                            {exam.date && (
                              <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
                                Date: {exam.date}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px', 
                  color: '#6c757d', 
                  fontSize: '1rem',
                  fontStyle: 'italic'
                }}>
                  There are no recent exams.
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Charts Tabs Section - Outside lessons container */}
        {currentStudent?.lessons && (
          <div style={{ marginTop: 24 }}>
            <ChartTabs lessons={currentStudent.lessons} mockExams={currentStudent.mockExams} />
          </div>
        )}
        
        <Modal
          opened={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '8px 0',
              position: 'relative',
              paddingRight: '60px' // Add space for the close button
            }}>
              <div style={{
                width: '70px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: 'white',
              }}>
                {detailsType === 'absent' && '📅'}
                {detailsType === 'hw' && '📝'}
                {detailsType === 'quiz' && '📊'}
              </div>
              <div>
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: '700', 
                  color: '#2c3e50'
                }}>
                  {detailsTitle}
                </div>
              </div>
            </div>
          }
          centered
          radius="md"
          size="lg"
          withCloseButton={false}
          overlayProps={{ opacity: 0.3, blur: 2 }}
          styles={{
            content: {
              background: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef',
              maxWidth: '95vw',
              maxHeight: '90vh',
              margin: '10px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              '@media (max-width: 768px)': {
                margin: '5px',
                maxWidth: '98vw',
                maxHeight: '95vh'
              }
            },
            header: {
              background: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              padding: '16px 20px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              flexShrink: 0,
              '@media (max-width: 768px)': {
                padding: '12px 16px'
              }
            },
            body: {
              padding: '0',
              overflow: 'auto',
              flex: 1,
              '@media (max-width: 768px)': {
                padding: '0'
              }
            }
          }}
        >
          {/* Absolutely positioned close button */}
          <button
            onClick={() => setDetailsOpen(false)}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              zIndex: 1000,
              '@media (max-width: 768px)': {
                width: '36px',
                height: '36px',
                fontSize: '18px',
                top: '12px',
                right: '12px'
              }
            }}
            aria-label="Close details"
          >
            ❌
          </button>
          
          <div style={{ 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            '@media (max-width: 768px)': { padding: '16px' } 
          }}>
            {(!detailsWeeks || detailsWeeks.length === 0) ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '12px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  opacity: 0.6
                }}>
                  🎉
                </div>
                <div style={{ 
                  color: '#28a745', 
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  marginBottom: '8px'
                }}>
                  Excellent Performance!
                </div>
                <div style={{ 
                  color: '#6c757d', 
                  fontWeight: '500',
                  fontSize: '1rem'
                }}>
                  No {detailsType === 'absent' ? 'absent lessons' : 
                       detailsType === 'hw' ? 'missing homework' : 'unattended quizzes'} found.
                </div>
              </div>
            ) : (
              <div style={{ 
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}>
                <div style={{ 
                  flex: 1, 
                  overflow: 'auto',
                  maxHeight: '400px'
                }}>
                  <Table 
                    withTableBorder 
                    withColumnBorders
                    striped
                    highlightOnHover
                    styles={{
                      root: {
                        border: 'none',
                        '@media (max-width: 768px)': {
                          fontSize: '0.85rem'
                        }
                      },
                      thead: {
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
                      },
                      th: {
                        fontWeight: '700',
                        color: '#495057',
                        fontSize: '1rem',
                        padding: '16px 12px',
                        borderBottom: '2px solid #dee2e6',
                        '@media (max-width: 768px)': {
                          fontSize: '0.9rem',
                          padding: '12px 8px'
                        }
                      },
                      td: {
                        padding: '14px 12px',
                        fontSize: '0.95rem',
                        '@media (max-width: 768px)': {
                          padding: '10px 8px',
                          fontSize: '0.85rem'
                        }
                      }
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '140px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            📚 Lesson
                          </div>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {detailsType === 'absent' && '❌ Attendance Status'}
                            {detailsType === 'hw' && '📝 Homework Status'}
                            {detailsType === 'quiz' && '📊 Quiz Status'}
                          </div>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {detailsWeeks.map((info, index) => (
                        <Table.Tr key={`student-${searchId || studentId}-${info.lesson}`} style={{
                          background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                          transition: 'all 0.2s ease'
                        }}>
                          <Table.Td style={{ 
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#495057',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            border: '1px solid #90caf9'
                          }}>
                            <div style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: 'white',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              {info.lesson}
                            </div>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {detailsType === 'absent' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                border: '1px solid #ef5350',
                                color: '#c62828',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: '0 2px 4px rgba(244, 67, 54, 0.2)'
                              }}>
                                ❌ Absent / Didn't attend yet
                              </div>
                            )}
                            {detailsType === 'hw' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: info.hwDone === "No Homework" ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)' :
                                  info.hwDone === false ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                                border: info.hwDone === "No Homework" ? 
                                  '1px solid #ef5350' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '1px solid #ffc107' :
                                  info.hwDone === false ? 
                                  '1px solid #ef5350' : '1px solid #28a745',
                                color: info.hwDone === "No Homework" ? 
                                  '#c62828' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '#856404' :
                                  info.hwDone === false ? 
                                  '#c62828' : '#155724',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: info.hwDone === "No Homework" ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '0 2px 4px rgba(255, 193, 7, 0.2)' :
                                  info.hwDone === false ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : '0 2px 4px rgba(40, 167, 69, 0.2)'
                              }}>
                                {info.hwDone === "No Homework" ? '🚫 No Homework' :
                                 (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? '⚠️ Not Completed' : '❌ Not Done'}
                              </div>
                            )}
                            {detailsType === 'quiz' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  info.quizDegree === "No Quiz" ?
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                                border: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '1px solid #ef5350' : 
                                  info.quizDegree === "No Quiz" ?
                                  '1px solid #ef5350' : '1px solid #42a5f5',
                                color: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '#c62828' : 
                                  info.quizDegree === "No Quiz" ?
                                  '#c62828' : '#1565c0',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : 
                                  info.quizDegree === "No Quiz" ?
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : '0 2px 4px rgba(66, 165, 245, 0.2)'
                              }}>
                                {info.quizDegree == null ? '0/0' : 
                                 (info.quizDegree === "Didn't Attend The Quiz" ? "❌ Didn't Attend" : 
                                  info.quizDegree === "No Quiz" ? "🚫 No Quiz" : String(info.quizDegree))}
                              </div>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
                
                {/* Fixed Summary Footer */}
                <div style={{
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  padding: '16px 20px',
                  borderTop: '2px solid #dee2e6',
                  textAlign: 'center',
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 5
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#495057',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '15px',
                      background: 'white',
                      border: '1px solid #dee2e6',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      📊 Total: {detailsWeeks.length} {detailsType === 'absent' ? 'absent lessons' : 
                                 detailsType === 'hw' ? 'missing homework' : 'unattended quizzes'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}