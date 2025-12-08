import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

// Load environment variables from env.config
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
          value = value.replace(/^"|"$/g, ''); // strip quotes
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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

console.log('🔗 Using Mongo URI:', MONGO_URI);

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  let client;
  let db;
  try {
    console.log('📋 History API called - optimizing for large datasets...');
    
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    console.log('🔗 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);
    console.log('✅ Connected to database:', DB_NAME);
    
    // Verify authentication
    console.log('🔐 Authenticating user...');
    const user = await authMiddleware(req);
    console.log('✅ User authenticated:', user.assistant_id || user.id);
    
    // Optimized approach: Use aggregation pipeline to join data at database level
    console.log('📊 Building optimized aggregation pipeline...');
    
    const pipeline = [
      // Match all history records
      { $match: {} },
      
      // Lookup students data with projection to only get needed fields
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: 'id',
          as: 'student',
          pipeline: [
            {
              $project: {
                id: 1,
                name: 1,
                grade: 1,
                course: 1,
                courseType: 1,
                school: 1,
                phone: 1,
                parentsPhone: 1,
                parentsPhone1: 1,
                main_center: 1,
                main_comment: 1,
                comment: 1,
                lessons: 1
              }
            }
          ]
        }
      },
      
      // Unwind student array (should be single student)
      { $unwind: '$student' },
      
      // Add computed fields for the specific lesson
      {
        $addFields: {
          lessonData: {
            $cond: {
              if: {
                $and: [
                  { $ne: ['$student.lessons', null] },
                  { $ne: ['$student.lessons', undefined] }
                ]
              },
              then: {
                $cond: {
                  if: { $isArray: '$student.lessons' },
                  then: {
                    // Handle old array format - find by lesson name
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$student.lessons',
                          cond: { $eq: ['$$this.lesson', '$lesson'] }
                        }
                      },
                      0
                    ]
                  },
                  else: {
                    // Handle new object format - use $objectToArray to convert to array and find matching lesson
                    $getField: {
                      field: 'v',
                      input: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: { $objectToArray: '$student.lessons' },
                              cond: { $eq: ['$$this.k', '$lesson'] }
                            }
                          },
                          0
                        ]
                      }
                    }
                  }
                }
              },
              else: null
            }
          }
        }
      },
      
      // Filter out records where lesson data doesn't exist or student didn't attend
      {
        $match: {
          'lessonData.attended': true
        }
      },
      
      // Project the final structure
      {
        $project: {
          studentId: 1,
          lesson: 1,
          student: {
            id: '$student.id',
            name: '$student.name',
            grade: { $toUpper: { $ifNull: ['$student.course', '$student.grade'] } },
            course: { $toUpper: { $ifNull: ['$student.course', '$student.grade'] } },
            courseType: '$student.courseType',
            school: '$student.school',
            phone: '$student.phone',
            parentsPhone: { $ifNull: ['$student.parentsPhone', '$student.parentsPhone1'] },
            main_center: '$student.main_center',
            main_comment: { $ifNull: ['$student.main_comment', '$student.comment'] },
            lessons: '$student.lessons'
          },
          historyRecord: {
            studentId: 1,
            lesson: { $ifNull: ['$lesson', 1] }, // Ensure lesson is always present
            main_center: '$student.main_center',
            center: { $ifNull: ['$lessonData.lastAttendanceCenter', 'n/a'] },
            attendanceDate: { $ifNull: ['$lessonData.lastAttendance', 'n/a'] },
            hwDone: { $ifNull: ['$lessonData.hwDone', false] },
            homework_degree: { $ifNull: ['$lessonData.homework_degree', null] },
            hwDegree: { $ifNull: ['$lessonData.hwDegree', null] },
            quizDegree: { $ifNull: ['$lessonData.quizDegree', null] },
            message_state: { $ifNull: ['$lessonData.message_state', false] },
            student_message_state: { $ifNull: ['$lessonData.student_message_state', false] },
            parent_message_state: { $ifNull: ['$lessonData.parent_message_state', false] }
          }
        }
      },
      
      // Sort by student ID and lesson
      { $sort: { 'student.id': 1, lesson: 1 } }
    ];
    
    console.log('🚀 Executing aggregation pipeline...');
    let aggregationResult;
    try {
      aggregationResult = await db.collection('history').aggregate(pipeline).toArray();
      console.log(`✅ Aggregation completed: ${aggregationResult.length} records`);
    } catch (aggregationError) {
      console.error('❌ Aggregation failed:', aggregationError);
      return res.status(500).json({ 
        error: 'Failed to fetch history data', 
        details: aggregationError.message 
      });
    }
    
    // Debug: Check first few records for lesson data
    if (aggregationResult.length > 0) {
      console.log('🔍 Sample record structure:', JSON.stringify(aggregationResult[0], null, 2));
    } else {
      console.log('🔍 No records found in aggregation result');
      // Let's check what's in the history collection
      const totalHistoryRecords = await db.collection('history').countDocuments();
      console.log(`📊 Total history records in collection: ${totalHistoryRecords}`);
      if (totalHistoryRecords > 0) {
        const sampleHistoryRecord = await db.collection('history').findOne();
        console.log('🔍 Sample history record:', JSON.stringify(sampleHistoryRecord, null, 2));
      }
    }
    
    // Group by student to match the expected frontend format
    const studentHistoryMap = new Map();
    
    // Process results in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < aggregationResult.length; i += batchSize) {
      const batch = aggregationResult.slice(i, i + batchSize);
      
      batch.forEach(item => {
        const studentId = item.student.id;
        
        if (!studentHistoryMap.has(studentId)) {
          studentHistoryMap.set(studentId, {
            id: item.student.id,
            name: item.student.name,
            grade: item.student.grade,
            courseType: item.student.courseType,
            school: item.student.school,
            phone: item.student.phone,
            parentsPhone: item.student.parentsPhone,
            main_comment: item.student.main_comment || '',
            lessons: Array.isArray(item.student.lessons) ? item.student.lessons : [],
          historyRecords: []
        });
      }
      
      // Ensure lesson is properly set in historyRecord
      const historyRecord = {
        ...item.historyRecord,
        lesson: item.historyRecord.lesson || 1 // Fallback to lesson 1 if not present
      };
      
      studentHistoryMap.get(studentId).historyRecords.push(historyRecord);
    });
  }
    
    // Convert map to array and sort by student ID
    const result = Array.from(studentHistoryMap.values()).sort((a, b) => a.id - b.id);
    
    console.log(`📈 Returning history for ${result.length} students with ${result.reduce((total, student) => total + student.historyRecords.length, 0)} attendance records`);
    res.json(result);
    
  } catch (error) {
    console.error('❌ History API error:', error);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch history data', 
      details: error.message 
    });
  } finally {
    if (client) await client.close();
  }
} 