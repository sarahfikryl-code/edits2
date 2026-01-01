import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

// Color function for bars based on percentage
function getBarColor(percentage) {
  // Red for 0% or < 50% (remove yellow)
  if (percentage === 0) return '#a71e2a'; // Darker red for 0% (not answered)
  if (percentage < 50) return '#dc3545'; // Red for < 50%
  if (percentage < 70) return '#17a2b8'; // Blue for 50-70%
  return '#28a745'; // Green for >= 70%
}

export default function QuizPerformanceChart({ chartData, height = 500 }) {
  const data = useMemo(() => {
    if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }
    return chartData.map(item => ({
      week: item.week || `Week ${item.weekNumber}`,
      percentage: item.percentage || 0,
      weekNumber: item.weekNumber,
      result: item.result || '0 / 0' // Include result from API
    }));
  }, [chartData]);

  if (!data.length) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6c757d',
        fontSize: '1.1rem',
        fontWeight: '500',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        📊 No quiz data to display yet
      </div>
    );
  }

  return (
    <>
      <div className="quiz-chart-container" style={{ width: '100%', height: height }}>
        <ResponsiveContainer>
          <BarChart 
          data={data} 
          margin={{ top: 20, right: 10, left: 10, bottom: 50 }}
        >
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis 
              dataKey="week" 
              stroke="#6c757d"
              fontSize={12}
              tick={{ fill: '#495057', fontSize: 14 }}
              interval={0} 
              angle={-20} 
              textAnchor="end" 
              height={50}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#495057', fontSize: 14 }}
              stroke="#6c757d"
              label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft', offset: -5, style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '0.875rem'
              }}
              formatter={(value, name, props) => {
                const week = props.payload.week;
                const percentage = value.toFixed(1);
                const result = props.payload.result || '0 / 0';
                return [
                  <div key="tooltip" style={{ color: '#000000' }}>
                    <div><strong style={{ color: '#000000' }}>Week:</strong> {week}</div>
                    <div><strong style={{ color: '#000000' }}>Percentage:</strong> {percentage}%</div>
                    <div><strong style={{ color: '#000000' }}>Result:</strong> {result}</div>
                  </div>
                ];
              }}
              labelStyle={{ display: 'none' }}
            />
            <Bar 
              dataKey="percentage" 
              radius={[6, 6, 0, 0]} 
              maxBarSize={50}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.percentage)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <style jsx global>{`
        @media (max-width: 768px) {
          .quiz-chart-container {
            height: 350px !important;
          }
          .quiz-chart-container .recharts-cartesian-axis-tick text {
            font-size: 11px !important;
          }
          .quiz-chart-container .recharts-label {
            font-size: 11px !important;
          }
        }
        
        @media (max-width: 480px) {
          .quiz-chart-container {
            height: 320px !important;
          }
          .quiz-chart-container .recharts-cartesian-axis-tick text {
            font-size: 10px !important;
          }
          .quiz-chart-container .recharts-label {
            font-size: 10px !important;
          }
        }
        
        @media (max-width: 360px) {
          .quiz-chart-container {
            height: 280px !important;
          }
          .quiz-chart-container .recharts-cartesian-axis-tick text {
            font-size: 9px !important;
          }
          .quiz-chart-container .recharts-label {
            font-size: 9px !important;
          }
        }
      `}</style>
    </>
  );
}

