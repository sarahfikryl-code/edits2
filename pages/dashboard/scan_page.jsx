import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import AttendanceWeekSelect from "../../components/AttendancelessonSelect";
import CenterSelect from "../../components/CenterSelect";
import QRScanner from "../../components/QRScanner";
import { useStudents, useStudent, useToggleAttendance, useUpdateHomework, useUpdateHomeworkDegree, useUpdateQuizGrade, useUpdateWeekComment } from "../../lib/api/students";

// Helper to extract student ID from QR text (URL or plain number)
function extractStudentId(qrText) {
  try {
    // Try to parse as URL and extract id param
    const url = new URL(qrText);
    const id = url.searchParams.get('id');
    if (id) return id;
  } catch (e) {
    // Not a URL, fall through
  }
  // Fallback: if it's just a number
  if (/^\d+$/.test(qrText)) {
    return qrText;
  }
  return null;
}

export default function QR() {
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [isFromURL, setIsFromURL] = useState(false); // Flag to track if ID came from URL
  const [error, setError] = useState("");
  const [attendSuccess, setAttendSuccess] = useState(false);
  const [hwSuccess, setHwSuccess] = useState("");
  const [attendanceSuccess, setAttendanceSuccess] = useState("");
  const [attendanceCenter, setAttendanceCenter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [quizDegreeInput, setQuizDegreeInput] = useState("");
  const [quizDegreeOutOf, setQuizDegreeOutOf] = useState("");
  const [weekComment, setWeekComment] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [quizSuccess, setQuizSuccess] = useState("");
  const [notQuized, setNotQuized] = useState(false);
  const [noQuiz, setNoQuiz] = useState(false);
  const [noHomework, setNoHomework] = useState(false);
  const [notCompleted, setNotCompleted] = useState(false);
  const [homeworkDegree, setHomeworkDegree] = useState("");
  const [homeworkDegreeOutOf, setHomeworkDegreeOutOf] = useState("");
  const [homeworkDegreeSuccess, setHomeworkDegreeSuccess] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // 'week', 'center', or null
  // Simple optimistic state for immediate UI feedback
  const [optimisticHwDone, setOptimisticHwDone] = useState(null);
  
  const [optimisticAttended, setOptimisticAttended] = useState(null);
  // Track explicit search button clicks to force re-checks
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [isQRScanned, setIsQRScanned] = useState(false); // Track if student was found via QR scan
  const [deactivatedErrorShown, setDeactivatedErrorShown] = useState(false); // Track if deactivated error was shown
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results
  const router = useRouter();

  // Handle URL parameters for auto-filling student ID and triggering search
  useEffect(() => {
    if (!router.isReady) return;
    const { studentId: urlStudentId, autoSearch } = router.query;

    if (urlStudentId && autoSearch === 'true') {
      console.log('🔧 Setting student ID from URL:', urlStudentId);
      setStudentId(urlStudentId);
      setSearchId(urlStudentId);
      setIsFromURL(true);
    }
  }, [router.isReady, router.query]);

  // React Query hooks with enhanced real-time updates
  const { data: rawStudent, isLoading: studentLoading, error: studentError } = useStudent(searchId, { 
    enabled: !!searchId,
    // Optimized for fast error responses
    refetchInterval: 2 * 1000, // Refetch every 2 seconds for faster updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    staleTime: 0, // Always consider data stale for immediate updates
    gcTime: 1000, // Keep in cache for only 1 second to force fresh data
    retry: 1, // Only retry once to show errors faster
    retryDelay: 500, // Retry after 500ms instead of default longer delay
  });
  
  // Get all students for name-based search
  const { data: allStudents } = useStudents();
  const toggleAttendanceMutation = useToggleAttendance();
  const updateHomeworkMutation = useUpdateHomework();
  const updateHomeworkDegreeMutation = useUpdateHomeworkDegree();
  const updateQuizGradeMutation = useUpdateQuizGrade();
  const updateWeekCommentMutation = useUpdateWeekComment();

  // Load remembered values from sessionStorage
  useEffect(() => {
    const rememberedCenter = sessionStorage.getItem('lastAttendanceCenter');
    const rememberedLesson = sessionStorage.getItem('lastSelectedLesson');
    const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    
    console.log('Loading from session storage:', { rememberedCenter, rememberedLesson, rememberedQuizOutOf, rememberedHomeworkOutOf });
    
    if (rememberedCenter) {
      setAttendanceCenter(rememberedCenter);
      console.log('Center loaded from session storage:', rememberedCenter);
    }
    if (rememberedLesson) {
      setSelectedWeek(rememberedLesson);
      console.log('Lesson loaded from session storage:', rememberedLesson);
    }
    if (rememberedQuizOutOf) {
      setQuizDegreeOutOf(rememberedQuizOutOf);
      console.log('Quiz out of loaded from session storage:', rememberedQuizOutOf);
    }
    if (rememberedHomeworkOutOf) {
      setHomeworkDegreeOutOf(rememberedHomeworkOutOf);
      console.log('Homework out of loaded from session storage:', rememberedHomeworkOutOf);
    }
  }, []);

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
  }, [router]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        // Also blur any focused input to close browser autocomplete
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to get lesson name (now lessons are named, not numbered)
  const getLessonName = (lessonString) => {
    if (!lessonString) return null;
    // For backward compatibility, check if it's a numbered lesson format
    const lessonMatch = lessonString.match(/lesson (\d+)/i);
    const weekMatch = lessonString.match(/week (\d+)/i);
    if (lessonMatch || weekMatch) {
      // Convert numbered lessons to names (for backward compatibility)
      const num = parseInt((lessonMatch || weekMatch)[1]);
      const lessonNames = ['If Conditions', 'Transition Words', 'Parallel Structure', 'Subject-Verb Agreement', 'Pronoun Usage', 'Modifier Placement', 'Verb Tenses', 'Punctuation Rules', 'Redundancy and Wordiness', 'Tone and Style'];
      return lessonNames[num - 1] || 'If Conditions';
    }
    // If it's already a lesson name, return it as is
    console.log('🔧 Using lesson name:', { lessonString });
    return lessonString;
  };

  // Helper function to get current lesson data
  const getCurrentLessonData = (student, lessonString) => {
    if (!lessonString) return null;
    const lessonName = getLessonName(lessonString);
    if (!lessonName) return null;
    
    // Handle both new object format and old array format for backward compatibility
    if (student.lessons && typeof student.lessons === 'object') {
      return student.lessons[lessonName] || null;
    } else if (student.lessons && Array.isArray(student.lessons)) {
      // Old array format - find by lesson name
      return student.lessons.find(l => l && l.lesson === lessonName) || null;
    } else if (student.weeks && Array.isArray(student.weeks)) {
      // Very old weeks format - convert to lesson name
      const lessonNames = ['If Conditions', 'Transition Words', 'Parallel Structure', 'Subject-Verb Agreement', 'Pronoun Usage', 'Modifier Placement', 'Verb Tenses', 'Punctuation Rules', 'Redundancy and Wordiness', 'Tone and Style'];
      const weekIndex = lessonNames.indexOf(lessonName);
      return weekIndex >= 0 ? student.weeks[weekIndex] : null;
    }
    return null;
  };

  // Helper function to update student state with current lesson data
  const updateStudentWithLessonData = (student, lessonString) => {
    const lessonData = getCurrentLessonData(student, lessonString);
    
    // If lesson data doesn't exist, return student with default lesson values (not attended)
    if (!lessonData) {
      return {
        ...student,
        attended_the_session: false,
        lastAttendance: null,
        lastAttendanceCenter: null,
        hwDone: false,
        homework_degree: null,
        quizDegree: null,
        comment: null,
        message_state: false
      };
    }
    
    return {
      ...student,
      attended_the_session: lessonData.attended,
      lastAttendance: lessonData.lastAttendance,
      lastAttendanceCenter: lessonData.lastAttendanceCenter,
      hwDone: lessonData.hwDone,
      homework_degree: lessonData.homework_degree,
      quizDegree: lessonData.quizDegree,
      comment: lessonData.comment,
      message_state: lessonData.message_state
    };
  };

  // Update student data with current lesson information using useMemo
  const student = useMemo(() => {
    if (rawStudent && selectedWeek) {
      return updateStudentWithLessonData(rawStudent, selectedWeek);
    }
    return rawStudent;
  }, [rawStudent, selectedWeek]);

  // After successful fetch, replace manual input with the fetched student's numeric ID
  useEffect(() => {
    if (rawStudent && rawStudent.id != null) {
      const fetchedId = String(rawStudent.id);
      if (studentId !== fetchedId) {
        setStudentId(fetchedId);
      }
    }
  }, [rawStudent]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    const searchTerm = studentId.trim();
    
    // Mark that this is a manual search, not QR scan
    setIsQRScanned(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setError(""); // Clear any previous errors
    setDeactivatedErrorShown(false); // Reset deactivated error flag
    setSearchAttempt((n) => n + 1); // mark a new explicit search
    
    const isAllDigits = /^\d+$/.test(searchTerm);
    const isFullPhone = /^\d{11}$/.test(searchTerm);
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
    if (isAllDigits) {
      if (allStudents) {
        const byId = allStudents.find(s => String(s.id) === searchTerm);
        if (byId) { setSearchId(String(byId.id)); setStudentId(String(byId.id)); return; }
        const termDigits = searchTerm;
        const matches = allStudents.filter(s => {
          const sp = String(s.phone||'').replace(/[^0-9]/g,'');
          const pp = String(s.parents_phone||s.parentsPhone||'').replace(/[^0-9]/g,'');
          return sp.startsWith(termDigits) || pp.startsWith(termDigits);
        });
        if (matches.length === 1) { const f=matches[0]; setSearchId(String(f.id)); setStudentId(String(f.id)); return; }
        if (matches.length > 1) { setSearchResults(matches); setShowSearchResults(true); setError(`Found ${matches.length} students. Please select one.`); return; }
      }
      setSearchId(searchTerm); return;
    }
    if (allStudents) {
      const matchingStudents = allStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      if (matchingStudents.length === 1) {
        const foundStudent = matchingStudents[0];
        setSearchId(foundStudent.id.toString());
        setStudentId(foundStudent.id.toString());
      } else if (matchingStudents.length > 1) {
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

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
    setIsQRScanned(false); // Mark as manual search
  };

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    
  }, [studentId, student]);

  // Auto-attend student function
  const autoAttendStudent = async (studentId) => {
    try {
      console.log('🤖 Auto-attending student:', student.name, 'for lesson:', selectedWeek, 'center:', attendanceCenter);
      
      // Set optimistic state immediately
      setOptimisticAttended(true);
      
      const lessonName = getLessonName(selectedWeek);
      if (!lessonName) {
        console.error('❌ lessonName is missing — skipping attendance update');
        setError('Please select a valid lesson before marking attendance.');
        return;
      }
      
      // Create attendance data
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const lastAttendance = `${day}/${month}/${year} in ${attendanceCenter}`;
      
      const attendanceData = { 
        attended: true,
        lastAttendance, 
        lastAttendanceCenter: attendanceCenter, 
        attendanceLesson: lessonName 
      };
      
      // Call the attendance API
      toggleAttendanceMutation.mutate({
        id: student.id,
        attendanceData
      });
      
    } catch (error) {
      console.error('Error in auto-attend:', error);
      // Reset optimistic state on error
      setOptimisticAttended(null);
    }
  };

  // Handle QR code scanned from the QRScanner component
  const handleQRCodeScanned = (scannedStudentId) => {
    setError("");
    setAttendSuccess(false);
    setDeactivatedErrorShown(false); // Reset deactivated error flag
    setStudentId(scannedStudentId);
    setSearchId(scannedStudentId);
    
    // Only mark as QR scanned if center and week are already selected
    // This prevents auto-attendance if student is scanned before selecting center/week
    if (attendanceCenter && selectedWeek) {
      setIsQRScanned(true); // Mark that this student was found via QR scan with conditions met
    } else {
      setIsQRScanned(false); // Don't auto-attend if conditions not met at scan time
    }
  };

  // Handle QR scanner errors
  const handleQRScannerError = (errorMessage) => {
    // Handle both Error objects and strings
    if (errorMessage instanceof Error) {
      console.log(errorMessage.message || 'An error occurred');
    } else {
      console.log(errorMessage);
    }
  };

  // Auto-hide error after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide comment success after 4 seconds
  useEffect(() => {
    if (commentSuccess) {
      const timer = setTimeout(() => setCommentSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [commentSuccess]);

  // Auto-hide quiz success after 4 seconds
  useEffect(() => {
    if (quizSuccess) {
      const timer = setTimeout(() => setQuizSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [quizSuccess]);

  // Auto-hide homework success after 4 seconds
  useEffect(() => {
    if (hwSuccess) {
      const timer = setTimeout(() => setHwSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [hwSuccess]);

  // Auto-hide homework degree success after 4 seconds
  useEffect(() => {
    if (homeworkDegreeSuccess) {
      const timer = setTimeout(() => setHomeworkDegreeSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [homeworkDegreeSuccess]);

  // Auto-hide attendance success after 4 seconds
  useEffect(() => {
    if (attendanceSuccess) {
      const timer = setTimeout(() => setAttendanceSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [attendanceSuccess]);

  // Handle student errors from React Query with immediate feedback
  useEffect(() => {
    if (studentError) {
      setError("Student not found or unauthorized.");
    }
  }, [studentError]);

  // Show immediate error when searchId changes but no student is found after a short delay
  useEffect(() => {
    if (searchId && !studentLoading) {
      const timer = setTimeout(() => {
        if (!rawStudent && !studentError) {
          setError("Student not found or unauthorized.");
        }
      }, 1000); // Show error after 1 second if no data and no error
      
      return () => clearTimeout(timer);
    }
  }, [searchId, studentLoading, rawStudent, studentError]);

  // Check for deactivated student account
  useEffect(() => {
    if (rawStudent && rawStudent.account_state === 'Deactivated' && !deactivatedErrorShown) {
      setError("Sorry you can't scan this student, this student is deactivated.");
      setDeactivatedErrorShown(true);
      // Don't clear the search - keep the ID in the input field
    }
  }, [rawStudent, deactivatedErrorShown]);

  // Simplified logic for error and warning handling
  useEffect(() => {
    if (!rawStudent) return;

    console.log('🔍 Student data loaded:', {
      studentName: rawStudent.name,
      accountState: rawStudent.account_state,
      availableSessions: rawStudent.payment?.numberOfSessions || 0,
      selectedWeek,
      attendanceCenter
    });

    // If student is deactivated, always show deactivation error regardless of selectors
    if (rawStudent.account_state === "Deactivated") {
      console.log('❌ Deactivated student detected - showing error message');
      setError("Sorry you can't scan this student, this student is deactivated.");
      console.log('🔧 Error state set to:', "Sorry you can't scan this student, this student is deactivated.");
      return;
    }

    // Check for session availability
    const availableSessions = rawStudent.payment?.numberOfSessions || 0;
    
    // Check if student has any paid lessons for the selected lesson
    const hasPaidLesson = selectedWeek && rawStudent.lessons && rawStudent.lessons[selectedWeek] && rawStudent.lessons[selectedWeek].paid === true;
    
    if (availableSessions <= 0 && !hasPaidLesson) {
      console.log('❌ No sessions available and no paid lesson - showing error message');
      setError("Sorry, this account has used all his available sessions. Please pay again to continue.");
      console.log('🔧 Error state set to:', "Sorry, this account has used all his available sessions. Please pay again to continue.");
      return;
    }

    // For activated students with available sessions, clear any errors
    console.log('✅ Activated student with available sessions - clearing errors');
    setError("");
  }, [rawStudent, selectedWeek, attendanceCenter, searchAttempt]);

  // Check for deactivated account immediately when student data is available
  useEffect(() => {
    if (rawStudent && rawStudent.account_state === 'Deactivated') {
      // Clear any success messages
      setAttendSuccess(false);
      setHwSuccess("");
      setQuizSuccess("");
    }
  }, [rawStudent]);

  // Clear optimistic state when student, week, or center changes
  useEffect(() => {
    setOptimisticHwDone(null);
    setOptimisticAttended(null);
    setNotQuized(false);
    setNoHomework(false);
    setNoQuiz(false);
    setNotCompleted(false);
    setWeekComment(""); // Clear week comment when context changes
    setHomeworkDegree(""); // Clear homework degree inputs when context changes
    // Only clear homeworkDegreeOutOf if there's no remembered value from session storage
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    if (!rememberedHomeworkOutOf) {
    setHomeworkDegreeOutOf("");
    }
    
    // Load current week's comment from student when available
    try {
      const degreeRaw = (student?.quizDegree ?? '').toString().trim();
      const normalized = degreeRaw.toLowerCase().replace(/[''`]/g, '');
    
      const didntAttendTarget = "didnt attend the quiz";
      const noQuizTarget = "no quiz";
    
      setNotQuized(normalized === didntAttendTarget);
      setNoQuiz(normalized === noQuizTarget);
    
      // Sync quiz inputs when value like "15 / 20"
      const match = degreeRaw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      if (match) {
        setQuizDegreeInput(match[1]);
        setQuizDegreeOutOf(match[2]);
      } else if (normalized === didntAttendTarget || normalized === noQuizTarget || degreeRaw === '' || degreeRaw == null) {
        setQuizDegreeInput('');
        // Only clear quizDegreeOutOf if there's no remembered value from session storage
        const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
        if (!rememberedQuizOutOf) {
          setQuizDegreeOutOf('');
        }
      }

      // Sync "No Homework" and "Not Completed" checkboxes with database value
      const hwValue = student?.hwDone;
      setNoHomework(hwValue === "No Homework");
      setNotCompleted(hwValue === "Not Completed");

      // Sync homework degree inputs when value like "15 / 20"
      const homeworkDegreeRaw = (student?.homework_degree ?? '').toString().trim();
      const homeworkMatch = homeworkDegreeRaw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      if (homeworkMatch) {
        setHomeworkDegree(homeworkMatch[1]);
        setHomeworkDegreeOutOf(homeworkMatch[2]);
      } else if (homeworkDegreeRaw === '' || homeworkDegreeRaw == null) {
        setHomeworkDegree('');
        setHomeworkDegreeOutOf('');
      }
    } catch {}    
  }, [student?.id, selectedWeek, attendanceCenter]);

  // Load lesson comment from student data when lesson changes
  useEffect(() => {
    if (student && selectedWeek) {
      const lessonData = getCurrentLessonData(student, selectedWeek);
      if (lessonData && lessonData.comment) {
        setWeekComment(lessonData.comment);
      } else {
        setWeekComment("");
      }
    }
  }, [student, selectedWeek]);

  // Ensure quiz degree "out of" value is loaded from session storage when component mounts
  useEffect(() => {
    const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
    if (rememberedQuizOutOf && !quizDegreeOutOf) {
      setQuizDegreeOutOf(rememberedQuizOutOf);
      console.log('Quiz out of restored from session storage:', rememberedQuizOutOf);
    }
  }, [quizDegreeOutOf]);

  // Ensure homework degree "out of" value is loaded from session storage when component mounts
  useEffect(() => {
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    if (rememberedHomeworkOutOf && !homeworkDegreeOutOf) {
      setHomeworkDegreeOutOf(rememberedHomeworkOutOf);
      console.log('Homework out of restored from session storage:', rememberedHomeworkOutOf);
    }
  }, [homeworkDegreeOutOf]);

  // Auto-attend student when conditions are met (ONLY for QR scans with pre-selected center/week)
  useEffect(() => {
    // Only auto-attend if:
    // 1. Student data is loaded
    // 2. Center and week are selected
    // 3. Student is not already attended
    // 4. We haven't already set optimistic attendance
    // 5. Student was found via QR scan AND center/week were already selected at scan time
    if (student && attendanceCenter && selectedWeek && !student.attended_the_session && optimisticAttended === null && isQRScanned) {
      // Add a small delay to ensure UI is ready
      const timer = setTimeout(() => {
        autoAttendStudent(student.id);
      }, 800); // 800ms delay for better UX
      
      return () => clearTimeout(timer);
    }
  }, [student, attendanceCenter, selectedWeek, optimisticAttended, isQRScanned]);

  // Reset HW optimistic states when attendance becomes false
  useEffect(() => {
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student?.attended_the_session;
    if (currentAttended === false) {
      // If attendance is false, reset other optimistic states to false/null
      setOptimisticHwDone(false);
      
      // Clear quiz degree inputs as well
      setQuizDegreeInput("");
      // Only clear quizDegreeOutOf if there's no remembered value from session storage
      const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
      if (!rememberedQuizOutOf) {
        setQuizDegreeOutOf("");
      }
      // Clear homework degree inputs as well
      setHomeworkDegree("");
      // Only clear homeworkDegreeOutOf if there's no remembered value from session storage
      const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
      if (!rememberedHomeworkOutOf) {
      setHomeworkDegreeOutOf("");
      }
      // Note: Quiz degree in DB will be handled by the backend reset
    }
  }, [optimisticAttended, student?.attended_the_session]);




  const toggleAttendance = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow attendance for deactivated accounts
    
    // Check if student has available sessions or paid lesson
    const availableSessions = student.payment?.numberOfSessions || 0;
    const hasPaidLesson = student.lessons && student.lessons[selectedWeek] && student.lessons[selectedWeek].paid === true;
    
    if (availableSessions <= 0 && !hasPaidLesson) {
      setError("Sorry, this account has used all his available sessions. Please pay again to continue.");
      return;
    }
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    const newAttended = !currentAttended;
    setOptimisticAttended(newAttended);
    // If marking as absent, clear local comment and uncheck all checkboxes immediately to reflect reset
    if (!newAttended) {
      setWeekComment("");
      setNoHomework(false);
      setNotQuized(false);
      setNoQuiz(false);
      setNotCompleted(false);
    }
    
    const lessonName = getLessonName(selectedWeek);
    if (!lessonName) {
      console.error('❌ lessonName is missing — skipping attendance update');
      setError('Please select a valid lesson before marking attendance.');
      return;
    }
    
    let attendanceData;
    if (newAttended) {
      // Mark as attended - create timestamp and center info
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const lastAttendance = `${day}/${month}/${year} in ${attendanceCenter}`;
      
      attendanceData = { 
        attended: true,
        lastAttendance, 
        lastAttendanceCenter: attendanceCenter, 
        attendanceLesson: lessonName 
      };
    } else {
      // Mark as not attended - clear attendance info
      attendanceData = { 
        attended: false,
        lastAttendance: null, 
        lastAttendanceCenter: null, 
        attendanceLesson: lessonName 
      };
    }
    
    console.log('🎯 Scan Page - Toggling attendance:', {
      studentId: student.id,
      studentName: student.name,
      newAttendedState: newAttended,
      lessonName
    });

    toggleAttendanceMutation.mutate({
      id: student.id,
      attendanceData
    }, {
      onSuccess: () => {
        setAttendanceSuccess(newAttended ? '✅ Student Marked as Attended' : '✅ Student Marked as Absent');
        // Clear optimistic state since the mutation succeeded
        setOptimisticAttended(null);
      }
    });
  };

  const toggleHwDone = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow homework updates for deactivated accounts
    
    // Check if student is attended - can't do homework if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before homework can be updated.");
      return;
    }
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : student.hwDone;
    
    // Determine the new homework state based on current state
    let newHwDone;
    if (currentHwDone === true) {
      newHwDone = false; // If done, mark as not done
    } else if (currentHwDone === "No Homework") {
      newHwDone = false; // If no homework, mark as not done
    } else if (currentHwDone === "Not Completed") {
      newHwDone = false; // If not completed, mark as not done
    } else {
      newHwDone = true; // If not done, mark as done
    }
    
    setOptimisticHwDone(newHwDone);
    
    const lessonName = getLessonName(selectedWeek);
    
    updateHomeworkMutation.mutate({
      id: student.id,
      homeworkData: { hwDone: newHwDone, lesson: lessonName }
    }, {
      onSuccess: () => {
        setHwSuccess(newHwDone ? '✅ Homework Marked as Done' : '✅ Homework Marked as Not Done');
        // Clear optimistic state since the mutation succeeded
        setOptimisticHwDone(null);
      }
    });
  };

  

  // Add form handler for quiz degree
  const handleQuizFormSubmit = async (e) => {
    e.preventDefault();
    await handleQuizDegreeSubmit();
  };

  const handleQuizDegreeSubmit = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow quiz updates for deactivated accounts
    
    // Check if student is attended - can't enter quiz if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before quiz degree can be entered.");
      return;
    }
    
    // If both inputs are empty, save null
    if (quizDegreeInput === "" && quizDegreeOutOf === "") {
      const lessonName = getLessonName(selectedWeek);
      updateQuizGradeMutation.mutate(
        {
          id: student.id,
          quizData: { quizDegree: null, lesson: lessonName }
        },
        {
          onSuccess: () => {
            setQuizSuccess('✅ Quiz Degree cleared successfully');
            setNotQuized(false);
          }
        }
      );
      return;
    }
    
    // If only one input is filled, show error
    if (quizDegreeInput === "" || quizDegreeOutOf === "") {
      setError("Please fill both degree and out of fields, or leave both empty to clear.");
      return;
    }
    
    const quizDegreeValue = `${quizDegreeInput} / ${quizDegreeOutOf}`;
    const lessonName = getLessonName(selectedWeek);
    
    updateQuizGradeMutation.mutate(
      {
        id: student.id,
        quizData: { quizDegree: quizDegreeValue, lesson: lessonName }
      },
      {
        onSuccess: () => {
          setQuizSuccess('✅ Quiz Degree set successfully');
          // Ensure the special checkbox is off when a numeric degree is saved
          setNotQuized(false);
        }
      }
    );
    // Do not clear inputs; keep values visible after save
  };

  // Add form handler for homework degree
  const handleHomeworkDegreeFormSubmit = async (e) => {
    e.preventDefault();
    await handleHomeworkDegreeSubmit();
  };

  const handleHomeworkDegreeSubmit = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow homework degree updates for deactivated accounts
    
    // Check if student is attended - can't enter homework degree if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before homework degree can be entered.");
      return;
    }
    
    // If both inputs are empty, save null
    if (homeworkDegree === "" && homeworkDegreeOutOf === "") {
      const lessonName = getLessonName(selectedWeek);
      updateHomeworkDegreeMutation.mutate(
        {
          id: student.id,
          homeworkDegreeData: { homework_degree: null, lesson: lessonName }
        },
        {
          onSuccess: () => {
            setHomeworkDegreeSuccess('✅ Homework Degree cleared successfully');
          }
        }
      );
      return;
    }
    
    // If only one input is filled, show error
    if ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === "")) {
      setError("Please fill both degree and out of fields, or leave both empty to clear.");
      return;
    }
    
    const homeworkDegreeValue = `${homeworkDegree} / ${homeworkDegreeOutOf}`;
    const lessonName = getLessonName(selectedWeek);
    
    updateHomeworkDegreeMutation.mutate(
      {
        id: student.id,
        homeworkDegreeData: { homework_degree: homeworkDegreeValue, lesson: lessonName }
      },
      {
        onSuccess: () => {
          setHomeworkDegreeSuccess('✅ Homework Degree set successfully');
        }
      }
    );
    // Do not clear inputs; keep values visible after save
  };



  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "20px 5px 20px 5px",
    }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
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
        .back-btn {
          background: linear-gradient(90deg, #6c757d 0%, #495057 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .back-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .input-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .manual-input {
          flex: 1;
          padding: 14px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #ffffff;
          color: #000000;
        }
        .manual-input:focus {
          outline: none;
          border-color: #87CEEB;
          background: white;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
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
        .fetch-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2);
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
        .student-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .student-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #495057;
          margin-bottom: 16px;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 12px;
        }
        .student-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 30px;
        }
        
        .student-info .info-item:last-child:nth-child(odd) {
          grid-column: 1 / -1;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #e9ecef;
          border-left: 4px solid #1FA8DC;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }
        .info-item.select-item {
          border-left: 2px solid #e9ecef;
        }
        .info-label {
          font-weight: 700;
          color: #6c757d;
          font-size: 0.85rem;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-value {
          color: #212529;
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .status-badge {
          padding: 8px 16px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: fit-content;
          white-space: nowrap;
        }
        .status-attended {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        .status-not-attended {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
        }
        .status-incomplete {
          background: linear-gradient(135deg, #ffc107 0%, #ffb74d 100%);
          color: #856404;
          border: 1px solid #ffc107;
        }
        .status-no-homework {
          background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          color: white;
        }
        .status-didnt-attend {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white;
        }
        .homework-section {
          display: flex;
          flex-wrap: wrap;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
        .homework-label {
          font-weight: 600;
          color: #6c757d;
          font-size: 13.5px;
        }
        .homework-checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          cursor: pointer;
          color: #6c757d;
          font-size: 13.5px;
        }
        .mark-attended-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 14px 24px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          width: 100%;
        }
        .mark-attended-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }
        .success-message {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-top: 16px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .mark-hw-btn {
          transition: background 0.2s, color 0.2s;
        }
        .select-styled {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          background: #fff;
          color: #222;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-top: 4px;
          box-sizing: border-box;
        }
        .select-styled:focus {
          outline: none;
          border-color: #87CEEB;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
        }
        .quiz-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 0;
          margin-bottom: 0;
          width: 100%;
        }
        .quiz-input {
          width: 40%;
          min-width: 0;
        }
        .quiz-btn {
          width: 20%;
          min-width: 70px;
          padding-left: 0;
          padding-right: 0;
        }
        .quiz-inputs-container {
          display: flex;
          gap: 8px;
          width: 80%;
        }
        @media (max-width: 600px) {
          .quiz-row {
            flex-direction: column;
            gap: 8px;
          }
          .quiz-input, .quiz-btn {
            width: 100%;
          }
          .quiz-inputs-container {
            display: flex;
            gap: 8px;
            width: 100%;
          }
          .quiz-input {
            width: 50%;
          }
        }
        @media (max-width: 768px) {
          .student-info {
            gap: 12px;
          }
          .status-row {
            flex-direction: column;
            gap: 8px;
          }
          .status-badge {
            justify-content: center;
            width: 100%;
          }
          .info-item {
            padding: 16px;
          }
          .info-value {
            font-size: 1rem;
          }
          .input-group {
            flex-direction: column;
            gap: 12px;
          }
          .fetch-btn {
            width: 100%;
            padding: 14px 20px;
            font-size: 0.95rem;
          }
          .manual-input {
            width: 100%;
          }
          .qr-code-btn {
            font-size: 1rem !important;
            padding: 16px 20px !important;
          }
        }
        @media (max-width: 480px) {
          .student-info {
            gap: 10px;
            grid-template-columns: 1fr;
          }
          .info-item {
            padding: 14px;
          }
          .info-label {
            font-size: 0.8rem;
          }
          .info-value {
            font-size: 0.95rem;
          }
          .status-badge {
            font-size: 0.8rem;
            padding: 6px 12px;
          }
          .homework-section {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0 !important;
          }
          .homework-label {
            margin-bottom: 8px;
            font-size: 0.8rem;
          }
          .homework-checkbox-label {
            margin-bottom: 4px;
            font-size: 0.8rem;
          }
          .qr-code-btn {
            font-size: 0.95rem !important;
            padding: 16px !important;
            line-height: 1.3 !important;
          }
        }
        @media (max-width: 360px) {
          .qr-code-btn {
            font-size: 0.9rem !important;
            padding: 14px !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>

             <Title>QR Code Scanner</Title>

      <div className="input-section">
        <form onSubmit={handleManualSubmit} className="input-group">
                  <input
          className="manual-input"
          type="text"
          placeholder="Enter Student ID, Name, Phone Number"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            // Always hide search results when input changes
            setShowSearchResults(false);
            setSearchResults([]);
            
            // Always clear search ID and reset states when input changes
            // This ensures student data disappears when user modifies input
            setSearchId(""); // Clear search ID to prevent auto-fetch
            setIsQRScanned(false); // Reset QR scan flag when input changes
            
            // Clear error and success when input changes
            if (e.target.value !== studentId) {
              setError("");
              setAttendSuccess(false);
            }
          }}
        />
          <button type="submit" className="fetch-btn">
            🔍 Search
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
                <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                  {student.grade} • {student.main_center}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Week and Center Selection - Always visible */}
      <div style={{ 
        background: 'white', 
        borderRadius: 16, 
        padding: 24, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)', 
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Attendance Center */}
          <div>
            <div style={{ 
              fontWeight: 600, 
              color: '#6c757d', 
              fontSize: '0.9rem', 
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Attendance Center
            </div>
            <CenterSelect
              selectedCenter={attendanceCenter}
              onCenterChange={(center) => {
                setAttendanceCenter(center);
                // Remember the selected center
                if (center) {
                  sessionStorage.setItem('lastAttendanceCenter', center);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastAttendanceCenter');
                }
              }}
            />
          </div>
          
          {/* Attendance Week */}
          <div>
            <div style={{ 
              fontWeight: 600, 
              color: '#6c757d', 
              fontSize: '0.9rem', 
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Attendance LESSON
            </div>
            <AttendanceWeekSelect
              selectedWeek={selectedWeek}
              onWeekChange={(week) => {
                console.log('Lesson selected:', week);
                setSelectedWeek(week);
                // Save to session storage
                if (week) {
                  sessionStorage.setItem('lastSelectedLesson', week);
                  console.log('Lesson saved to session storage:', week);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastSelectedLesson');
                  console.log('Lesson removed from session storage');
                }
              }}
              required={true}
            />
          </div>
        </div>
      </div>

      <QRScanner 
        onQRCodeScanned={handleQRCodeScanned}
        onError={handleQRScannerError}
      />

      {/* Warning box when week or center is not selected - for both activated and deactivated accounts */}
      {student && (!selectedWeek || !attendanceCenter) && (
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 50%, #dc3545 100%)',
          color: 'white',
          borderRadius: 20,
          padding: 'clamp(20px, 4vw, 32px) clamp(16px, 3vw, 24px)',
          marginBottom: 32,
          textAlign: 'center',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(220, 53, 69, 0.4), 0 4px 16px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Animated background pattern */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          }} />
          
          {/* Warning icon with enhanced styling */}
          <div style={{ 
            fontSize: 'clamp(32px, 8vw, 48px)', 
            marginBottom: 'clamp(16px, 3vw, 20px)',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          }}>
            ⚠️
          </div>
          
          {/* Main warning text */}
          <div style={{ 
            fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', 
            marginBottom: 'clamp(8px, 2vw, 12px)',
            fontWeight: '700',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            letterSpacing: '0.5px',
            lineHeight: '1.3'
          }}>
            Required Selections Missing
          </div>
          
          {/* Subtitle */}
          <div style={{ 
            fontSize: 'clamp(0.95rem, 3.5vw, 1.1rem)', 
            marginBottom: 'clamp(12px, 2.5vw, 16px)',
            fontWeight: '500',
            opacity: 0.95,
            lineHeight: '1.4',
            padding: '0 clamp(8px, 2vw, 16px)'
          }}>
            Please select both <strong>Lesson</strong> and <strong>Center</strong> to track students correctly
          </div>
          
          {/* Help text */}
          <div style={{ 
            fontSize: 'clamp(0.85rem, 3vw, 0.95rem)', 
            opacity: 0.85,
            fontStyle: 'italic',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(5px)',
            margin: '0 clamp(4px, 1vw, 8px)'
          }}>
            💡 Student data will be shown once you make your selections above
          </div>
        </div>
      )}


      {student && selectedWeek && attendanceCenter && rawStudent?.account_state !== 'Deactivated' && 
       ((rawStudent?.payment?.numberOfSessions || 0) > 0 || 
        (rawStudent?.lessons && rawStudent?.lessons[selectedWeek] && rawStudent?.lessons[selectedWeek].paid === true)) && (
        <div className="student-card">
          <div className="student-name">{student.name}</div>
          
                  
          <div className="student-info">
              {student.grade && (
              <div className="info-item">
                <span className="info-label">Course</span>
                <span className="info-value">{student.grade}</span>
              </div>
              )}
              {student.courseType && (
              <div className="info-item">
                <span className="info-label">Course Type</span>
                <span className="info-value">{student.courseType}</span>
              </div>
              )}
            {student.main_center && (
            <div className="info-item">
              <span className="info-label">Main Center</span>
              <span className="info-value">{student.main_center}</span>
            </div>
            )}
            {student.school && (
            <div className="info-item">
              <span className="info-label">School</span>
              <span className="info-value">{student.school}</span>
            </div>
            )}
            <div className="info-item">
              <span className="info-label">Available Sessions</span>
              <span className="info-value" style={{ 
                color: (rawStudent?.payment?.numberOfSessions || 0) <= 2 ? '#dc3545' : '#212529'
              }}>
                {(rawStudent?.payment?.numberOfSessions || 0)} sessions
              </span>
            </div>
            {student.main_comment && (
            <div className="info-item">
              <span className="info-label">Main Comment</span>
              <span className="info-value">{student.main_comment}</span>
            </div>
            )}
          </div>

          <div className="status-row">
            <span className={`status-badge ${(!attendanceCenter || !selectedWeek) 
              ? 'status-not-attended' 
              : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                ? 'status-attended' 
                : 'status-not-attended'}`}>
              {(!attendanceCenter || !selectedWeek) 
                ? '❌ Absent' 
                : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? '✅ Attended' 
                  : '❌ Absent'}
            </span>
            <span className={`status-badge ${(!attendanceCenter || !selectedWeek)
              ? 'status-not-attended'
              : noHomework || (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === "No Homework"
                ? 'status-no-homework'
                : notCompleted || (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === "Not Completed"
                  ? 'status-incomplete'
                  : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone)
                    ? 'status-attended'
                    : 'status-not-attended'}`}>
              {(!attendanceCenter || !selectedWeek)
                ? '❌ Homework: Not Done'
                : noHomework || (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === "No Homework"
                  ? '🚫 Homework: No Homework'
                  : notCompleted || (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === "Not Completed"
                    ? '⚠️ Homework: Not Completed'
                    : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone)
                      ? `✅ Homework: Done${student.homework_degree ? ` (${student.homework_degree})` : ''}`
                      : '❌ Homework: Not Done'}
            </span>
            
            <span className={`status-badge ${(!attendanceCenter || !selectedWeek) 
              ? 'status-not-attended' 
              : student.quizDegree === "Didn't Attend The Quiz"
                ? 'status-didnt-attend'
                : student.quizDegree === "No Quiz"
                  ? 'status-no-homework'
                  : student.quizDegree 
                    ? 'status-attended' 
                    : 'status-not-attended'}`}>
              {(!attendanceCenter || !selectedWeek) 
                ? '❌ Quiz: ...' 
                : student.quizDegree === "Didn't Attend The Quiz"
                  ? '❌ Quiz: Didn\'t Attend'
                : student.quizDegree === "No Quiz"
                  ? '🚫 Quiz: No Quiz'
                : student.quizDegree 
                  ? `✅ Quiz: ${student.quizDegree}` 
                  : '❌ Quiz: ...'}
            </span>
          </div>

          {/* Show current attendance info if student is attended AND center/week are selected */}
          {(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) && student.lastAttendance && attendanceCenter && selectedWeek && (
            <div className="info-item">
              <div className="info-label">Attendance info:</div>
              <div className="info-value" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {student.lastAttendance}
              </div>
            </div>
          )}
          

          {/* Warning message when week/center not selected */}
          {(!selectedWeek || !attendanceCenter) && (
            <div style={{
              background: 'linear-gradient(135deg, #ffc107 0%, #ffb74d 100%)',
              color: 'white',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 8,
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
              fontSize: '0.9rem'
            }}>
              ⚠️ Please select both a attendance lesson and attendance center to enable tracking attendance
            </div>
          )}

          {/* Simple toggle buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            
            {/* Attendance Toggle Button - Always visible */}
            <button
              className="toggle-btn"
              onClick={toggleAttendance}
              disabled={!attendanceCenter || !selectedWeek || rawStudent?.account_state === 'Deactivated'}
              style={{
                width: '100%',
                background: (!attendanceCenter || !selectedWeek) 
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' // Default "Not Attended" state
                  : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                    ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)' 
                    : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '14px 0',
                cursor: (!attendanceCenter || !selectedWeek) ? 'not-allowed' : 'pointer',
                opacity: (!attendanceCenter || !selectedWeek) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {(!attendanceCenter || !selectedWeek) 
                ? '✅ Mark as Attended' 
                : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? '❌ Mark as Absent' 
                  : '✅ Mark as Attended'}
            </button>

            {/* Homework Status Controls */}
            <div className="homework-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="homework-label">HOMEWORK STATUS :</span>
                <label className="homework-checkbox-label">
              <input
                type="checkbox"
                checked={notCompleted}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setNotCompleted(checked);

                  if (!student || !selectedWeek || !attendanceCenter) {
                    setError('Please select student, lesson and center first.');
                    setNotCompleted(!checked);
                    return;
                  }

                  if (rawStudent?.account_state === 'Deactivated') {
                    setError('Cannot update homework for deactivated student.');
                    setNotCompleted(!checked);
                    return;
                  }

                  const currentAttended =
                    optimisticAttended !== null
                      ? optimisticAttended
                      : student.attended_the_session;

                  if (!currentAttended) {
                    setError('Student must be marked as attended before homework can be updated.');
                    setNotCompleted(!checked);
                    return;
                  }

                  const lessonName = getLessonName(selectedWeek);

                  if (checked) {
                    // Uncheck "No Homework" if it's checked (mutually exclusive)
                    if (noHomework) {
                      setNoHomework(false);
                    }
                    // Clear homework degree inputs when "Not Completed" is selected
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // ✅ Save "Not Completed" to DB
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: "Not Completed", lesson: lessonName },
                    }, {
                      onSuccess: () => {
                        setHwSuccess('✅ Not Completed status set');
                      }
                    });
                    setOptimisticHwDone(false);
                  } else {
                    // ✅ Reset to false when unchecked
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: false, lesson: lessonName },
                    }, {
                      onSuccess: () => {
                        setHwSuccess('✅ Homework status reset');
                      }
                    });
                    setOptimisticHwDone(false);
                  }
                }}
              />
                <span>NOT COMPLETED</span>
              </label>
              </div>
              <label className="homework-checkbox-label">
              <input
                type="checkbox"
                checked={noHomework}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setNoHomework(checked);

                  if (!student || !selectedWeek || !attendanceCenter) {
                    setError('Please select student, lesson and center first.');
                    setNoHomework(!checked);
                    return;
                  }

                  if (rawStudent?.account_state === 'Deactivated') {
                    setError('Cannot update homework for deactivated student.');
                    setNoHomework(!checked);
                    return;
                  }

                  const currentAttended =
                    optimisticAttended !== null
                      ? optimisticAttended
                      : student.attended_the_session;

                  if (!currentAttended) {
                    setError('Student must be marked as attended before homework can be updated.');
                    setNoHomework(!checked);
                    return;
                  }

                  const lessonName = getLessonName(selectedWeek);

                  if (checked) {
                    // Uncheck "Not Completed" if it's checked (mutually exclusive)
                    if (notCompleted) {
                      setNotCompleted(false);
                    }
                    // Clear homework degree inputs when "No Homework" is selected
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // ✅ Save "No Homework" to DB
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: "No Homework", lesson: lessonName },
                    }, {
                      onSuccess: () => {
                        setHwSuccess('✅ No Homework status set');
                      }
                    });
                    setOptimisticHwDone(false);
                  } else {
                    // ✅ Reset to false when unchecked
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: false, lesson: lessonName },
                    }, {
                      onSuccess: () => {
                        setHwSuccess('✅ Homework status reset');
                      }
                    });
                    setOptimisticHwDone(false);
                  }
                }}
              />
                <span>NO HOMEWORK</span>
              </label>
            </div>
            {!noHomework && !notCompleted && (
              <button
                className="toggle-btn"
                onClick={toggleHwDone}
                disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                style={{
                  width: '100%',
                  background: (!attendanceCenter || !selectedWeek)
                    ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                    : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)
                        ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)'
                      : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone)
                        ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)'
                        : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  padding: '14px 0',
                  cursor: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                  opacity: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                {(!attendanceCenter || !selectedWeek)
                  ? '✅ Mark as H.W Done'
                  : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)
                    ? '🚫 Must Attend First'
                    : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone)
                      ? '❌ Mark as H.W Not Done'
                      : '✅ Mark as H.W Done'}
              </button>
            )}

            {/* Homework Degree Input Section - Only show when homework is done */}
            {!noHomework && !notCompleted && (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === true && (
              <div
                className="info-label"
                style={{
                  marginBottom: 0,
                  marginTop: 0,
                  textAlign: 'start',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                  rowGap: 6,
                  columnGap: 12,
                }}
              >
                <span>Homework Degree : (Optional)</span>
                </div>
            )}
            {!noHomework && !notCompleted && (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === true && (
              <form onSubmit={handleHomeworkDegreeFormSubmit} className="quiz-row">
                <div className="quiz-inputs-container">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="manual-input quiz-input"
                    placeholder={
                      (!selectedWeek || !attendanceCenter) ? "Select lesson and center first..." 
                      : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                      : "degree ..."
                    }
                    value={homeworkDegree}
                    onChange={e => setHomeworkDegree(e.target.value)}
                    disabled={updateHomeworkDegreeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                    style={{
                      opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                      cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
                    }}
                  />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="manual-input quiz-input"
                    placeholder={
                      (!selectedWeek || !attendanceCenter) ? "Select lesson and center first..." 
                      : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                      : "out of ..."
                    }
                    value={homeworkDegreeOutOf}
                    onChange={e => {
                      const value = e.target.value;
                      setHomeworkDegreeOutOf(value);
                      // Save to session storage if value is not empty, otherwise remove it
                      if (value.trim() !== '') {
                        sessionStorage.setItem('lastHomeworkOutOf', value);
                        console.log('Homework out of saved to session storage:', value);
                      } else {
                        sessionStorage.removeItem('lastHomeworkOutOf');
                        console.log('Homework out of removed from session storage');
                      }
                    }}
                    disabled={updateHomeworkDegreeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                    style={{
                      opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                      cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                  <button
                    type="submit"
                  className="fetch-btn quiz-btn"
                  disabled={updateHomeworkDegreeMutation.isPending || (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated') || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))}
                    style={{
                    opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))) ? 0.5 : 1,
                    cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  title={
                    !selectedWeek ? 'Please select a lesson first' 
                    : !attendanceCenter ? 'Please select an attendance center first' 
                    : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'Student must attend first'
                    : ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === "")) ? 'Please fill both fields or leave both empty' 
                    : ''
                  }
                >
                  {updateHomeworkDegreeMutation.isPending ? 'Saving...' : 'Save H.W Degree'}
                  </button>
                </form>
            )}

          </div>

          {/* Quiz degree input section */}
          <div
            className="info-label"
            style={{
              marginBottom: 6,
              marginTop: 15,
              textAlign: 'start',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              rowGap: 6,
              columnGap: 12,
            }}
          >
            <span>Quiz Degree :</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={notQuized}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNotQuized(checked);
                  if (checked && noQuiz) {
                    // make them mutually exclusive
                    setNoQuiz(false);
                  }
                  if (checked) {
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, lesson and center first.');
                      setNotQuized(false);
                      return;
                    }

                    if (rawStudent?.account_state === 'Deactivated') {
                      setError('Cannot update quiz for deactivated student.');
                      setNotQuized(false);
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be entered.');
                      setNotQuized(false);
                      return;
                    }
                    // Submit "didn't attend the quiz"
                    const lessonName = getLessonName(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: "Didn't Attend The Quiz", lesson: lessonName }
                      },
                      {
                        onSuccess: () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                          setQuizDegreeInput('');
                          setQuizDegreeOutOf('');
                        }
                      }
                    );
                  } else {
                    // Unchecked: reset quiz degree to null
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, lesson and center first.');
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be updated.');
                      return;
                    }
                    const lessonName = getLessonName(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: null, lesson: lessonName }
                      },
                      {
                        onSuccess: () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                        }
                      }
                    );
                  }
                }}
              />
              <span>didn't attend the quiz</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={noQuiz}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNoQuiz(checked);
                  if (checked && notQuized) {
                    // make them mutually exclusive
                    setNotQuized(false);
                  }
                  if (checked) {
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, lesson and center first.');
                      setNoQuiz(false);
                      return;
                    }

                    if (rawStudent?.account_state === 'Deactivated') {
                      setError('Cannot update quiz for deactivated student.');
                      setNoQuiz(false);
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be entered.');
                      setNoQuiz(false);
                      return;
                    }
                    const lessonName = getLessonName(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: 'No Quiz', lesson: lessonName }
                      },
                      {
                        onSuccess: () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                          setQuizDegreeInput('');
                          setQuizDegreeOutOf('');
                        }
                      }
                    );
                  } else {
                    // Unchecked: reset to null
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, lesson and center first.');
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be updated.');
                      return;
                    }
                    const lessonName = getLessonName(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: null, lesson: lessonName }
                      },
                      {
                        onSuccess: () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                        }
                      }
                    );
                  }
                }}
              />
              <span>No Quiz</span>
            </label>
          </div>
          {!(notQuized || noQuiz) && (
          <form onSubmit={handleQuizFormSubmit} className="quiz-row">
            <div className="quiz-inputs-container">
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select lesson and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "degree ..."
              }
              value={quizDegreeInput}
              onChange={e => setQuizDegreeInput(e.target.value)}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select lesson and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "out of ..."
              }
              value={quizDegreeOutOf}
              onChange={e => {
                const value = e.target.value;
                setQuizDegreeOutOf(value);
                // Save to session storage if value is not empty, otherwise remove it
                if (value.trim() !== '') {
                  sessionStorage.setItem('lastQuizOutOf', value);
                  console.log('Quiz out of saved to session storage:', value);
                } else {
                  sessionStorage.removeItem('lastQuizOutOf');
                  console.log('Quiz out of removed from session storage');
                }
              }}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            </div>
            <button
              type="submit"
              className="fetch-btn quiz-btn"
                  disabled={updateQuizGradeMutation.isPending || (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated') || ((quizDegreeInput === "" && quizDegreeOutOf !== "") || (quizDegreeInput !== "" && quizDegreeOutOf === ""))}
              style={{
                    opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((quizDegreeInput === "" && quizDegreeOutOf !== "") || (quizDegreeInput !== "" && quizDegreeOutOf === ""))) ? 0.5 : 1,
                    cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((quizDegreeInput === "" && quizDegreeOutOf !== "") || (quizDegreeInput !== "" && quizDegreeOutOf === ""))) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              title={
                !selectedWeek ? 'Please select a lesson first' 
                : !attendanceCenter ? 'Please select an attendance center first' 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'Student must attend first'
                    : ((quizDegreeInput === "" && quizDegreeOutOf !== "") || (quizDegreeInput !== "" && quizDegreeOutOf === "")) ? 'Please fill both fields or leave both empty' 
                : ''
              }
            >
              {updateQuizGradeMutation.isPending ? 'Saving...' : 'Save Quiz Degree'}
            </button>
          </form>
          )}
          {/* quiz success shown below the student card */}

          {/* Weekly Comment */}
          <div className="info-label" style={{ marginBottom: 6, marginTop: 10, textAlign: 'start', fontWeight: 600 }}>
          Parent Comment (optional)
          </div>
          <div className="quiz-row" style={{ alignItems: 'stretch' }}>
            <textarea
              className="manual-input"
              placeholder={(!selectedWeek || !attendanceCenter) ? "Select lesson and center first..." : "Write a comment for this student"}
              value={weekComment}
              onChange={(e) => setWeekComment(e.target.value)}
              disabled={!selectedWeek || !attendanceCenter}
              rows={3}
              style={{ width: '100%', resize: 'vertical', opacity: (!selectedWeek || !attendanceCenter) ? 0.5 : 1, cursor: (!selectedWeek || !attendanceCenter) ? 'not-allowed' : 'text' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="fetch-btn"
              onClick={() => {
                if (!student || !selectedWeek || !attendanceCenter) return;
                const lessonName = getLessonName(selectedWeek);
                updateWeekCommentMutation.mutate(
                  { id: student.id, comment: weekComment, lesson: lessonName },
                  {
                    onSuccess: () => {
                      setCommentSuccess('✅ Comment set successfully');
                    }
                  }
                );
              }}
              disabled={!student || !selectedWeek || !attendanceCenter || updateWeekCommentMutation.isPending || rawStudent?.account_state === 'Deactivated'}
              style={{ opacity: (!student || !selectedWeek || !attendanceCenter) ? 0.5 : 1 }}
            >
              {updateWeekCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
            </button>
          </div>
          
          {/* Create QR Code Button - inside student card */}
          <div style={{ marginTop: '16px' }}>
            <button 
              className="submit-btn qr-code-btn" 
              onClick={() => {
                if (student.id) {
                  router.push(`/dashboard/qr_generator?mode=single&id=${student.id}`);
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1rem',
                padding: '14px 20px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(23, 162, 184, 0.3)',
                width: '100%',
                transition: 'all 0.3s ease'
              }}
            >
              🏷️ Create QR Code for this student • ID: {student.id}
            </button>
          </div>
          {/* comment success shown below the student card */}
        </div>
      )}


      {/* Success messages displayed right after the student card */}
      {student && selectedWeek && attendanceCenter && (quizSuccess || commentSuccess || hwSuccess || attendanceSuccess || homeworkDegreeSuccess) && (
        <div style={{ maxWidth: 600, margin: '12px auto 0 auto' }}>
          {quizSuccess && (
            <div className="success-message">
              {quizSuccess}
            </div>
          )}
          {commentSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {commentSuccess}
            </div>
          )}
          {hwSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {hwSuccess}
            </div>
          )}
          {homeworkDegreeSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {homeworkDegreeSuccess}
            </div>
          )}
          {attendanceSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {attendanceSuccess}
            </div>
          )}
        </div>
      )}


      {/* Error message now appears below the student card */}
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
      </div>
    </div>
  );
}