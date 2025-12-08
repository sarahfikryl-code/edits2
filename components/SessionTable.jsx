import { useState, useRef, useEffect } from 'react';
import cx from 'clsx';
import { ScrollArea, Table, Modal } from '@mantine/core';
import classes from './TableScrollArea.module.css';
import WhatsAppButton from './WhatsAppButton.jsx';

export function SessionTable({ 
  data, 
  showHW = false, 
  showQuiz = false, 
  showComment = false,
  showMainComment = false,
  showWeekComment = false,
  height = 300,
  emptyMessage = "No students found",
  showMainCenter = true,
  showWhatsApp = true,
  showMessageState = true,
  showSchool = false,
  showGrade = false,
  showCourseType = false,
  showAccountStatus = false,
  showParentsPhone2 = false,
  showAddress = false,
  showAvailableSessions = false,
  onMessageStateChange,
  showStatsColumns = false,
  lesson = null
}) {
  const [scrolled, setScrolled] = useState(false);
  const [needsScroll, setNeedsScroll] = useState(false);
  const tableRef = useRef(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [detailsWeeks, setDetailsWeeks] = useState([]);
  const [detailsStudent, setDetailsStudent] = useState(null);
  
  // Use 100px height when table is empty, otherwise use the provided height
  const tableHeight = data.length === 0 ? 100 : height;
  
  // Only show scroll area when there's actual data
  useEffect(() => {
    setNeedsScroll(data.length > 0);
  }, [data]);

  // Handle WhatsApp message sent - database handles the state now
  const handleMessageSent = (studentId, sent) => {
    console.log('Message sent for student:', studentId, 'Status:', sent);
    
    // Call the parent callback if provided (for any additional logic)
    if (onMessageStateChange) {
      onMessageStateChange(studentId, sent);
    }
  };

  // Helpers to derive lesson lists for modal
  const getAbsentLessons = (student) => {
    let lessons = [];
    
    // Get all lessons that exist in the student's database
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessons = Object.keys(student.lessons).map(lessonName => ({
        lesson: lessonName,
        ...student.lessons[lessonName]
      }));
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessons = student.lessons.filter(l => l && l.lesson);
    } else if (student.weeks && Array.isArray(student.weeks)) {
      lessons = student.weeks.map((week, index) => ({
        lesson: `Lesson ${index + 1}`,
        ...week
      }));
    }
    
    // Filter for lessons where attended is explicitly false
    return lessons
      .filter(lesson => lesson.attended === false)
      .map(lesson => ({
        lesson: lesson.lesson,
        quizDegree: null
      }));
  };

  const getMissingHWLessons = (student) => {
    let lessons = [];
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessons = Object.values(student.lessons);
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessons = student.lessons;
    } else if (student.weeks && Array.isArray(student.weeks)) {
      lessons = student.weeks;
    }
    
    return lessons
      .filter(l => l && (l.hwDone === false || l.hwDone === "Not Completed" || l.hwDone === "not completed" || l.hwDone === "NOT COMPLETED"))
      .map(l => ({
        lesson: l.lesson || l.week,
        hwDone: l.hwDone,
        quizDegree: l.quizDegree
      }));
  };

  const getUnattendQuizLessons = (student) => {
    let lessons = [];
    if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
      lessons = Object.values(student.lessons);
    } else if (student.lessons && Array.isArray(student.lessons)) {
      lessons = student.lessons;
    } else if (student.weeks && Array.isArray(student.weeks)) {
      lessons = student.weeks;
    }
    
    return lessons
      .filter(l => l && (l.quizDegree === "Didn't Attend The Quiz" || l.quizDegree == null))
      .map(l => ({
        lesson: l.lesson || l.week,
        quizDegree: l.quizDegree
      }));
  };

  const openDetails = (student, type) => {
    let title = '';
    let lessonsList = [];
    if (type === 'absent') {
      title = `Absent Lessons for ${student.name ?? student.id} • ID: ${student.id}`;
      lessonsList = getAbsentLessons(student);
    } else if (type === 'hw') {
      title = `Missing Homework for ${student.name ?? student.id} • ID: ${student.id}`;
      lessonsList = getMissingHWLessons(student);
    } else if (type === 'quiz') {
      title = `Unattended Quizzes for ${student.name ?? student.id} • ID: ${student.id}`;
      lessonsList = getUnattendQuizLessons(student);
    }
    setDetailsStudent(student);
    setDetailsTitle(title);
    setDetailsWeeks(lessonsList);
    setDetailsType(type);
    setDetailsOpen(true);
  };

  const [detailsType, setDetailsType] = useState('absent');

  const rows = data.map((student) => (
    <Table.Tr key={student.id}>
      <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', width: '60px', minWidth: '60px', textAlign: 'center', fontSize: '15px' }}>{student.id}</Table.Td>
      <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center', fontSize: '15px' }}>{student.name}</Table.Td>
      {showGrade && <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center', fontSize: '15px' }}>{student.grade || 'N/A'}</Table.Td>}
      {showCourseType && <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center', fontSize: '15px' }}>{student.courseType || 'N/A'}</Table.Td>}
      {showMainCenter && <Table.Td style={{ textAlign: 'center', width: '120px', minWidth: '120px', fontSize: '15px' }}>{student.main_center}</Table.Td>}
      {showSchool && <Table.Td style={{ width: '150px', minWidth: '150px', textAlign: 'center', fontSize: '15px' }}>{student.school || 'N/A'}</Table.Td>}
      <Table.Td style={{ width: '140px', minWidth: '140px', fontFamily: 'monospace', fontSize: '15px', textAlign: 'center' }}>{student.phone || ''}</Table.Td>
      {showMessageState && (
        <Table.Td style={{ 
          textAlign: 'center', 
          verticalAlign: 'middle',
          fontWeight: '500',
          width: '120px',
          minWidth: '120px',
          fontSize: '15px'
        }}>
          {student.student_message_state ? (
            <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '15px' }}>✓ Sent</span>
          ) : (
            <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '15px' }}>✗ Not Sent</span>
          )}
        </Table.Td>
      )}
      {showWhatsApp && data.length > 0 && (
        <Table.Td style={{ 
          textAlign: 'center', 
          verticalAlign: 'middle',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '120px',
          minWidth: '120px'
        }}>
          <WhatsAppButton 
            student={student} 
            onMessageSent={handleMessageSent}
            lesson={lesson || student.currentLesson || 'If Conditions'}
            isStudentMessage={true}
          />
        </Table.Td>
      )}
      <Table.Td style={{ width: '140px', minWidth: '140px', fontFamily: 'monospace', fontSize: '15px', textAlign: 'center' }}>{student.parents_phone || student.parentsPhone || ''}</Table.Td>
      {showMessageState && (
        <Table.Td style={{ 
          textAlign: 'center', 
          verticalAlign: 'middle',
          fontWeight: '500',
          width: '120px',
          minWidth: '120px',
          fontSize: '15px'
        }}>
          {student.parent_message_state ? (
            <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '15px' }}>✓ Sent</span>
          ) : (
            <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '15px' }}>✗ Not Sent</span>
          )}
        </Table.Td>
      )}
      {showWhatsApp && data.length > 0 && (
        <Table.Td style={{ 
          textAlign: 'center', 
          verticalAlign: 'middle',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '120px',
          minWidth: '120px'
        }}>
          <WhatsAppButton 
            student={student} 
            onMessageSent={handleMessageSent}
            lesson={lesson || student.currentLesson || 'If Conditions'}
            isStudentMessage={false}
          />
        </Table.Td>
      )}
      {showParentsPhone2 && <Table.Td style={{ width: '140px', minWidth: '140px', fontFamily: 'monospace', fontSize: '15px', textAlign: 'center' }}>{student.parentsPhone2 || student.parents_phone2 || 'N/A'}</Table.Td>}
      {showAddress && <Table.Td style={{ width: '150px', minWidth: '150px', fontSize: '15px', textAlign: 'center' }}>{student.address || 'N/A'}</Table.Td>}
      {showAccountStatus && (
        <Table.Td style={{ textAlign: 'center', width: '120px', minWidth: '120px', fontSize: '15px' }}>
          {student.account_state === 'Deactivated' ? (
            <span style={{ color: '#dc3545', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>❌</span>
              <span>Deactivated</span>
            </span>
          ) : (
            <span style={{ color: '#28a745', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>✅</span>
              <span>Activated</span>
            </span>
          )}
        </Table.Td>
      )}
      {showStatsColumns && <Table.Td style={{ textAlign: 'center', width: '140px', minWidth: '140px', fontSize: '15px' }}>{student.lastAttendanceCenter || 'N/A'}</Table.Td>}
      {showHW && (
        <Table.Td style={{ textAlign: 'center', width: '120px', minWidth: '120px' }}>
          {(() => {
            if (student.hwDone === "No Homework") {
              return <span style={{ color: '#dc3545', fontSize: '15px', fontWeight: 'bold' }}>🚫 No Homework</span>;
            } else if (student.hwDone === "Not Completed" || student.hwDone === "not completed" || student.hwDone === "NOT COMPLETED") {
              return <span style={{ color: '#ffc107', fontSize: '15px', fontWeight: 'bold' }}>⚠️ Not Completed</span>;
            } else if (student.hwDone === true) {
              const homeworkDegree = student.homework_degree;
              if (homeworkDegree && homeworkDegree !== null && homeworkDegree !== undefined && homeworkDegree !== '') {
                return <span style={{ color: '#28a745', fontSize: '15px', fontWeight: 'bold' }}>✅ Done ({homeworkDegree})</span>;
              } else {
                return <span style={{ color: '#28a745', fontSize: '15px', fontWeight: 'bold' }}>✅ Done</span>;
              }
            } else {
              return <span style={{ color: '#dc3545', fontSize: '15px', fontWeight: 'bold' }}>❌ Not Done</span>;
            }
          })()}
        </Table.Td>
      )}
      
      {showQuiz && (
        <Table.Td style={{ textAlign: 'center', width: '140px', minWidth: '140px' }}>
          {(() => {
            const value = (student.quizDegree !== undefined && student.quizDegree !== null && student.quizDegree !== '') ? student.quizDegree : '0/0';
            if (value === "Didn't Attend The Quiz") {
              return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '15px' }}>✗ Didn't Attend The Quiz</span>;
            } else if (value === "No Quiz") {
              return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '15px' }}>🚫 No Quiz</span>;
            }
            return <span style={{ fontSize: '15px' }}>{value}</span>;
          })()}
        </Table.Td>
      )}
      {(showComment || showMainComment) && (
        <Table.Td style={{ textAlign: 'center', width: '160px', minWidth: '160px', fontSize: '15px' }}>
          {(() => {
            const mainCommentRaw = (student.main_comment ?? '').toString();
            return mainCommentRaw.trim() !== '' ? mainCommentRaw : 'No Comment';
          })()}
        </Table.Td>
      )}
      {(showComment || showWeekComment) && (
        <Table.Td style={{ textAlign: 'center', width: '160px', minWidth: '160px', fontSize: '15px' }}>
          {(() => {
            try {
              // Use lesson-specific comment if available, otherwise fall back to weeks array
              if (student.currentLessonName && student.lessons && student.lessons[student.currentLessonName]) {
                const lessonComment = (student.lessons[student.currentLessonName]?.comment ?? '').toString();
                return lessonComment.trim() !== '' ? lessonComment : 'No Comment';
              }
              
              // Fallback to weeks array for backward compatibility
              const idx = (typeof student.currentWeekNumber === 'number' && !isNaN(student.currentWeekNumber))
                ? (student.currentWeekNumber - 1)
                : -1;
              const fromWeeks = (idx >= 0 && Array.isArray(student.weeks)) ? (student.weeks[idx]?.comment ?? '').toString() : '';
              return fromWeeks.trim() !== '' ? fromWeeks : 'No Comment';
            } catch {
              return 'No Comment';
            }
          })()}
        </Table.Td>
      )}
      {showAvailableSessions && (
        <Table.Td style={{ textAlign: 'center', width: '140px', minWidth: '140px', fontSize: '15px' }}>
          {(() => {
            // Debug logging
            if (student.id <= 3) {
              console.log(`🔍 SessionTable - Student ${student.id}:`, {
                payment: student.payment,
                numberOfSessions: student.payment?.numberOfSessions
              });
            }
            return (
              <span style={{ 
                color: (student.payment?.numberOfSessions || 0) <= 2 ? '#dc3545' : '#212529',
                fontWeight: '700',
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
                  {(student.payment?.numberOfSessions || 0)}
                </span>
                <span style={{ 
                  fontSize: '17px', 
                  fontWeight: '600',
                  opacity: '0.9',
                  textTransform: 'lowercase'
                }}>
                  sessions
                </span>
              </span>
            );
          })()}
        </Table.Td>
      )}
      <Table.Td style={{ textAlign: 'center', width: '140px', minWidth: '140px', cursor: 'pointer', fontWeight: 700, color: '#dc3545', fontSize: '15px' }}
        onClick={() => openDetails(student, 'absent')}
        title="Show absent lessons">
        {getAbsentLessons(student).length}
      </Table.Td>
      <Table.Td style={{ textAlign: 'center', width: '160px', minWidth: '160px', cursor: 'pointer', fontWeight: 700, color: '#fd7e14', fontSize: '15px' }}
        onClick={() => openDetails(student, 'hw')}
        title="Show missing homework lessons">
        {getMissingHWLessons(student).length}
      </Table.Td>
      <Table.Td style={{ textAlign: 'center', width: '200px', minWidth: '200px', cursor: 'pointer', fontWeight: 700, color: '#1FA8DC', fontSize: '15px' }}
        onClick={() => openDetails(student, 'quiz')}
        title="Show unattended quiz lessons">
        {getUnattendQuizLessons(student).length}
      </Table.Td>
    </Table.Tr>
  ));

  const getMinWidth = () => {
    // Use smaller widths when table is empty
    if (data.length === 0) {
      let baseWidth = showMainCenter ? 800 : 720; // Compact widths for empty table (increased for statistics columns)
      if (showGrade) baseWidth += 80; // Grade column
      if (showSchool) baseWidth += 100; // School column
      if (showParentsPhone2) baseWidth += 80; // Parents No. 2
      if (showAddress) baseWidth += 100; // Address
      if (showAccountStatus) baseWidth += 80; // Account Status
      if (showAvailableSessions) baseWidth += 100; // Available Sessions
      if (showHW) baseWidth += 80;
      if (showQuiz) baseWidth += 100;
      if (showComment || showMainComment) baseWidth += 160; // Main Comment
      if (showComment || showWeekComment) baseWidth += 160; // Week Comment
      if (showMessageState) baseWidth += 80; // Message State column
      if (showWhatsApp && data.length > 0) baseWidth += 80;
      baseWidth += 500; // Statistics columns (140 + 160 + 200)
      return baseWidth;
    } else {
      // Calculate based on actual column widths: ID(60) + Name(120) + Grade(100) + School(150) + Student(140) + Parents(140) + Parents2(140) + Address(150) + MainCenter(120) + AccountStatus(120) + AvailableSessions(140) + AttendanceCenter(140) + MessageState(120) + WhatsApp(120) + Stats(500)
      let baseWidth = 60 + 120 + 140 + 140; // ID + Name + Student No. + Parents No.
      if (showGrade) baseWidth += 100; // Grade column
      if (showSchool) baseWidth += 150; // School column
      if (showParentsPhone2) baseWidth += 140; // Parents No. 2
      if (showAddress) baseWidth += 150; // Address
      if (showMainCenter) baseWidth += 120; // Main Center
      if (showAccountStatus) baseWidth += 120; // Account Status
      if (showAvailableSessions) baseWidth += 140; // Available Sessions
      if (showStatsColumns) baseWidth += 140; // Attendance Center
      baseWidth += 140; // Total absent sessions
      baseWidth += 160; // Total missing homework
      baseWidth += 200; // Total unattend quizzes
      if (showHW) baseWidth += 120; // HW State
      if (showQuiz) baseWidth += 140; // Quiz Degree
      if (showComment || showMainComment) baseWidth += 160; // Main Comment
      if (showComment || showWeekComment) baseWidth += 160; // Week Comment
      if (showMessageState) baseWidth += 120; // Message State column
      if (showWhatsApp && data.length > 0) baseWidth += 120; // WhatsApp Message
      return baseWidth;
    }
  };

  const tableContent = (
    <Table ref={tableRef} style={{ width: '100%', tableLayout: 'fixed' }}>
      <Table.Thead className={cx(classes.header, { [classes.scrolled]: scrolled })}>
        <Table.Tr>
          <Table.Th style={{ minWidth: data.length === 0 ? '40px' : '60px', width: '60px', textAlign: 'center' }}>ID</Table.Th>
          <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '120px', width: '120px', textAlign: 'center' }}>Name</Table.Th>
          {showGrade && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '100px', width: '100px', textAlign: 'center' }}>Course</Table.Th>}
          {showCourseType && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '100px', width: '100px', textAlign: 'center' }}>Course Type</Table.Th>}
          {showMainCenter && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '120px', width: '120px', textAlign: 'center' }}>Main Center</Table.Th>}
          {showSchool && <Table.Th style={{ minWidth: data.length === 0 ? '100px' : '150px', width: '150px', textAlign: 'center' }}>School</Table.Th>}
          <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '140px', width: '140px', textAlign: 'center' }}>Student No.</Table.Th>
          {showMessageState && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '120px', width: '120px', textAlign: 'center' }}>Student Message State</Table.Th>}
          {showWhatsApp && data.length > 0 && <Table.Th style={{ minWidth: data.length === 0 ? '70px' : '120px', width: '120px', textAlign: 'center' }}>Student Message Button</Table.Th>}
          <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '140px', width: '140px', textAlign: 'center' }}>Parents No. 1</Table.Th>
          {showMessageState && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '120px', width: '120px', textAlign: 'center' }}>Parent Message State</Table.Th>}
          {showWhatsApp && data.length > 0 && <Table.Th style={{ minWidth: data.length === 0 ? '70px' : '120px', width: '120px', textAlign: 'center' }}>Parent Message Button</Table.Th>}
          {showParentsPhone2 && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '140px', width: '140px', textAlign: 'center' }}>Parents No. 2</Table.Th>}
          {showAddress && <Table.Th style={{ minWidth: data.length === 0 ? '100px' : '150px', width: '150px', textAlign: 'center' }}>Address</Table.Th>}
          {showAccountStatus && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '120px', width: '120px', textAlign: 'center' }}>Account Status</Table.Th>}
          {showStatsColumns && <Table.Th style={{ minWidth: data.length === 0 ? '100px' : '140px', width: '140px', textAlign: 'center' }}>Attend In</Table.Th>}
          {showHW && <Table.Th style={{ minWidth: data.length === 0 ? '70px' : '120px', width: '120px', textAlign: 'center' }}>HW State</Table.Th>}
          
          {showQuiz && <Table.Th style={{ minWidth: data.length === 0 ? '80px' : '140px', width: '140px', textAlign: 'center' }}>Quiz Degree</Table.Th>}
          {(showComment || showMainComment) && <Table.Th style={{ minWidth: data.length === 0 ? '120px' : '160px', width: '160px', textAlign: 'center' }}>Hidden Comment</Table.Th>}
          {(showComment || showWeekComment) && <Table.Th style={{ minWidth: data.length === 0 ? '120px' : '160px', width: '160px', textAlign: 'center' }}>Parent Comment</Table.Th>}
          {showAvailableSessions && <Table.Th style={{ minWidth: data.length === 0 ? '100px' : '140px', width: '140px', textAlign: 'center' }}>Available Sessions</Table.Th>}
          <Table.Th style={{ minWidth: data.length === 0 ? '100px' : '140px', width: '140px', textAlign: 'center' }}>Total Absent Lessons</Table.Th>
          <Table.Th style={{ minWidth: data.length === 0 ? '120px' : '160px', width: '160px', textAlign: 'center' }}>Total Missing Homework</Table.Th>
          <Table.Th style={{ minWidth: data.length === 0 ? '140px' : '160px', width: '160px', textAlign: 'center' }}>Total Unattend Quizzes</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data.length === 0 ? (
          <Table.Tr>
              <Table.Td 
              colSpan={1 + 1 + (showGrade ? 1 : 0) + (showCourseType ? 1 : 0) + (showSchool ? 1 : 0) + 1 + (showMessageState ? 1 : 0) + (showWhatsApp ? 1 : 0) + 1 + (showMessageState ? 1 : 0) + (showWhatsApp ? 1 : 0) + (showParentsPhone2 ? 1 : 0) + (showAddress ? 1 : 0) + (showMainCenter ? 1 : 0) + (showAccountStatus ? 1 : 0) + (showAvailableSessions ? 1 : 0) + (showStatsColumns ? 1 : 0) + (showHW ? 1 : 0) + (showQuiz ? 1 : 0) + (showComment ? 1 : 0) + (showComment ? 1 : 0) + 3} 
              style={{ 
                border: 'none', 
                padding: 0,
                textAlign: 'center',
                verticalAlign: 'middle',
                width: '100%'
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '80px', 
                textAlign: 'center', 
                width: '100%',
                color: '#6c757d',
                fontSize: '1rem',
                fontWeight: '500',
                padding: '20px'
              }}>
                {emptyMessage}
              </div>
            </Table.Td>
          </Table.Tr>
        ) : (
          rows
        )}
      </Table.Tbody>
    </Table>
  );

  return (
    <div style={{ height: tableHeight, overflow: 'hidden', width: '100%', position: 'relative' }}>
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
                No {detailsType === 'absent' ? 'absent sessions' : 
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
                    fontSize: '15px',
                    '@media (max-width: 768px)': {
                      padding: '10px 8px',
                      fontSize: '13px'
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
                  <Table.Tr key={`${detailsStudent?.id}-${info.lesson}`} style={{
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
                            'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                          border: info.quizDegree === "Didn't Attend The Quiz" ? 
                            '1px solid #ef5350' : 
                            info.quizDegree === "No Quiz" ?
                            '1px solid #ef5350' : '1px solid #28a745',
                          color: info.quizDegree === "Didn't Attend The Quiz" ? 
                            '#c62828' : 
                            info.quizDegree === "No Quiz" ?
                            '#c62828' : '#155724',
                          fontWeight: '700',
                          fontSize: '0.95rem',
                          boxShadow: info.quizDegree === "Didn't Attend The Quiz" ? 
                            '0 2px 4px rgba(244, 67, 54, 0.2)' : 
                            info.quizDegree === "No Quiz" ?
                            '0 2px 4px rgba(244, 67, 54, 0.2)' : '0 2px 4px rgba(40, 167, 69, 0.2)'
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
      {needsScroll ? (
        <ScrollArea 
          h={tableHeight} 
          type="hover" 
          onScrollPositionChange={({ y }) => setScrolled(y !== 0)}
        >
          {data.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              color: '#6c757d',
              fontSize: '1rem',
              fontWeight: '500',
              textAlign: 'center'
            }}>
              {emptyMessage}
            </div>
          ) : (
            tableContent
          )}
        </ScrollArea>
      ) : (
        <div style={{ height: '100%', overflow: 'hidden', width: '100%' }}>
          {data.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              width: '100%',
              color: '#6c757d',
              fontSize: '1rem',
              fontWeight: '500',
              textAlign: 'center'
            }}>
              {emptyMessage}
            </div>
          ) : (
            tableContent
          )}
        </div>
      )}
    </div>
  );
} 