import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';
import apiClient from '../../lib/axios';

export default function StudentDashboard() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  
  // Get student ID from profile and fetch student data
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData, isLoading: studentLoading } = useStudent(studentId, { enabled: !!studentId });
  
  // Fetch centers data
  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const response = await apiClient.get('/api/centers');
      return response.data.centers || [];
    },
    enabled: !!studentData?.main_center,
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Extract first name from student name
  const getFirstName = (fullName) => {
    if (!fullName) return 'Student';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Student';
  };
  
  const firstName = studentData?.name ? getFirstName(studentData.name) : (profile?.name ? getFirstName(profile.name) : 'Student');
  const isLoading = profileLoading || studentLoading;
  
  // Calculate next session
  const nextSession = useMemo(() => {
    if (!studentData?.main_center || !studentData?.grade || !centers || centers.length === 0) {
      return null;
    }
    
    // Find the student's center
    const studentCenter = centers.find(c => 
      c.name && studentData.main_center && 
      c.name.toLowerCase().trim() === studentData.main_center.toLowerCase().trim()
    );
    
    if (!studentCenter || !studentCenter.grades || studentCenter.grades.length === 0) {
      return null;
    }
    
    // Find the student's grade
    const studentGrade = (studentData.grade || '').trim();
    const gradeData = studentCenter.grades.find(g => 
      (g.grade || '').trim().toLowerCase() === studentGrade.toLowerCase()
    );
    
    if (!gradeData || !gradeData.timings || gradeData.timings.length === 0) {
      return null;
    }
    
    // Day names mapping
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Get current date and time
    const now = new Date();
    const currentDayIndex = now.getDay();
    const currentDayName = dayNames[currentDayIndex];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Minutes since midnight
    
    // Helper function to parse time (e.g., "2:30 PM" or "14:30")
    const parseTime = (timeStr, period) => {
      if (!timeStr || timeStr.trim() === '') return null;
      
      const [hours, minutes] = timeStr.split(':').map(s => parseInt(s.trim(), 10));
      if (isNaN(hours) || isNaN(minutes)) return null;
      
      let totalMinutes = hours * 60 + minutes;
      
      // Handle AM/PM period
      if (period) {
        const periodUpper = period.toUpperCase();
        if (periodUpper === 'PM' && hours !== 12) {
          totalMinutes += 12 * 60;
        } else if (periodUpper === 'AM' && hours === 12) {
          totalMinutes -= 12 * 60;
        }
      }
      
      return totalMinutes;
    };
    
    // Helper function to get day index from day name
    const getDayIndex = (dayName) => {
      const normalized = dayName.trim().toLowerCase();
      for (let i = 0; i < dayNames.length; i++) {
        if (dayNames[i].toLowerCase() === normalized || dayNamesShort[i].toLowerCase() === normalized) {
          return i;
        }
      }
      return -1;
    };
    
    // Find the next session
    let nextSessionDate = null;
    let nextTiming = null;
    
    // Sort timings by day and time for easier comparison
    const validTimings = gradeData.timings
      .filter(t => t.day && t.day.trim() !== '' && t.time && t.time.trim() !== '')
      .map(t => ({
        ...t,
        dayIndex: getDayIndex(t.day),
        timeMinutes: parseTime(t.time, t.period)
      }))
      .filter(t => t.dayIndex !== -1 && t.timeMinutes !== null)
      .sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return a.timeMinutes - b.timeMinutes;
      });
    
    if (validTimings.length === 0) {
      return null;
    }
    
    // Check if there's a session today or later this week
    for (const timing of validTimings) {
      const daysUntilSession = (timing.dayIndex - currentDayIndex + 7) % 7;
      const sessionTime = timing.timeMinutes;
      
      // If it's today and time hasn't passed, or it's a future day
      if (daysUntilSession === 0 && sessionTime >= currentTime) {
        // Session is today
        nextSessionDate = new Date(now);
        nextSessionDate.setHours(Math.floor(sessionTime / 60), sessionTime % 60, 0, 0);
        nextTiming = timing;
        break;
      } else if (daysUntilSession > 0) {
        // Session is in the future
        nextSessionDate = new Date(now);
        nextSessionDate.setDate(now.getDate() + daysUntilSession);
        nextSessionDate.setHours(Math.floor(sessionTime / 60), sessionTime % 60, 0, 0);
        nextTiming = timing;
        break;
      }
    }
    
    // If no session found this week, get the first one next week
    if (!nextSessionDate) {
      const firstTiming = validTimings[0];
      const daysUntilSession = (firstTiming.dayIndex - currentDayIndex + 7) % 7 || 7;
      nextSessionDate = new Date(now);
      nextSessionDate.setDate(now.getDate() + daysUntilSession);
      nextSessionDate.setHours(Math.floor(firstTiming.timeMinutes / 60), firstTiming.timeMinutes % 60, 0, 0);
      nextTiming = firstTiming;
    }
    
    if (!nextSessionDate || !nextTiming) {
      return null;
    }
    
    // Format the date
    const isToday = nextSessionDate.toDateString() === now.toDateString();
    const isTomorrow = nextSessionDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
    
    let dateDisplay = '';
    if (isToday) {
      dateDisplay = 'Today';
    } else if (isTomorrow) {
      dateDisplay = 'Tomorrow';
    } else {
      const dayName = dayNames[nextSessionDate.getDay()];
      const dateStr = nextSessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateDisplay = `${dayName}, ${dateStr}`;
    }
    
    // Format time
    const timeStr = nextTiming.time;
    const period = nextTiming.period || '';
    const timeDisplay = `${timeStr} ${period}`.trim();
    
    return {
      center: studentCenter.name,
      location: studentCenter.location || '',
      day: nextTiming.day,
      time: timeDisplay,
      date: dateDisplay,
      dateObj: nextSessionDate
    };
  }, [studentData, centers]);

  return (
    <div className="student-dashboard-wrapper" style={{ 
      padding: "35px 35px 20px 35px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      <div className="main-container" style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "16px",
            marginBottom: "15px"
          }}>
          </div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .welcome-message {
            width: 450px;
            max-width: 100%;
          }
          
          .dashboard-btn {
            width: 100%;
            margin-bottom: 16px;
            padding: 16px 0;
            background: linear-gradient(90deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            letter-spacing: 1px;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .dashboard-btn:hover {
            background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }
          
          @media (max-width: 768px) {
            .welcome-message {
              width: 100%;
              max-width: 100%;
            }
            .next-session-reminder {
              max-width: 100% !important;
            }
            .main-container {
              max-width: 100% !important;
              padding: 0 10px !important;
              margin: 0 !important;
            }
            .dashboard-btn {
              padding: 16px 0;
              font-size: 1.1rem;
            }
            h1 {
              font-size: 1.8rem !important;
            }
          }
          
          @media (max-width: 480px) {
            .welcome-message {
              width: 100%;
              max-width: 100%;
              padding: 16px;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .next-session-reminder {
              padding: 14px !important;
              max-width: 100% !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .next-session-reminder > div:first-child {
              gap: 10px !important;
              margin-bottom: 10px !important;
            }
            .next-session-reminder > div:first-child > div:first-child > span {
              font-size: 16px !important;
            }
            .next-session-reminder > div:first-child > div:last-child > div:first-child {
              font-size: 0.7rem !important;
            }
            .next-session-reminder > div:first-child > div:last-child > div:last-child {
              font-size: 0.9rem !important;
            }
            .next-session-reminder > div:last-child {
              font-size: 0.85rem !important;
              gap: 6px !important;
              padding-top: 10px !important;
            }
            .main-container {
              max-width: 100%;
              margin: 0 !important;
              padding: 0 5px;
              text-align: center;
            }
            .dashboard-btn {
              padding: 14px 0;
              font-size: 1.1rem;
              margin-bottom: 18px;
            }
            h1 {
              font-size: 1.5rem !important;
            }
            .student-dashboard-wrapper {
              padding: 15px 5px 10px 5px !important;
            }
          }
          
          @media (max-width: 768px) {
            .student-dashboard-wrapper {
              padding: 20px 20px 15px 20px !important;
            }
          }
        `}</style>
        
        <div style={{ marginTop: 30, marginBottom: 20 }}>
          {isLoading ? (
            <div style={{
              minHeight: "50vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px"
            }}>
              <div style={{
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "16px",
                padding: "40px",
                textAlign: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
              }}>
                <p style={{ color: "#666", fontSize: "1rem", marginBottom: "20px" }}>Loading...</p>
                <div style={{
                  width: "50px",
                  height: "50px",
                  border: "4px solid rgba(31, 168, 220, 0.2)",
                  borderTop: "4px solid #1FA8DC",
                  borderRadius: "50%",
                  margin: "0 auto",
                  animation: "spin 1s linear infinite"
                }} />
              </div>
            </div>
          ) : (
            <>
              <div className="welcome-message" style={{
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                color: "#ffffff",
                margin: "0 auto 20px auto",
              }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Welcome, {firstName}!</h2>
              </div>

              {/* Next Session Reminder */}
              {nextSession && (
                <div className="next-session-reminder" style={{
                  background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%)",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "20px",
                  margin: "0 auto 20px auto",
                  maxWidth: "450px",
                  width: "100%",
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.3)"
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px"
                  }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(31, 168, 220, 0.3)"
                    }}>
                      <span style={{ fontSize: "18px" }}>📅</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: "0.75rem",
                        color: "#484a4f",
                        fontWeight: "600",
                        marginBottom: "2px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px"
                      }}>
                        Next Session
                      </div>
                      <div style={{
                        fontSize: "1rem",
                        color: "#333",
                        fontWeight: "700",
                        wordBreak: "break-word"
                      }}>
                        {nextSession.date} • {nextSession.time}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "0.9rem",
                    color: "#495057",
                    paddingTop: "12px",
                    borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                    flexWrap: "wrap"
                  }}>
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>🏢</span>
                    <span style={{ fontWeight: "500" }}>{nextSession.center}</span>
                    {nextSession.location && nextSession.location.trim() !== '' && (
                      <>
                        <span style={{ color: "#47494f", margin: "0 4px" }}>•</span>
                        <a
                          href={nextSession.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#1FA8DC",
                            textDecoration: "none",
                            fontWeight: "500",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            transition: "color 0.2s ease",
                            wordBreak: "break-word"
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.color = "#17a2b8";
                            e.target.style.textDecoration = "underline";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.color = "#1FA8DC";
                            e.target.style.textDecoration = "none";
                          }}
                        >
                          <span style={{ fontSize: "14px", flexShrink: 0 }}>📍</span>
                          <span>Location</span>
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}

              <button 
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/my_info")}
              >
                📋 My Information
              </button>

              <button
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/online_sessions")}
              >
                <Image src="/play-pause.svg" alt="Play Pause" width={20} height={20} />
                Online Sessions
              </button>

              <button
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/my_homeworks")}
              >
                📚 My Homeworks
              </button>

              <button
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/my_quizzes")}
              >
                📝 My Quizzes
              </button>

              <button
                className="dashboard-btn"
                onClick={() => router.push("/student_dashboard/centers-schedule")}
              >
                🏢 Centers Schedule
              </button>
              <button
                className="dashboard-btn"
                onClick={() => router.push("/contact_assistants")}
              >
                📞 Contact Assistants
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

