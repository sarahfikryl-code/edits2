import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';

export default function StudentDashboard() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  
  // Get student ID from profile and fetch student data
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData, isLoading: studentLoading } = useStudent(studentId, { enabled: !!studentId });
  
  // Extract first name from student name
  const getFirstName = (fullName) => {
    if (!fullName) return 'Student';
    const nameParts = fullName.trim().split(/\s+/);
    return nameParts[0] || 'Student';
  };
  
  const firstName = studentData?.name ? getFirstName(studentData.name) : (profile?.name ? getFirstName(profile.name) : 'Student');
  const isLoading = profileLoading || studentLoading;

  return (
    <div style={{ 
      padding: "35px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      <div className="main-container" style={{ maxWidth: 900, margin: "10px auto", textAlign: "center" }}>
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
            width: 400px;
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
              width: 350px;
              padding: 14px;
            }
            .main-container {
              max-width: 600px;
              margin: 20px auto !important;
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
          }
        `}</style>
        
        <div style={{ marginTop: 30 }}>
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

