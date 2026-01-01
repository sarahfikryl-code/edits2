import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const student_id = parseInt(id);

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - allow students to view their own results, or admins/assistants/developers to view any student
    const user = await authMiddleware(req);
    const userId = user.assistant_id || user.id; // JWT contains assistant_id for students
    
    // Students can only view their own results
    if (user.role === 'student' && userId !== student_id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own results' });
    }
    
    // Admins, assistants, and developers can view any student's results
    if (!['student', 'admin', 'assistant', 'developer'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student's grade
    const studentGrade = student.grade;
    if (!studentGrade) {
      // If student has no grade, return empty array
      return res.json({ 
        success: true,
        chartData: []
      });
    }

    // Get all homework results
    const onlineHomeworks = student.online_homeworks || [];
    
    // Create a map of homework_id to result data (percentage and result string)
    // Store with both original format and normalized ObjectId format for matching
    const resultMap = {};
    onlineHomeworks.forEach(hwResult => {
      if (hwResult.homework_id) {
        const hwIdOriginal = hwResult.homework_id.toString();
        const percentage = parseInt(hwResult.percentage?.toString().replace('%', '') || '0');
        const result = hwResult.result || '0 / 0'; // Format: "8 / 10"
        const resultData = { percentage, result };
        
        // Store with original format
        resultMap[hwIdOriginal] = resultData;
        
        // Also store with normalized ObjectId format if it's a valid ObjectId
        if (ObjectId.isValid(hwIdOriginal)) {
          try {
            const objId = new ObjectId(hwIdOriginal);
            resultMap[objId.toString()] = resultData;
          } catch (e) {
            // Ignore conversion errors
          }
        }
      }
    });

    // Get ALL homeworks for this student's grade (not just completed ones)
    const normalizedStudentGrade = studentGrade.toLowerCase().replace(/\./g, '').trim();
    const allHomeworks = await db.collection('homeworks').find({}).toArray();
    
    // Filter homeworks by normalized grade
    const filteredHomeworks = allHomeworks.filter(hw => {
      if (!hw.grade || !hw.week) return false; // Only include homeworks with grade and week
      const normalizedHwGrade = hw.grade.toLowerCase().replace(/\./g, '').trim();
      return normalizedHwGrade === normalizedStudentGrade;
    });

    // Group all homeworks by week - show result directly from DB (no aggregation)
    // If multiple homeworks in same week, prioritize completed ones
    const weekDataMap = {};
    
    filteredHomeworks.forEach(homework => {
      const week = homework.week;
      // Normalize homework._id to string for matching
      const hwIdStr = homework._id.toString();
      // Find result data - should match since we stored both formats
      const resultData = resultMap[hwIdStr];
      
      if (!weekDataMap[week]) {
        weekDataMap[week] = {
          weekNumber: week,
          week: `Week ${week}`,
          percentage: 0,
          result: '0 / 0'
        };
      }
      
      // If there's a result for this homework, use it directly (don't aggregate)
      // Prioritize completed results (non-zero percentage) over incomplete ones
      if (resultData) {
        const isCompleted = resultData.percentage > 0;
        const currentIsCompleted = weekDataMap[week].percentage > 0;
        
        // Use this result if: it's completed, or if current is not completed
        if (isCompleted || !currentIsCompleted) {
          weekDataMap[week].percentage = resultData.percentage;
          weekDataMap[week].result = resultData.result; // Show result from DB as-is
        }
      }
    });

    // Convert to array and sort by week number
    const chartData = Object.values(weekDataMap)
      .sort((a, b) => a.weekNumber - b.weekNumber);

    // Always return success with chartData (empty array if no data)
    res.json({ 
      success: true,
      chartData: chartData
    });
  } catch (error) {
    console.error('❌ Error fetching homework performance:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

