import React, { useState } from 'react';
import { useUpdateMessageState } from '../lib/api/students';
import { generatePublicStudentLink } from '../lib/generatePublicLink';

const WhatsAppButton = ({ student, onMessageSent, lesson, isStudentMessage = false }) => {
  const [message, setMessage] = useState('');
  const updateMessageStateMutation = useUpdateMessageState();

  const handleWhatsAppClick = () => {
    setMessage('');
    
    // Declare lessonName at the beginning so it's accessible throughout the function
    const lessonName = lesson || 'If Conditions';

    try {
      // Choose phone number based on message type
      let phoneNumber = isStudentMessage 
        ? (student.phone ? student.phone.replace(/[^0-9]/g, '') : null)
        : (student.parents_phone ? student.parents_phone.replace(/[^0-9]/g, '') : null);
      
      // Enhanced validation for Egyptian phone numbers (must be exactly 11 digits)
      if (!phoneNumber) {
        setMessage(`Missing ${isStudentMessage ? 'student' : 'parent'} phone number`);
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }
      
      // Egyptian phone numbers must be exactly 11 digits
      if (phoneNumber.length !== 11) {
        setMessage(`Invalid phone number: must be exactly 11 digits, got ${phoneNumber.length}`);
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }
      
      // Must start with 01 (Egyptian mobile format)
      if (!phoneNumber.startsWith('01')) {
        setMessage('Invalid phone number: must start with 01');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }
      
      // Check for suspicious patterns (like repeated digits)
      if (/^(.)\1{10}$/.test(phoneNumber)) { // All same digit (e.g., 11111111111)
        setMessage('Invalid phone number format');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }
      
      // Format Egyptian phone numbers: 01XXXXXXXXX -> 2001XXXXXXXXX
      phoneNumber = '20' + phoneNumber.substring(1);

      // Validate student data
      if (!student.name) {
        setMessage('Student data incomplete - missing name');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }

      // Get current lesson and its previous lesson (based on object key order)
      const lessonKeys = Object.keys(student.lessons || {});
      const currentIndex = lessonKeys.findIndex(
        key => key.trim().toLowerCase() === lessonName.trim().toLowerCase()
      );

      let currentLesson = student.lessons?.[lessonName] || {};
      let previousLesson = null;

      if (currentIndex > 0) {
        const prevLessonName = lessonKeys[currentIndex - 1];
        previousLesson = student.lessons[prevLessonName];
        console.log(`Previous lesson found: ${prevLessonName}`, previousLesson);
      } else {
        console.log(`No previous lesson found for ${lessonName}`);
      }


      // Map lesson names to their Quiz and Assignment links (case-insensitive)
      const lessonKey = String(lessonName || '').trim().toLowerCase();
      const lessonLinks = {
        'subject and verb agreement': {
          quiz: 'https://www.zipgrade.com/s/vCGJ04j/',
          assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-subject-verb-agreement-2/'
        },
        'verb tenses': {
          quiz: 'https://www.zipgrade.com/s/nVbDqQ2/',
          assignment: 'https://www.zipgrade.com/s/w9T5PSz/'
        },
        'if conditionals and pronouns': {
          if_conditions_quiz: 'https://www.zipgrade.com/s/joL63ws/',
          pronouns_quiz: 'https://www.zipgrade.com/s/2BubGv6/',
          if_conditions_assignment: 'https://www.zipgrade.com/s/szlikJK/',
          pronouns_assignment: 'https://www.zipgrade.com/s/NOIgf45/'
        },
        'comparison and superlative and parallel structure': {
          comparison_and_superlative_quiz: 'https://www.zipgrade.com/s/STxsT3T/',
          comparison_and_superlative_assignment: 'https://www.zipgrade.com/s/IWvNdfg/',
          parallel_structure_quiz: 'https://www.zipgrade.com/s/ejoSveB/',
          parallel_structure_assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-english-parallel-structure-2/'
        },
        'modifiers': {
          quiz: 'https://www.zipgrade.com/s/w5QRS9X/',
          assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-misplaced-and-dangling-modifiers-2/'
        },
        'transition words': {
          quiz: 'https://www.zipgrade.com/s/k7BaTzs/',
          assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-transition-words-and-phrases-2/'
        },
        'punctuation marks part 1': {
          quiz: 'https://www.zipgrade.com/s/bbx7hu0/',
          assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-punctuation-marks-2/'
        },
        'punctuation marks part 2': {
          quiz: 'https://www.zipgrade.com/s/bbx7hu0/',
          assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-punctuation-marks-2/'
        },
        'supporting evidence and examples, topic, conclusion, and transition sentences': {
          supporting_evidence_and_examples_quiz: 'https://www.zipgrade.com/s/bEygx3m/',
          supporting_evidence_and_examples_assignment: 'https://skola-eg.com/courses/mr-ahmed-badr-est-english-supporting-evidence-and-examples-2/',
          topic_conclusion_and_transition_sentences_quiz: 'https://www.zipgrade.com/s/GJKmUzZ/',
          topic_conclusion_and_transition_sentences_assignment: 'https://www.zipgrade.com/s/5zdoyD5/'
        },
        'rhetorical synthesis': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/courses/rhetorical-synthesis/'
        },
        'making inferences': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/courses/inferences/'
        },
        'cross-text connections': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/?s=Cross+text+connections'
        },
        'command of evidence - graphs': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/?s=command+of+evidence'
        },
        'command of evidence - support and weaken': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/?s=command+of+evidence'
        },
        'text, structure, and purpose': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/?s=Text%2C+Structure%2C+and+Purpose'
        },
        'main ideas': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/courses/central-ideas-and-details/'
        },
        'words in context - gap filling - synonyms': {
          // No quiz link per requirement
          assignment: 'https://skola-eg.com/?s=Words+in+context'
        },
        'topic, conclusion, and transition sentences': {
          topic_conclusion_and_transition_sentences_quiz: 'https://www.zipgrade.com/s/GJKmUzZ/',
          topic_conclusion_and_transition_sentences_assignment: 'https://www.zipgrade.com/s/5zdoyD5/'
        },
        'sentence placement': {
          quiz: 'https://www.zipgrade.com/s/zSVrwWj/',
          assignment: 'https://www.zipgrade.com/s/ZTmi2PF/'
        },
        'relevance and purpose': {
          quiz: 'https://www.zipgrade.com/s/3lfY3LH/',
          assignment: 'https://www.zipgrade.com/s/AS0TWub/'
        }
      };
      const selectedLinks = lessonLinks[lessonKey] || {};
      
      // Handle different link formats
      let quizLink = null;
      let assignmentLink = null;
      let additionalLinks = [];
      
      if (selectedLinks.quiz && selectedLinks.assignment) {
        // Standard format with single quiz and assignment
        quizLink = selectedLinks.quiz;
        assignmentLink = selectedLinks.assignment;
      } else {
        // Combined lesson format with multiple links
        Object.keys(selectedLinks).forEach(key => {
          if (key.includes('quiz')) {
            additionalLinks.push(`• ${key.replace(/_/g, ' ').replace('quiz', 'Quiz')} : ${selectedLinks[key]}`);
          } else if (key.includes('assignment')) {
            additionalLinks.push(`• ${key.replace(/_/g, ' ').replace('assignment', 'Assignment')} : ${selectedLinks[key]}`);
          }
        });
      }

      // Build custom messages for parents and students
      const firstName = student.name ? student.name.split(' ')[0] : 'Student';
      const attendanceInfo = currentLesson.lastAttendance && currentLesson.lastAttendanceCenter
        ? `${currentLesson.lastAttendance}.`
        : (currentLesson.attended ? (currentLesson.lastAttendance || 'Attended') : 'Absent');
      const remainingSessions = (student && student.payment && student.payment.numberOfSessions != null)
        ? Number(student.payment.numberOfSessions)
        : 0;

      // Compute attendance date name (day of week) from DD/MM/YYYY stored date
      let attendanceDateName = null;
      try {
        const dateString = currentLesson.attendanceDate;
        if (dateString && typeof dateString === 'string') {
          const [day, month, year] = dateString.split('/');
          if (day && month && year) {
            const date = new Date(`${year}-${month}-${day}`);
            const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            attendanceDateName = days[date.getDay()];
          }
        }
      } catch {}

      // Build deadline text based on center and attendance day
      const normalize = (s) => (s || '').toString().trim().toLowerCase();
      const center = normalize(currentLesson.lastAttendanceCenter);
      const dayName = normalize(attendanceDateName);
      let deadlineText = '';

      if ((center === 'madinaty center' || center === 'suez center')) {
        if (dayName === 'monday') deadlineText = 'Assignment and quiz deadline: Wednesday at 8 PM.';
        if (dayName === 'thursday') deadlineText = 'Assignment and quiz deadline: Sunday at 8 PM.';
      } else if (center === 'nasr city center') {
        if (dayName === 'tuesday') deadlineText = 'Assignment and quiz deadline: Friday at 8 PM.';
        if (dayName === 'saturday') deadlineText = 'Assignment and quiz deadline: Monday at 8 PM.';
      } else if (center === 'rehab center') {
        if (dayName === 'wednesday') deadlineText = 'Assignment and quiz deadline: Tuesday at 9 PM.';
        if (dayName === 'sunday') deadlineText = 'Assignment and quiz deadline: Saturday at 9 PM.';
      }

      // Previous Assignment & Quiz only if a previous lesson exists
      let previousAssignment = null;
      let previousQuizDegree = null;

      if (previousLesson) {
        console.log(`Processing previous lesson data:`, previousLesson);
        
        if (previousLesson.hwDone === true) {
          if (
            previousLesson.homework_degree !== null &&
            previousLesson.homework_degree !== undefined &&
            String(previousLesson.homework_degree).trim() !== ''
          ) {
            previousAssignment = `Done (${previousLesson.homework_degree})`;
          } else {
            previousAssignment = 'Done';
          }
        } else if (previousLesson.hwDone === false) {
          previousAssignment = 'Not Done';
        } else if (previousLesson.hwDone === 'No Homework') {
          previousAssignment = 'No Homework';
        } else if (previousLesson.hwDone === 'Not Completed') {
          previousAssignment = 'Not Completed';
        } else {
          previousAssignment = 'Not Done';
        }

        if (
          previousLesson.quizDegree !== null &&
          previousLesson.quizDegree !== undefined &&
          String(previousLesson.quizDegree).trim() !== ''
        ) {
          previousQuizDegree = previousLesson.quizDegree;
        }
        
        console.log(`Previous assignment: ${previousAssignment}, Previous quiz: ${previousQuizDegree}`);
      } else {
        console.log(`No previous lesson data available`);
      }


      // Check if quiz degree exists and is not null/empty
      const hasQuizDegree = currentLesson.quizDegree !== null && 
                           currentLesson.quizDegree !== undefined && 
                           String(currentLesson.quizDegree).trim() !== '';

      // Generate public link for student progress tracking
      const publicLink = generatePublicStudentLink(student.id);

      let whatsappMessage;
      if (!isStudentMessage) {
        // Parent template - include comment only if it has a value
        const commentLine = (currentLesson.comment && currentLesson.comment.trim() !== '' && currentLesson.comment !== 'undefined') 
          ? `  • Comment : ${currentLesson.comment}\n` 
          : '';
        
          // Include assignment and quiz lines only if not absent
          const assignmentLine = (previousAssignment)
            ? `• Previous Assignment : ${previousAssignment}\n`
            : '';

          const quizLine = (previousQuizDegree)
            ? `• Previous Quiz Degree : ${previousQuizDegree}\n`
            : '';

          const sessionsLine = `  • Number of remaining sessions: ${remainingSessions}\n`;

          const publicLinkLine = `\nPlease visit the following link to check ${firstName}'s grades and progress: ⬇️\n\n🖇️ ${publicLink}\n`;
        
        whatsappMessage = `Ahmed Badr's Quality Team: \n\nDear, ${firstName}'s Parent \nHere are our session's info for today:\n\n  • Lesson: ${lessonName}\n  • Attendance Info: ${attendanceInfo}\n${assignmentLine}${quizLine}${commentLine}${publicLinkLine}\nNote :-\n  • ${firstName}'s ID: ${student.id}\n${sessionsLine}\nWe wish ${firstName} gets high scores 😊❤\n\n– Mr. Ahmed Badr`;
      } else {
        // Student template - include previous work even if absent
        if (attendanceInfo === 'Absent') {
          console.log(`Creating absent student message for ${firstName}`);
          console.log(`Previous assignment: ${previousAssignment}, Previous quiz: ${previousQuizDegree}`);
          
          // Include previous assignment and quiz even when absent
          const assignmentLine = previousAssignment
            ? `• Previous Assignment : ${previousAssignment}\n`
            : '';
        
          const quizLine = previousQuizDegree
            ? `• Previous Quiz Degree : ${previousQuizDegree}\n`
            : '';
          
          const sessionsLine = `\n  • Number of remaining sessions: ${remainingSessions}`;
          
          const publicLinkLine = `\nPlease visit the following link to check your grades and progress: ⬇️\n\n🖇️ ${publicLink}\n`;
          
          console.log(`Assignment line: "${assignmentLine}", Quiz line: "${quizLine}"`);
          
          // For absent students, show what they missed and previous work
          whatsappMessage = `Ahmed Badr's Quality Team: \n\nDear Student : ${firstName}\nHere are our session's info for today: \n\n  • Lesson covered: ${lessonName}\n  • Attendance Info: ${attendanceInfo}\n\n${assignmentLine}${quizLine}${publicLinkLine}\nNote :-\n  •Your ID: ${student.id}${sessionsLine}\n\nWe wish you a high score 😊❤\n\n– Mr. Ahmed Badr`;
        } else {
          // Include assignment and quiz lines only if not absent
          const assignmentLine = previousAssignment
          ? `• Previous Assignment : ${previousAssignment}\n`
          : '';
        
        const quizLine = previousQuizDegree
          ? `• Previous Quiz Degree : ${previousQuizDegree}\n`
          : '';
        
          // Handle link formatting for attended students
          let linkLines = '';
          if (quizLink && assignmentLink) {
            // Standard format with single quiz and assignment
            linkLines = `${quizLink ? `  • Your Quiz link : ${quizLink}\n` : ''}${assignmentLink ? `  • Your Assignment link : ${assignmentLink}\n` : ''}`;
          } else if (additionalLinks.length > 0) {
            // Combined lesson format with multiple links
            linkLines = additionalLinks.join('\n') + '\n';
          }
          
          const sessionsLine = `  • Number of remaining sessions: ${remainingSessions}\n`;
          const deadlineLine = deadlineText ? `\n*${deadlineText}*\n` : '';
          const publicLinkLine = `\nPlease visit the following link to check your grades and progress: ⬇️\n\n🖇️ ${publicLink}\n`;

          whatsappMessage = `Ahmed Badr's Quality Team: \n\nDear Student : ${firstName}\nHere are our session's info for today: \n\n  • Lesson covered: ${lessonName}\n  • Attendance Info: ${attendanceInfo}\n${linkLines}${deadlineLine}\n${assignmentLine}${quizLine}${publicLinkLine}\nNote :-\n  •Your ID: ${student.id}\n${sessionsLine}\nWe wish you a high score 😊❤\n\n– Mr. Ahmed Badr`;
        }
      }

      // Create WhatsApp URL with the formatted message
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // Log the final phone number for debugging
      const originalPhone = isStudentMessage ? student.phone : student.parents_phone;
      console.log('Attempting to send WhatsApp to:', phoneNumber, 'Original:', originalPhone);
      
      // Try to open WhatsApp in a new tab/window
      const whatsappWindow = window.open(whatsappUrl, '_blank');
      
      // Check if window was blocked or failed to open
      if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
        setMessage('Popup blocked - please allow popups and try again');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ 
          id: student.id, 
          message_state: false, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        });
        return;
      }
      
      // Additional check: if the window opened but immediately closed, it might be an invalid number
      setTimeout(() => {
        if (whatsappWindow.closed) {
          console.log('WhatsApp window closed immediately - possibly invalid number');
          // Note: We can't reliably detect this, so we'll rely on user feedback
        }
      }, 1000);
      
      // If we reach here, everything was successful
      setMessage('WhatsApp opened successfully!');
      
      // Update message state in database
      console.log('Updating message state in database for student:', student.id, 'lesson:', lessonName);
      console.log('Student data:', { id: student.id, lesson: lessonName, name: student.name });
      console.log('Student lessons data:', student.lessons);
      
      updateMessageStateMutation.mutate(
        { 
          id: student.id, 
          message_state: true, 
          lesson: lessonName,
          isStudentMessage: isStudentMessage 
        },
        {
          onSuccess: () => {
            console.log('Message state updated successfully in database');
            // Also call the parent callback for any additional local state management
            if (onMessageSent) {
              onMessageSent(student.id, true);
            }
          },
          onError: (error) => {
            console.error('Failed to update message state in database:', error);
            console.error('Error details:', error.response?.data || error.message);
            setMessage('WhatsApp sent but failed to update status');
            setTimeout(() => setMessage(''), 3000);
            // Don't call onMessageSent if database update fails
          }
        }
      );
      
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      // Handle any unexpected errors
      console.error('WhatsApp sending error:', error);
      setMessage('Error occurred while opening WhatsApp');
      setTimeout(() => setMessage(''), 3000);
      // Update database to mark as failed
      updateMessageStateMutation.mutate({ 
        id: student.id, 
        message_state: false, 
        lesson: lessonName,
        isStudentMessage: isStudentMessage 
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleWhatsAppClick}
        style={{
          backgroundColor: '#25D366',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '500',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => (e.target.style.backgroundColor = '#128C7E')}
        onMouseLeave={(e) => (e.target.style.backgroundColor = '#25D366')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
        </svg>
        Send
      </button>
      
      {message && (
        <div style={{
          fontSize: '10px',
          color: message.includes('success') ? '#28a745' : '#dc3545',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton; 