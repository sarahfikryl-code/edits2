import React, { useState } from 'react';
import { useUpdateMessageState } from '../lib/api/students';

const WhatsAppButton = ({ student, onMessageSent }) => {
  const [message, setMessage] = useState('');
  const updateMessageStateMutation = useUpdateMessageState();

  const handleWhatsAppClick = () => {
    setMessage('');

    try {
      // Validate and format phone number for WhatsApp
      let parentNumber = student.parents_phone ? student.parents_phone.replace(/[^0-9]/g, '') : null;
      
      // Enhanced validation for Egyptian phone numbers (must be exactly 11 digits)
      if (!parentNumber) {
        setMessage('Missing parent phone number');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Egyptian phone numbers must be exactly 11 digits
      if (parentNumber.length !== 11) {
        setMessage(`Invalid phone number: must be exactly 11 digits, got ${parentNumber.length}`);
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Must start with 01 (Egyptian mobile format)
      if (!parentNumber.startsWith('01')) {
        setMessage('Invalid phone number: must start with 01');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Check for suspicious patterns (like repeated digits)
      if (/^(.)\1{10}$/.test(parentNumber)) { // All same digit (e.g., 11111111111)
        setMessage('Invalid phone number format');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Format Egyptian phone numbers: 01XXXXXXXXX -> 2001XXXXXXXXX
      parentNumber = '20' + parentNumber.substring(1);

      // Validate student data
      if (!student.name) {
        setMessage('Student data incomplete - missing name');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }

      // Get current week data - assume we're working with the current week data
      const currentWeek = {
        attended: student.attended_the_session || false,
        lastAttendance: student.lastAttendance || 'N/A',
        hwDone: student.hwDone || false,
        quizDegree: student.quizDegree ?? null
      };


      // Create the message using the specified format
      // Extract first name from full name
      const firstName = student.name ? student.name.split(' ')[0] : 'Student';
      let whatsappMessage = `Follow up Message:

Dear, ${firstName}'s Parent
We want to inform you that we are in:

  • Week: ${student.currentWeekNumber || 1}
  • Attendance Info: ${currentWeek.attended ? `${currentWeek.lastAttendance}` : 'Absent'}`;

      // Only show attendance-related info if student attended
      if (currentWeek.attended) {
        // Format homework status properly
        let homeworkStatus = '';
        if (student.hwDone === true) {
          homeworkStatus = 'Done';
        } else if (student.hwDone === false) {
          homeworkStatus = 'Not Done';
        } else if (student.hwDone === 'No Homework') {
          homeworkStatus = 'No Homework';
        } else if (student.hwDone === 'Not Completed') {
          homeworkStatus = 'Not Completed';
        } else {
          homeworkStatus = 'Not Done'; // Default fallback
        }
        
        whatsappMessage += `
  • Homework: ${homeworkStatus}`;
  
        if (currentWeek.quizDegree !== null && String(currentWeek.quizDegree).trim() !== '') {
          whatsappMessage += `
  • Quiz Degree: ${currentWeek.quizDegree}`;
        }
      }
      
      // Add comment if it exists and is not null/undefined
      // Get comment from the current week data
      const currentWeekNumber = student.currentWeekNumber;
      const weekIndex = currentWeekNumber - 1;
      const weekData = student.weeks && student.weeks[weekIndex];
      const weekComment = weekData ? weekData.comment : null;
      
      if (weekComment && weekComment.trim() !== '' && weekComment !== 'undefined') {
        whatsappMessage += `
  • Comment: ${weekComment}`;
      }

      whatsappMessage += `
      
Note :-
  • ${firstName}'s ID: ${student.id}

We are always happy to stay in touch 😊❤

– Tony Joseph Demo attendance system`;

      // Create WhatsApp URL with the formatted message
      const whatsappUrl = `https://wa.me/${parentNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // Log the final phone number for debugging
      console.log('Attempting to send WhatsApp to:', parentNumber, 'Original:', student.parents_phone);
      
      // Try to open WhatsApp in a new tab/window
      const whatsappWindow = window.open(whatsappUrl, '_blank');
      
      // Check if window was blocked or failed to open
      if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
        setMessage('Popup blocked - please allow popups and try again');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
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
      const weekNumber = student.currentWeekNumber || 1; // Use current week or default to 1
      console.log('Updating message state in database for student:', student.id, 'week:', weekNumber);
      console.log('Student data:', { id: student.id, currentWeekNumber: student.currentWeekNumber, name: student.name });
      console.log('Student weeks data:', student.weeks);
      
      updateMessageStateMutation.mutate(
        { id: student.id, message_state: true, week: weekNumber },
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
      updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: student.currentWeekNumber || 1 });
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