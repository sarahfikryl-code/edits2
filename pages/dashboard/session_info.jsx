import { useEffect, useState, useRef, useMemo } from 'react';
import CenterSelect from '../../components/CenterSelect';
import CourseTypeSelect from '../../components/CourseTypeSelect';
import AttendanceWeekSelect from '../../components/AttendancelessonSelect';
import { SessionTable } from '../../components/SessionTable.jsx';
import Title from '../../components/Title';
import { IconArrowDownRight, IconArrowUpRight, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { Center, Group, Paper, RingProgress, SimpleGrid, Text } from '@mantine/core';
import { useRouter } from 'next/router';
import { useStudents } from '../../lib/api/students';
import LoadingSkeleton from '../../components/LoadingSkeleton';

export default function SessionInfo() {
  const containerRef = useRef(null);
  const router = useRouter();
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedCourseType, setSelectedCourseType] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('');
  const [filtered, setFiltered] = useState(null);
  const [showHW, setShowHW] = useState(false);
  
  const [showQuiz, setShowQuiz] = useState(false);
  const [showComment, setShowComment] = useState(false); // legacy toggle: both main + week for attended table
  const [showMainComment, setShowMainComment] = useState(false);
  const [showWeekComment, setShowWeekComment] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'courseType', 'center', 'week', or null
  
  // Pagination state for each table
  const [attendedPage, setAttendedPage] = useState(1);
  const [absencesPage, setAbsencesPage] = useState(1);
  const [aiacPage, setAiacPage] = useState(1);
  const [showAttendedPagePopup, setShowAttendedPagePopup] = useState(false);
  const [showAbsencesPagePopup, setShowAbsencesPagePopup] = useState(false);
  const [showAiacPagePopup, setShowAiacPagePopup] = useState(false);
  
  const pageSize = 50; // 50 students per page

  // React Query hook with real-time updates - 5 second polling like history page
  const { data: students = [], isLoading, error, refetch, isRefetching, dataUpdatedAt } = useStudents({}, {
    // Aggressive real-time settings for immediate updates
    refetchInterval: 5 * 1000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for only 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
  });

  // Require all filters to be selected to show any data
  const allFiltersSelected = !!(selectedCenter && selectedCourseType && selectedWeek);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle message state updates (simplified - SessionTable handles the local state)
  const handleMessageStateChange = (studentId, messageState) => {
    console.log('Message state changed for student:', studentId, 'to:', messageState);
    // SessionTable now handles the local state directly, so this is just for logging
  };



  useEffect(() => {
    // Listen for manual refresh events
    const handleRefresh = () => {
      refetch();
    };
    window.addEventListener('refreshStudents', handleRefresh);
    
    return () => {
      window.removeEventListener('refreshStudents', handleRefresh);
    };
  }, [refetch]);

  // Debug: Log React Query status for session info
  useEffect(() => {
    console.log('Session Info React Query Status:', {
      isLoading,
      isRefetching,
      dataUpdatedAt: new Date(dataUpdatedAt).toLocaleTimeString(),
      studentsCount: students.length,
      timestamp: new Date().toLocaleTimeString()
    });
  }, [isLoading, isRefetching, dataUpdatedAt, students.length]);

  // No need for complex state merging - SessionTable handles message states locally

  // Load remembered values from sessionStorage on component mount
  useEffect(() => {
    const rememberedCenter = sessionStorage.getItem('sessionInfoLastSelectedCenter');
    const rememberedCourseType = sessionStorage.getItem('sessionInfoLastSelectedCourseType');
    const rememberedWeek = sessionStorage.getItem('sessionInfoLastSelectedWeek');
    
    if (rememberedCenter) setSelectedCenter(rememberedCenter);
    if (rememberedCourseType) setSelectedCourseType(rememberedCourseType);
    if (rememberedWeek) setSelectedWeek(rememberedWeek);
  }, []);

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

    // Also handle when a dropdown opens to close others
    const handleDropdownOpen = () => {
      // Close any open dropdowns when a new one opens
      if (openDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleDropdownOpen);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleDropdownOpen);
    };
  }, [openDropdown]);


  // Filtering logic
  const handleFilterFormSubmit = (e) => {
    e.preventDefault();
    handleFilter();
  };

  const handleFilter = () => {
    if (!allFiltersSelected) {
      setFiltered([]);
      return;
    }
    let filteredList = students;
    // Filter by course type - handle cases where courseType might be null/undefined
    if (selectedCourseType) {
      filteredList = filteredList.filter(s => {
        // If student has no courseType set, include them (for backward compatibility)
        if (!s.courseType) return true;
        // If student has courseType, match it
        return s.courseType.toLowerCase() === selectedCourseType.toLowerCase();
      });
    }
    // Filter out deactivated students
    filteredList = filteredList.filter(s => s.account_state !== 'Deactivated');
    setFiltered(filteredList);
  };

  // Trigger filtering when students data or filters change
  useEffect(() => {
    handleFilter();
  }, [students, selectedCenter, selectedCourseType, selectedWeek]);

  // Helper function to get lesson name from selection string
  const getLessonName = (lessonString) => {
    if (!lessonString) return null;
    return lessonString; // Already contains the lesson name
  };

  // Helper function to get student data for specific lesson
  const getStudentLessonData = (student, lessonName) => {
    if (!lessonName) return student;
    let lessonData;
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessonData = student.lessons[lessonName];
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessonData = student.lessons.find(l => l && l.lesson === lessonName);
    }
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
        message_state: false,
        student_message_state: false,
        parent_message_state: false,
        currentLessonName: lessonName
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
      message_state: lessonData.message_state,
      student_message_state: lessonData.student_message_state ?? false,
      parent_message_state: lessonData.parent_message_state ?? false,
      currentLessonName: lessonName
    };
  };

  const dataToCount = allFiltersSelected ? (filtered !== null ? filtered : students) : [];

  // Helper function to check if student attended in specific lesson
  const didStudentAttendInLesson = (student, lessonName) => {
    if (!lessonName) return false;
    let lessonData;
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessonData = student.lessons[lessonName];
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessonData = student.lessons.find(l => l && l.lesson === lessonName);
    }
    return lessonData && lessonData.attended;
  };

  // Helper function to check if student attended in specific center in specific lesson
  const didStudentAttendInCenterInLesson = (student, center, lessonName) => {
    if (!lessonName || !center) return false;
    let lessonData;
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessonData = student.lessons[lessonName];
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessonData = student.lessons.find(l => l && l.lesson === lessonName);
    }
    return lessonData && lessonData.attended && lessonData.lastAttendanceCenter && lessonData.lastAttendanceCenter.toLowerCase() === center.toLowerCase();
  };

  // Current selected lesson name
  const selectedLessonName = selectedWeek || null;

  // Counts based on lesson selection
  const getAllLessonsArray = (s) => {
    if (s.lessons && typeof s.lessons === 'object' && !Array.isArray(s.lessons)) return Object.values(s.lessons);
    if (s.lessons && Array.isArray(s.lessons)) return s.lessons;
    return [];
  };

  const attendedCount = selectedLessonName ?
    dataToCount.filter(s => didStudentAttendInLesson(s, selectedLessonName)).length :
    dataToCount.filter(s => getAllLessonsArray(s).some(l => l && l.attended)).length;
  
  const notAttendedCount = selectedLessonName ?
    dataToCount.filter(s => !didStudentAttendInLesson(s, selectedLessonName)).length :
    dataToCount.filter(s => !getAllLessonsArray(s).some(l => l && l.attended)).length;
  
  const hwDoneCount = selectedLessonName ?
    dataToCount.filter(s => {
      const d = getStudentLessonData(s, selectedLessonName);
      return d && d.hwDone === true;
    }).length :
    dataToCount.filter(s => getAllLessonsArray(s).some(l => l && l.hwDone === true)).length;
  
  const hwNotDoneCount = selectedLessonName ?
    dataToCount.filter(s => {
      const d = getStudentLessonData(s, selectedLessonName);
      return d && d.attended_the_session === true && d.hwDone === false;
    }).length :
    dataToCount.filter(s => getAllLessonsArray(s).some(l => l && l.attended === true && l.hwDone === false)).length;

  // (Optional legacy center count left out since UI doesn't use it directly)

  const centerCounts = {};
  dataToCount.forEach(s => {
    if (s.lessons && typeof s.lessons === 'object' && !Array.isArray(s.lessons)) {
      Object.values(s.lessons).forEach(lesson => {
        if (lesson && lesson.lastAttendanceCenter) {
          // If lesson is selected, only count that lesson
          if (selectedLessonName && lesson.lesson !== selectedLessonName) return;
          centerCounts[lesson.lastAttendanceCenter] = (centerCounts[lesson.lastAttendanceCenter] || 0) + 1;
        }
      });
    }
  });

  // --- CORRECTED METRICS LOGIC ---
  // MC: Main Center - Students who attended in selected center AND have main center = selected center
  const MC = dataToCount.filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // Student's main center must match selected center
    const centerMatch = s.main_center && s.main_center.toLowerCase() === selectedCenter.toLowerCase();
    
    if (!centerMatch) return false;
    
    // If lesson is selected, check if student attended that specific lesson in the selected center
    if (selectedLessonName) {
      return didStudentAttendInCenterInLesson(s, selectedCenter, selectedLessonName);
    } else {
      // If no lesson selected, check if student attended any lesson in the selected center
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return Array.isArray(lessons) ? lessons.some(l => l && l.attended && l.lastAttendanceCenter && l.lastAttendanceCenter.toLowerCase() === selectedCenter.toLowerCase()) : false;
    }
  }).length;

  // NAMC: Not Attended but Main Center (in specific lesson if selected)
  // CORRECTED LOGIC: Students with matching center and course type who did NOT attend the selected lesson
  const NAMC_students = allFiltersSelected ? dataToCount.filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // Student's main center must match selected center
    const centerMatch = s.main_center && s.main_center.toLowerCase() === selectedCenter.toLowerCase();
    
    if (!centerMatch) return false;
    
    // If lesson is selected, check if student did NOT attend that specific lesson
    if (selectedLessonName) {
      return !didStudentAttendInLesson(s, selectedLessonName);
    } else {
      // If no lesson selected, check if student never attended any lesson
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return !(Array.isArray(lessons) && lessons.some(l => l && l.attended));
    }
  }) : [];
  const NAMC = NAMC_students.length;
  const NAMC_ids = NAMC_students.map(s => s.id).join(', ');

  // Main Center denominator: all students with main_center === selectedCenter and courseType === selectedCourseType (regardless of attendance)
  const mainCenterTotal = allFiltersSelected ? dataToCount.filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    return s.main_center && s.main_center.toLowerCase() === selectedCenter.toLowerCase();
  }).length : 0;

  // NMC: Not Main Center - Students who attended in selected center BUT have main center != selected center
  const NMC = dataToCount.filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // Student's main center must NOT match selected center
    const centerNotMatch = !s.main_center || s.main_center.toLowerCase() !== selectedCenter.toLowerCase();
    
    if (!centerNotMatch) return false;
    
    // If lesson is selected, check if student attended that specific lesson in the selected center
    if (selectedLessonName) {
      return didStudentAttendInCenterInLesson(s, selectedCenter, selectedLessonName);
    } else {
      // If no lesson selected, check if student attended any lesson in the selected center
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return Array.isArray(lessons) ? lessons.some(l => l && l.attended && l.lastAttendanceCenter && l.lastAttendanceCenter.toLowerCase() === selectedCenter.toLowerCase()) : false;
    }
  }).length;

  // Total Attended: MC + NMC
  const totalAttended = MC + NMC;

  // MC percent (show as MC / mainCenterTotal and percent)
  const MC_percent = mainCenterTotal > 0 ? Math.round((MC / mainCenterTotal) * 100) : 0;

  // FIRST TABLE: Attendance table - Show all students who attended in selected center regardless of their main center
  let filteredStudents = (allFiltersSelected ? (filtered !== null ? filtered : students) : []).filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Exclude deactivated students
    if (s.account_state === 'Deactivated') return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // If lesson is selected, check if student attended that specific lesson in the selected center
    if (selectedLessonName) {
      return didStudentAttendInCenterInLesson(s, selectedCenter, selectedLessonName);
    } else {
      // If no lesson selected, show students who attended any lesson in the selected center
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return Array.isArray(lessons) ? lessons.some(l => l && l.attended && l.lastAttendanceCenter && l.lastAttendanceCenter.toLowerCase() === selectedCenter.toLowerCase()) : false;
    }
  });

  // If a specific lesson is selected, update the student data to show that lesson's information
  if (selectedLessonName) {
    filteredStudents = filteredStudents.map(student => getStudentLessonData(student, selectedLessonName));
  }

  // SECOND TABLE: Main center but absent - Show students with main center = selected center who did NOT attend
  const notAttendedStudents = (allFiltersSelected ? (filtered !== null ? filtered : students) : []).filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Exclude deactivated students
    if (s.account_state === 'Deactivated') return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // Student's main center must match selected center
    const centerMatch = s.main_center && s.main_center.toLowerCase() === selectedCenter.toLowerCase();
    
    if (!centerMatch) return false;
    
    // If lesson is selected, check if student did NOT attend that specific lesson
    if (selectedLessonName) {
      return !didStudentAttendInLesson(s, selectedLessonName);
    } else {
      // If no lesson selected, show students who never attended any lesson
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return !(Array.isArray(lessons) && lessons.some(l => l && l.attended));
    }
  });

  // Update not attended students with lesson data if selected
  if (selectedLessonName) {
    notAttendedStudents.forEach(student => {
      Object.assign(student, getStudentLessonData(student, selectedLessonName));
    });
  }

  // Pagination helper function
  const getPaginationInfo = (totalItems, currentPage, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;
    
    return {
      totalPages,
      startIndex,
      endIndex,
      hasNextPage,
      hasPrevPage,
      currentPage,
      totalCount: totalItems
    };
  };

  // Pagination for attended students (first table)
  const attendedPagination = getPaginationInfo(filteredStudents.length, attendedPage, pageSize);
  const paginatedAttendedStudents = filteredStudents.slice(attendedPagination.startIndex, attendedPagination.endIndex);

  // Pagination for absences students (second table)
  const absencesPagination = getPaginationInfo(notAttendedStudents.length, absencesPage, pageSize);
  const paginatedAbsencesStudents = notAttendedStudents.slice(absencesPagination.startIndex, absencesPagination.endIndex);

  // Pagination for AIAC students (third table)
  const aiacPagination = getPaginationInfo(aiacStudents.length, aiacPage, pageSize);
  const paginatedAiacStudents = aiacStudents.slice(aiacPagination.startIndex, aiacPagination.endIndex);

  // Reset pagination when filters change
  useEffect(() => {
    setAttendedPage(1);
    setAbsencesPage(1);
    setAiacPage(1);
  }, [selectedCenter, selectedCourseType, selectedWeek]);

  // Pagination handlers for attended table
  const handleAttendedPageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= attendedPagination.totalPages) {
      setAttendedPage(pageNumber);
      setShowAttendedPagePopup(false);
    }
  };

  const handleAttendedPrevPage = () => {
    if (attendedPagination.hasPrevPage) {
      setAttendedPage(prev => Math.max(1, prev - 1));
    }
  };

  const handleAttendedNextPage = () => {
    if (attendedPagination.hasNextPage) {
      setAttendedPage(prev => prev + 1);
    }
  };

  // Pagination handlers for absences table
  const handleAbsencesPageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= absencesPagination.totalPages) {
      setAbsencesPage(pageNumber);
      setShowAbsencesPagePopup(false);
    }
  };

  const handleAbsencesPrevPage = () => {
    if (absencesPagination.hasPrevPage) {
      setAbsencesPage(prev => Math.max(1, prev - 1));
    }
  };

  const handleAbsencesNextPage = () => {
    if (absencesPagination.hasNextPage) {
      setAbsencesPage(prev => prev + 1);
    }
  };

  // Pagination handlers for AIAC table
  const handleAiacPageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= aiacPagination.totalPages) {
      setAiacPage(pageNumber);
      setShowAiacPagePopup(false);
    }
  };

  const handleAiacPrevPage = () => {
    if (aiacPagination.hasPrevPage) {
      setAiacPage(prev => Math.max(1, prev - 1));
    }
  };

  const handleAiacNextPage = () => {
    if (aiacPagination.hasNextPage) {
      setAiacPage(prev => prev + 1);
    }
  };

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAttendedPagePopup && !event.target.closest('.pagination-page-info-attended') && !event.target.closest('.page-popup-attended')) {
        setShowAttendedPagePopup(false);
      }
      if (showAbsencesPagePopup && !event.target.closest('.pagination-page-info-absences') && !event.target.closest('.page-popup-absences')) {
        setShowAbsencesPagePopup(false);
      }
      if (showAiacPagePopup && !event.target.closest('.pagination-page-info-aiac') && !event.target.closest('.page-popup-aiac')) {
        setShowAiacPagePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttendedPagePopup, showAbsencesPagePopup, showAiacPagePopup]);

  // THIRD TABLE: AIAC (Attended in Another Center) - Show students with main center = selected center but attended elsewhere
  const aiacStudents = (allFiltersSelected ? (filtered !== null ? filtered : students) : []).filter(s => {
    if (!selectedCenter || !selectedCourseType) return false;
    
    // Exclude deactivated students
    if (s.account_state === 'Deactivated') return false;
    
    // Filter by course type - include students without courseType for backward compatibility
    if (s.courseType && s.courseType.toLowerCase() !== selectedCourseType.toLowerCase()) {
      return false;
    }
    
    // Student's main center must match selected center
    const centerMatch = s.main_center && s.main_center.toLowerCase() === selectedCenter.toLowerCase();
    
    if (!centerMatch) return false;
    
    // If lesson is selected, check if student attended that specific lesson but in a different center
    if (selectedLessonName) {
      const d = getStudentLessonData(s, selectedLessonName);
      return d && d.attended_the_session === true && d.lastAttendanceCenter && d.lastAttendanceCenter.toLowerCase() !== selectedCenter.toLowerCase();
    } else {
      // If no lesson selected, show students who attended any lesson but in a different center
      const lessons = (s.lessons && typeof s.lessons === 'object') ? Object.values(s.lessons) : [];
      return Array.isArray(lessons) ? lessons.some(l => l && l.attended && l.lastAttendanceCenter && l.lastAttendanceCenter.toLowerCase() !== selectedCenter.toLowerCase()) : false;
    }
  });

  // Update AIAC students with week data
  if (selectedLessonName) {
    aiacStudents.forEach(student => {
      Object.assign(student, getStudentLessonData(student, selectedLessonName));
    });
  }

  return (
    <div style={{ minHeight: '100vh', padding: '20px 5px 20px 5px' }}>
              <div ref={containerRef} style={{ maxWidth: 600, margin: '20px auto', padding: 24 }}>
        <style jsx>{`
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 24px;
            text-align: center;
          }
          .counts-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            margin-bottom: 24px;
            display: flex;
            flex-wrap: wrap;
            justify-content: space-around;
            gap: 32px 12px;
            color: #000000;
          }
          .circle-metric {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 140px;
            margin-bottom: 12px;
            color: #000000;
          }
          .circle-label {
            font-weight: 600;
            color: #495057;
            margin-top: 12px;
            margin-bottom: 2px;
            font-size: 1.1rem;
          }
          .circle-count {
            color: #222;
            font-size: 1rem;
            margin-top: 2px;
          }
          .circle {
            width: 100px;
            height: 100px;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .circle svg {
            transform: rotate(-90deg);
          }
          .circle-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.3rem;
            font-weight: 700;
            color: #000000;
          }
          .center-list {
            margin-top: 16px;
          }
          .center-item {
            font-size: 1rem;
            margin-bottom: 6px;
            color: #000000;
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .filter-section {
            background: #fff;
            border-radius: 12px;
            padding: 18px 18px 10px 18px;
            margin-bottom: 24px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.07);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .filter-label {
            font-weight: 600;
            color: #495057;
            margin-bottom: 4px;
          }
          .filter-select {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            background: #fff;
            color: #222;
            margin-bottom: 8px;
          }
          .filter-btn {
            width: 100%;
            padding: 10px 2px;
            background: linear-gradient(90deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            letter-spacing: 1px;
            box-shadow: 0 2px 8px rgba(135, 206, 235, 0.2);
            cursor: pointer;
            transition: background 0.2s, transform 0.2s;
          }
          .filter-btn:hover {
            background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
            transform: translateY(-2px) scale(1.03);
          }
          .table-toggle-btn {
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(40, 167, 69, 0.2);
          }
          .table-toggle-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
          }
          .table-toggle-btn.active {
            background: #dc3545;
            box-shadow: 0 2px 8px rgba(220, 53, 69, 0.2);
          }
          .table-toggle-btn.active:hover {
            background: #c82333;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
          }
          .week-info {
            background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(23, 162, 184, 0.3);
          }
          
          @media (max-width: 768px) {
            .filter-section {
              padding: 16px;
            }
            .filter-btn {
              padding: 14px 2px;
              font-size: 1.1rem;
            }
            .table-toggle-btn {
              padding: 8px 14px;
              font-size: 0.95rem;
            }
            .circle {
              width: 80px;
              height: 80px;
            }
            .circle-text {
              font-size: 1.1rem;
            }
          }
          
          @media (max-width: 480px) {
            .filter-section {
              padding: 12px;
            }
            .filter-select {
              padding: 8px 10px;
              font-size: 0.95rem;
            }
            .filter-btn {
              padding: 12px 2px;
              font-size: 1rem;
            }
            .table-toggle-btn {
              padding: 6px 12px;
              font-size: 0.9rem;
            }
            .circle {
              width: 70px;
              height: 70px;
            }
            .circle-text {
              font-size: 1rem;
            }
          }
          
          /* Pagination Styles */
          .pagination-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 2px solid #e9ecef;
          }
          
          .pagination-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: 2px solid #1FA8DC;
            background: white;
            color: #1FA8DC;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(31, 168, 220, 0.1);
          }
          
          .pagination-button:hover:not(:disabled) {
            background: #1FA8DC;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(31, 168, 220, 0.3);
          }
          
          .pagination-button:active:not(:disabled) {
            transform: translateY(0);
          }
          
          .pagination-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            border-color: #adb5bd;
            color: #adb5bd;
            box-shadow: none;
          }
          
          .pagination-page-info {
            font-size: 1.1rem;
            font-weight: 600;
            color: #495057;
            min-width: 120px;
            text-align: center;
            padding: 8px 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
          }
          
          .pagination-page-info.clickable:hover {
            background: #e9ecef;
            border-color: #1FA8DC;
            transform: translateY(-1px);
          }
          
          .page-popup {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 8px;
            z-index: 10000;
          }
          
          .page-popup-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            border: 2px solid #1FA8DC;
            padding: 16px;
            min-width: 300px;
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
          }
          
          .page-popup-header {
            font-size: 1.1rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 12px;
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
          }
          
          .page-popup-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 8px;
            max-height: 300px;
            overflow-y: auto;
          }
          
          .page-number-btn {
            padding: 10px;
            border: 2px solid #e9ecef;
            background: white;
            color: #495057;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s ease;
          }
          
          .page-number-btn:hover {
            background: #1FA8DC;
            color: white;
            border-color: #1FA8DC;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(31, 168, 220, 0.3);
          }
          
          .page-number-btn.active {
            background: #1FA8DC;
            color: white;
            border-color: #1FA8DC;
            font-weight: 700;
          }
          
          @media (max-width: 480px) {
            .pagination-container {
              gap: 12px;
              margin-top: 20px;
              padding-top: 20px;
            }
            
            .pagination-button {
              width: 40px;
              height: 40px;
            }
            
            .pagination-page-info {
              font-size: 1rem;
              min-width: 100px;
              padding: 6px 12px;
            }
            
            .page-popup {
              left: 50%;
              right: auto;
              width: calc(100vw - 40px);
              max-width: 400px;
            }
            
            .page-popup-content {
              min-width: auto;
              max-width: 100%;
              padding: 12px;
              max-height: 300px;
            }
            
            .page-popup-header {
              font-size: 1rem;
              margin-bottom: 10px;
              padding-bottom: 6px;
            }
            
            .page-popup-grid {
              grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
              gap: 6px;
              max-height: 250px;
            }
            
            .page-number-btn {
              padding: 8px;
              font-size: 0.85rem;
            }
          }
          
          @media (max-width: 360px) {
            .page-popup {
              width: calc(100vw - 20px);
            }
            
            .page-popup-grid {
              grid-template-columns: repeat(auto-fill, minmax(35px, 1fr));
              gap: 5px;
            }
            
            .page-number-btn {
              padding: 6px;
              font-size: 0.8rem;
            }
          }
        `}</style>
        <Title>Session Info</Title>
        {error && <div className="error-message">❌ {error}</div>}
        
        {/* Show lesson info if lesson is selected */}
        {selectedWeek && (
          <div className="week-info">
            📚 Showing data for {selectedWeek} - {selectedCenter} - {selectedCourseType}
          </div>
        )}
        
        <form onSubmit={handleFilterFormSubmit} className="filter-section">
          <div className="filter-label">Center</div>
          <CenterSelect
            selectedCenter={selectedCenter}
            onCenterChange={(center) => {
              setSelectedCenter(center);
              if (center) {
                sessionStorage.setItem('sessionInfoLastSelectedCenter', center);
              } else {
                // Clear selection - remove from sessionStorage
                sessionStorage.removeItem('sessionInfoLastSelectedCenter');
              }
            }}
            isOpen={openDropdown === 'center'}
            onToggle={() => setOpenDropdown(openDropdown === 'center' ? null : 'center')}
            onClose={() => setOpenDropdown(null)}
          />
          <div className="filter-label">Course Type</div>
          <CourseTypeSelect
            selectedCourseType={selectedCourseType}
            onCourseTypeChange={(courseType) => {
              setSelectedCourseType(courseType);
              if (courseType) {
                sessionStorage.setItem('sessionInfoLastSelectedCourseType', courseType);
              } else {
                // Clear selection - remove from sessionStorage
                sessionStorage.removeItem('sessionInfoLastSelectedCourseType');
              }
            }}
            isOpen={openDropdown === 'courseType'}
            onToggle={() => setOpenDropdown(openDropdown === 'courseType' ? null : 'courseType')}
            onClose={() => setOpenDropdown(null)}
            required={true}
          />
          <div className="filter-label">Lesson</div>
          <AttendanceWeekSelect
            selectedWeek={selectedWeek}
            onWeekChange={(week) => {
              setSelectedWeek(week);
              if (week) {
                sessionStorage.setItem('sessionInfoLastSelectedWeek', week);
              } else {
                // Clear selection - remove from sessionStorage
                sessionStorage.removeItem('sessionInfoLastSelectedWeek');
              }
            }}
            isOpen={openDropdown === 'week'}
            onToggle={() => setOpenDropdown(openDropdown === 'week' ? null : 'week')}
            onClose={() => setOpenDropdown(null)}
            required={true}
          />
          <button type="submit" className="filter-btn">Filter Students</button>
        </form>

        <StatsRing MC={MC} NMC={NMC} totalAttended={totalAttended} mainCenterTotal={mainCenterTotal} selectedWeek={selectedWeek} />
        
        {/* Table toggles and table */}
        <div className="table-container" style={{ margin: '24px 0', background: '#fff', borderRadius: 12, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className={`table-toggle-btn ${showHW ? 'active' : ''}`}
              onClick={() => setShowHW(v => !v)}
            >
              {showHW ? 'Hide HW' : 'Show HW'}
            </button>
            
            <button
              className={`table-toggle-btn ${showQuiz ? 'active' : ''}`}
              onClick={() => setShowQuiz(v => !v)}
            >
              {showQuiz ? 'Hide Quiz Degree' : 'Show Quiz Degree'}
            </button>
            <button
              className={`table-toggle-btn ${(showComment || showMainComment) ? 'active' : ''}`}
              onClick={() => {
                // legacy button toggles BOTH main+week for attended table
                setShowComment(v => !v);
                setShowMainComment(v => !v);
                setShowWeekComment(v => !v);
              }}
            >
              {(showComment || showMainComment || showWeekComment) ? 'Hide Comments' : 'Show Comments'}
            </button>
          </div>
          <SessionTable
            data={paginatedAttendedStudents}
            showHW={showHW}
            showGrade={true}
            showSchool={true}
            showQuiz={showQuiz}
            showComment={false}
            showMainComment={showComment || showMainComment}
            showWeekComment={showComment || showWeekComment}
            height={300}
            showWhatsApp={true}
            showAvailableSessions={true}
            lesson={selectedWeek}
            emptyMessage={selectedWeek ? 
              `No students attended ${selectedWeek} in ${selectedCenter}.` :
              `No students found for selected center.`
            }
            onMessageStateChange={handleMessageStateChange}
          />
          
          {/* Pagination for Attended Students Table */}
          {filteredStudents.length > 0 && (
            <div className="pagination-container">
              <button
                className="pagination-button"
                onClick={handleAttendedPrevPage}
                disabled={!attendedPagination.hasPrevPage}
                aria-label="Previous page"
              >
                <IconChevronLeft size={20} stroke={2} />
              </button>
              
              <div 
                className={`pagination-page-info pagination-page-info-attended ${attendedPagination.totalPages > 1 ? 'clickable' : ''}`}
                onClick={() => attendedPagination.totalPages > 1 && setShowAttendedPagePopup(!showAttendedPagePopup)}
                style={{ position: 'relative', cursor: attendedPagination.totalPages > 1 ? 'pointer' : 'default', zIndex: 9999 }}
              >
                Page {attendedPagination.currentPage} of {attendedPagination.totalPages}
                
                {/* Page Number Popup */}
                {showAttendedPagePopup && attendedPagination.totalPages > 1 && (
                  <div className="page-popup page-popup-attended" style={{ zIndex: 10000 }}>
                    <div className="page-popup-content">
                      <div className="page-popup-header">Select Page</div>
                      <div className="page-popup-grid">
                        {Array.from({ length: attendedPagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            className={`page-number-btn ${pageNum === attendedPagination.currentPage ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAttendedPageClick(pageNum);
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                className="pagination-button"
                onClick={handleAttendedNextPage}
                disabled={!attendedPagination.hasNextPage}
                aria-label="Next page"
              >
                <IconChevronRight size={20} stroke={2} />
              </button>
            </div>
          )}
        </div>
        
        {/* Second table: Not attended, grade and main_center match selection */}
        <div className="table-container" style={{ margin: '24px 0', background: '#fff', borderRadius: 12, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, textAlign: 'center', color: '#000' }}>
          {selectedWeek ? `Absent Students in ${selectedWeek} - ${selectedCenter} (${notAttendedStudents.length} records)` : `Absent Students - ${selectedCenter} (${notAttendedStudents.length} records)`}
          </div>
          <SessionTable
            data={paginatedAbsencesStudents}
            height={300}
            showMainCenter={false}
            showGrade={true}
            showSchool={true}
            showComment={false}
            showMainComment={true}
            showWeekComment={true}
            showWhatsApp={true}
            showAvailableSessions={true}
            lesson={selectedWeek}
            emptyMessage={selectedWeek ? 
              `All students attended ${selectedWeek} in ${selectedCenter}.` :
              `No absent students found for selected center.`
            }
            onMessageStateChange={handleMessageStateChange}
          />
          
          {/* Pagination for Absences Students Table */}
          {notAttendedStudents.length > 0 && (
            <div className="pagination-container">
              <button
                className="pagination-button"
                onClick={handleAbsencesPrevPage}
                disabled={!absencesPagination.hasPrevPage}
                aria-label="Previous page"
              >
                <IconChevronLeft size={20} stroke={2} />
              </button>
              
              <div 
                className={`pagination-page-info pagination-page-info-absences ${absencesPagination.totalPages > 1 ? 'clickable' : ''}`}
                onClick={() => absencesPagination.totalPages > 1 && setShowAbsencesPagePopup(!showAbsencesPagePopup)}
                style={{ position: 'relative', cursor: absencesPagination.totalPages > 1 ? 'pointer' : 'default', zIndex: 9999 }}
              >
                Page {absencesPagination.currentPage} of {absencesPagination.totalPages}
                
                {/* Page Number Popup */}
                {showAbsencesPagePopup && absencesPagination.totalPages > 1 && (
                  <div className="page-popup page-popup-absences" style={{ zIndex: 10000 }}>
                    <div className="page-popup-content">
                      <div className="page-popup-header">Select Page</div>
                      <div className="page-popup-grid">
                        {Array.from({ length: absencesPagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            className={`page-number-btn ${pageNum === absencesPagination.currentPage ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbsencesPageClick(pageNum);
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                className="pagination-button"
                onClick={handleAbsencesNextPage}
                disabled={!absencesPagination.hasNextPage}
                aria-label="Next page"
              >
                <IconChevronRight size={20} stroke={2} />
              </button>
            </div>
          )}
        </div>
        
        {/* AIAC: Attended in Another Center Table */}
        <div className="table-container" style={{ margin: '24px 0', background: '#fff', borderRadius: 12, padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, textAlign: 'center', color: '#000' }}>
            {selectedWeek ? `Attended in another center in ${selectedWeek} (${aiacStudents.length} records)` : `Attended in another center (${aiacStudents.length} records)`}
          </div>
          <SessionTable
            data={paginatedAiacStudents}
            height={300}
            showMainCenter={true}
            showGrade={true}
            showSchool={true}
            showComment={false}
            showMainComment={true}
            showWeekComment={true}
            showWhatsApp={true}
            showMessageState={true}
            showStatsColumns={true}
            showAvailableSessions={true}
            lesson={selectedWeek}
            emptyMessage={selectedWeek ? 
              `No students attended in another center in ${selectedWeek}.` :
              `No students found for selected center.`
            }
            onMessageStateChange={handleMessageStateChange}
          />
          
          {/* Pagination for AIAC Students Table */}
          {aiacStudents.length > 0 && (
            <div className="pagination-container">
              <button
                className="pagination-button"
                onClick={handleAiacPrevPage}
                disabled={!aiacPagination.hasPrevPage}
                aria-label="Previous page"
              >
                <IconChevronLeft size={20} stroke={2} />
              </button>
              
              <div 
                className={`pagination-page-info pagination-page-info-aiac ${aiacPagination.totalPages > 1 ? 'clickable' : ''}`}
                onClick={() => aiacPagination.totalPages > 1 && setShowAiacPagePopup(!showAiacPagePopup)}
                style={{ position: 'relative', cursor: aiacPagination.totalPages > 1 ? 'pointer' : 'default', zIndex: 9999 }}
              >
                Page {aiacPagination.currentPage} of {aiacPagination.totalPages}
                
                {/* Page Number Popup */}
                {showAiacPagePopup && aiacPagination.totalPages > 1 && (
                  <div className="page-popup page-popup-aiac" style={{ zIndex: 10000 }}>
                    <div className="page-popup-content">
                      <div className="page-popup-header">Select Page</div>
                      <div className="page-popup-grid">
                        {Array.from({ length: aiacPagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                          <button
                            key={pageNum}
                            className={`page-number-btn ${pageNum === aiacPagination.currentPage ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAiacPageClick(pageNum);
                            }}
                          >
                            {pageNum}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                className="pagination-button"
                onClick={handleAiacNextPage}
                disabled={!aiacPagination.hasNextPage}
                aria-label="Next page"
              >
                <IconChevronRight size={20} stroke={2} />
              </button>
            </div>
          )}
        </div>
        {isLoading && <LoadingSkeleton />}
      </div>
    </div>
  );
}

// Replace counts-container with StatsRing
function StatsRing({ MC, NMC, totalAttended, mainCenterTotal, selectedWeek }) {
  const stats = [
    {
      label: 'Main Center',
      stats: `${MC} / ${mainCenterTotal}`,
      progress: mainCenterTotal > 0 ? Math.round((MC / mainCenterTotal) * 100) : 0,
      color: 'teal',
    },
    {
      label: 'Not Main Center',
      stats: NMC,
      progress: totalAttended > 0 ? Math.round((NMC / totalAttended) * 100) : 0,
      color: 'red',
    },
    {
      label: 'Total Attended',
      stats: totalAttended,
      progress: totalAttended > 0 ? 100 : 0,
      color: 'blue',
    },
  ];
  
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }} style={{ marginBottom: 24 }}>
      {stats.map((stat) => (
        <Paper withBorder radius="md" p="xs" key={stat.label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <RingProgress
              size={80}
              roundCaps
              thickness={8}
              sections={[{ value: stat.progress, color: stat.color }]}
              label={null}
            />
            <Text c="dimmed" size="xs" tt="uppercase" fw={700} mt={12} align="center">
              {stat.label}
            </Text>
            <Text fw={700} size="xl" align="center">
              {stat.stats}
            </Text>
          </div>
        </Paper>
      ))}
    </SimpleGrid>
  );
} 