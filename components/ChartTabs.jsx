import { useState, useMemo } from "react";
import HwChart from "./HwChart";
import QuizChart from "./QuizChart";
import MockExamChart from "./MockExamChart";

export default function ChartTabs({ lessons, mockExams }) {
  const [active, setActive] = useState('hw');

  const normalizedLessons = useMemo(() => {
    // Ensure lessons are in array of { lesson, homework_degree, quizDegree }
    if (!lessons) return [];
    return Object.keys(lessons).map((key) => ({
      lesson: key,
      ...(lessons[key] || {})
    }));
  }, [lessons]);

  const normalizedMockExams = useMemo(() => {
    // Ensure mockExams are in array format for chart
    if (!mockExams || !Array.isArray(mockExams)) return [];
    return mockExams.map((exam, index) => ({
      exam: `Exam ${index + 1}`,
      percentage: exam?.percentage || 0,
      examDegree: exam?.examDegree || 0,
      outOf: exam?.outOf || 0,
      date: exam?.date || null
    })).filter(exam => exam.percentage > 0 || exam.examDegree > 0);
  }, [mockExams]);

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <button
          onClick={() => setActive('hw')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px 0 0 0',
            border: active === 'hw' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'hw' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'hw' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Homeworks Chart
        </button>
        <button
          onClick={() => setActive('quiz')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '0',
            border: active === 'quiz' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'quiz' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'quiz' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Quizzes Chart
        </button>
        <button
          onClick={() => setActive('mock')}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '0 8px 8px 0',
            border: active === 'mock' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'mock' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'mock' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Mock Exams Chart
        </button>
      </div>

      <div style={{ background: 'white', border: '1px solid #dee2e6', borderRadius: 12, padding: 20 }}>
        {active === 'hw' ? (
          <HwChart lessons={normalizedLessons} />
        ) : active === 'quiz' ? (
          <QuizChart lessons={normalizedLessons} />
        ) : (
          <MockExamChart mockExams={normalizedMockExams} />
        )}
      </div>
    </div>
  );
}


