import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import NeedHelp from '../../../components/NeedHelp';
import QuizPerformanceChart from '../../../components/QuizPerformanceChart';

export default function MyQuizzes() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [completedQuizzes, setCompletedQuizzes] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  
  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_quizzes', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch quizzes
  const { data: quizzesData, isLoading } = useQuery({
    queryKey: ['quizzes-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/quizzes/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const quizzes = quizzesData?.quizzes || [];

  // Fetch quiz performance chart data - always fetch even if no quizzes
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['quiz-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/quiz-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching quiz performance:', error);
        return { chartData: [] }; // Return empty array on error
      }
    },
    enabled: !!profile?.id,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1, // Retry once on failure
  });

  const chartData = performanceData?.chartData || [];

  // Refetch chart data when returning to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Invalidate and refetch chart data when route changes
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['quiz-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['quiz-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
    }

    // Listen for route changes
    router.events.on('routeChangeComplete', handleRouteChange);
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, queryClient, profile?.id, refetchChart]);

  // Check which quizzes have been completed
  useEffect(() => {
    if (!profile?.id || quizzes.length === 0) return;

    const checkCompletions = async () => {
      const completed = new Set();
      for (const quiz of quizzes) {
        try {
          const response = await apiClient.get(`/api/students/${profile.id}/check-quiz?quiz_id=${quiz._id}`);
          if (response.data.success && response.data.hasResult) {
            completed.add(quiz._id);
          }
        } catch (err) {
          // Silently fail - just don't show Details button
        }
      }
      setCompletedQuizzes(completed);
    };

    checkCompletions();
  }, [profile?.id, quizzes]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">My Quizzes</Title>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #f5c6cb',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {errorMessage}
            </div>
          )}
          
          {/* White Background Container */}
          <div className="quizzes-container" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(31, 168, 220, 0.2)",
              borderTop: "4px solid #1FA8DC",
              borderRadius: "50%",
              margin: "0 auto 20px",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading quizzes...</p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/student_dashboard">My Quizzes</Title>

        {/* Quiz Performance Chart - Outside container, under Title */}
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 20px 0',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#212529'
          }}>
            Quiz Performance by Week
          </h2>
          {isChartLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Loading chart data...
            </div>
          ) : (
            <QuizPerformanceChart chartData={chartData} height={400} />
          )}
        </div>

        {/* White Background Container */}
        <div className="quizzes-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Quizzes List */}
          {quizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              ❌ No quizzes available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {quizzes.map((quiz) => (
                <div
                  key={quiz._id}
                  className="quiz-item"
                  style={{
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1FA8DC';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e9ecef';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>
                      {[quiz.week !== undefined && quiz.week !== null ? `Week ${quiz.week}` : null, quiz.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{quiz.questions?.length || 0} Question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                        {quiz.timer ? `Timer ${quiz.timer} minute${quiz.timer !== 1 ? 's' : ''}` : 'No Timer'}
                      </span>
                    </div>
                  </div>
                  <div className="quiz-buttons" style={{ display: 'flex', gap: '12px' }}>
                    {completedQuizzes.has(quiz._id) ? (
                      <>
                        <button
                          onClick={() => router.push(`/student_dashboard/my_quizzes/details?id=${quiz._id}`)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#0d5a7a';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#1FA8DC';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <Image src="/details.svg" alt="Details" width={18} height={18} />
                          Details
                        </button>
                        <button
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            cursor: 'default',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          ✅ Done
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => router.push(`/student_dashboard/my_quizzes/start?id=${quiz._id}`)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#218838';
                          e.target.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#28a745';
                          e.target.style.transform = 'translateY(0)';
                        }}
                      >
                        <Image src="/play.svg" alt="Play" width={16} height={16} />
                        Start
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            margin: 20px auto;
            padding: 8px;
          }
          .quizzes-container {
            padding: 16px;
          }
          .quiz-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .quiz-buttons {
            width: 100%;
          }
          .quiz-buttons button {
            width: 100%;
            justify-content: center;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
            padding: 5px;
          }
          .quizzes-container {
            padding: 12px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 12px !important;
          }
        }
        @media (max-width: 360px) {
          .quizzes-container {
            padding: 10px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 10px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
          }
        }
      `}</style>
    </div>
  );
}

