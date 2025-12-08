import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { lessons } from '../../../constants/lessons.js';

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
  let client;
  let db;
  try {
    console.log('📋 Students API called - optimizing for large datasets...');
    
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
    
    if (req.method === 'GET') {
      // Check if pagination parameters are provided
      const { page, limit, search, grade, course, center, courseType, sortBy, sortOrder } = req.query;
      const hasPagination = page || limit;
      
      if (hasPagination) {
        // Paginated response for large datasets
        console.log('📊 Building paginated response...');
        
        // Parse pagination parameters
        const currentPage = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 50;
        const searchTerm = search ? search.trim() : '';
        const gradeFilter = (course ? course.trim() : (grade ? grade.trim() : ''));
        const centerFilter = center ? center.trim() : '';
        const courseTypeFilter = courseType ? courseType.trim() : '';
        const sortField = sortBy || 'id';
        const sortDirection = sortOrder === 'desc' ? -1 : 1;
        
        console.log('📋 Pagination params:', { currentPage, pageSize, searchTerm, gradeFilter, centerFilter, courseTypeFilter, sortField, sortDirection });
        
        // Build query filter
        const queryFilter = {};
        
        if (searchTerm.trim()) {
          const search = searchTerm.trim();
          const isNumeric = /^\d+$/.test(search);
          
          if (isNumeric) {
            // If search term is numeric
            if (search.length <= 4) {
              // 4 digits or less = ID search (exact match)
              const studentId = parseInt(search);
              if (!isNaN(studentId)) {
                queryFilter.id = studentId;
              }
            } else {
              // More than 4 digits = phone number search (student or parent)
              const phoneRegex = new RegExp(search, 'i');
              queryFilter.$or = [
                { phone: phoneRegex },
                { parentsPhone: phoneRegex },
                { parentsPhone2: phoneRegex }
              ];
            }
          } else {
            // Non-numeric search = text search in name and school
            const searchRegex = new RegExp(search, 'i');
            queryFilter.$or = [
              { name: searchRegex },
              { school: searchRegex }
            ];
          }
        }
        
        if (gradeFilter) {
          queryFilter.$or = [
            { course: { $regex: gradeFilter, $options: 'i' } },
            { grade: { $regex: gradeFilter, $options: 'i' } }
          ];
        }
        
        if (centerFilter) {
          queryFilter.main_center = { $regex: centerFilter, $options: 'i' };
        }
        
        if (courseTypeFilter) {
          queryFilter.courseType = { $regex: courseTypeFilter, $options: 'i' };
        }
        
        console.log('🔍 Query filter:', JSON.stringify(queryFilter, null, 2));
        
        // Get total count for pagination
        const totalCount = await db.collection('students').countDocuments(queryFilter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const skip = (currentPage - 1) * pageSize;
        
        console.log(`📊 Found ${totalCount} students matching filters`);
        console.log(`📄 Page ${currentPage} of ${totalPages} (${pageSize} per page)`);
        
        // Get students with projection for better performance
        const students = await db.collection('students')
          .find(queryFilter, {
            projection: {
              id: 1,
              name: 1,
              grade: 1,
              course: 1,
              courseType: 1,
              phone: 1,
              parentsPhone: 1,
              parentsPhone2: 1,
              address: 1,
              center: 1,
              main_center: 1,
              main_comment: 1,
              comment: 1,
              school: 1,
              age: 1,
              account_state: 1,
              weeks: 1,
              payment: 1
            }
          })
          .sort({ [sortField]: sortDirection })
          .skip(skip)
          .limit(pageSize)
          .toArray();
        
        console.log(`✅ Retrieved ${students.length} students for page ${currentPage}`);
        
        // Process students in batches to avoid memory issues
        const batchSize = 100;
        const mappedStudents = [];
        
        for (let i = 0; i < students.length; i += batchSize) {
          const batch = students.slice(i, i + batchSize);
          
          const batchMapped = batch.map(student => {
            // Find the current week (last attended week or week 1 if none)
            const hasWeeks = Array.isArray(student.weeks) && student.weeks.length > 0;
            const currentWeek = hasWeeks ?
              (student.weeks.find(w => w && w.attended) || student.weeks.find(w => w) || student.weeks[0]) :
              { week: 1, attended: false, lastAttendance: null, lastAttendanceCenter: null, hwDone: false, quizDegree: null, message_state: false, student_message_state: false, parent_message_state: false };
            
            // Robust null checks for currentWeek
            const safeCurrentWeek = currentWeek || { 
              week: 1, 
              attended: false, 
              lastAttendance: null, 
              lastAttendanceCenter: null, 
              hwDone: false, 
              quizDegree: null, 
              message_state: false,
              student_message_state: false,
              parent_message_state: false
            };
            
            const courseOrGrade = (student.course ?? student.grade) ?? null;
            const normalizedCourse = courseOrGrade ? String(courseOrGrade).toUpperCase() : null;
            return {
              id: student.id,
              name: student.name,
              grade: normalizedCourse, // keep frontend compatibility
              course: normalizedCourse,
              courseType: student.courseType || null,
              phone: student.phone,
              parents_phone: student.parentsPhone,
              parentsPhone2: student.parentsPhone2 || null,
              address: student.address || null,
              center: student.center,
              main_center: student.main_center,
              main_comment: (student.main_comment ?? student.comment ?? null),
              attended_the_session: safeCurrentWeek.attended || false,
              lastAttendance: safeCurrentWeek.lastAttendance || null,
              lastAttendanceCenter: safeCurrentWeek.lastAttendanceCenter || null,
              attendanceWeek: `week ${String(safeCurrentWeek.week || 1).padStart(2, '0')}`,
              hwDone: safeCurrentWeek.hwDone || false,
              quizDegree: safeCurrentWeek.quizDegree || null,
              school: student.school || null,
              age: student.age || null,
              message_state: safeCurrentWeek.message_state || false,
              student_message_state: safeCurrentWeek.student_message_state || false,
              parent_message_state: safeCurrentWeek.parent_message_state || false,
              account_state: student.account_state || "Activated",
              payment: student.payment || null,
              weeks: student.weeks || []
            };
          });
          
          mappedStudents.push(...batchMapped);
        }
        
        console.log(`📈 Returning ${mappedStudents.length} students for page ${currentPage}`);
        
        // Debug: Log payment data for first few students
        console.log('🔍 Payment data debug (paginated):');
        mappedStudents.slice(0, 3).forEach(student => {
          console.log(`Student ${student.id}: payment =`, student.payment);
        });
        
        res.json({
          data: mappedStudents,
          pagination: {
            currentPage,
            pageSize,
            totalCount,
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
          },
          filters: {
            search: searchTerm,
            grade: gradeFilter,
            center: centerFilter,
            courseType: courseTypeFilter,
            sortBy: sortField,
            sortOrder: sortDirection === 1 ? 'asc' : 'desc'
          }
        });
        
      } else {
        // Original format for backward compatibility (optimized)
        console.log('📊 Building original format response (optimized)...');
        
        // Get all students with projection for better performance
        const students = await db.collection('students').find({}, {
          projection: {
            id: 1,
            name: 1,
            grade: 1,
            course: 1,
            courseType: 1,
            phone: 1,
            parentsPhone: 1,
            parentsPhone1: 1,
            parentsPhone2: 1,
            address: 1,
            center: 1,
            main_center: 1,
            main_comment: 1,
            comment: 1,
            school: 1,
            age: 1,
            account_state: 1,
            weeks: 1,
            lessons: 1,
            payment: 1
          }
        }).toArray();
        
        console.log(`📊 Found ${students.length} students`);
        
        // Process students in batches to avoid memory issues
        const batchSize = 100;
        const mappedStudents = [];
        
        for (let i = 0; i < students.length; i += batchSize) {
          const batch = students.slice(i, i + batchSize);
          
          const batchMapped = batch.map(student => {
            // Derive a basic attendance summary from lessons if present (fallback to weeks otherwise)
            let safeCurrent = { attended: false, lastAttendance: null, lastAttendanceCenter: null, hwDone: false, quizDegree: null, message_state: false, student_message_state: false, parent_message_state: false };
            if (student.lessons && typeof student.lessons === 'object' && !Array.isArray(student.lessons)) {
              const vals = Object.values(student.lessons);
              if (vals.length) {
                const attended = vals.filter(l => l && l.attended);
                const cur = attended.length ? attended[attended.length - 1] : vals[0];
                if (cur) safeCurrent = { attended: !!cur.attended, lastAttendance: cur.lastAttendance || null, lastAttendanceCenter: cur.lastAttendanceCenter || null, hwDone: !!cur.hwDone, quizDegree: cur.quizDegree ?? null, message_state: !!cur.message_state, student_message_state: !!cur.student_message_state, parent_message_state: !!cur.parent_message_state };
              }
            } else if (Array.isArray(student.lessons)) {
              const attended = student.lessons.filter(l => l && l.attended);
              const cur = attended.length ? attended[attended.length - 1] : student.lessons[0];
              if (cur) safeCurrent = { attended: !!cur.attended, lastAttendance: cur.lastAttendance || null, lastAttendanceCenter: cur.lastAttendanceCenter || null, hwDone: !!cur.hwDone, quizDegree: cur.quizDegree ?? null, message_state: !!cur.message_state, student_message_state: !!cur.student_message_state, parent_message_state: !!cur.parent_message_state };
            } else if (Array.isArray(student.weeks) && student.weeks.length) {
              const attended = student.weeks.filter(w => w && w.attended);
              const cur = attended.length ? attended[attended.length - 1] : student.weeks[0];
              if (cur) safeCurrent = { attended: !!cur.attended, lastAttendance: cur.lastAttendance || null, lastAttendanceCenter: cur.lastAttendanceCenter || null, hwDone: !!cur.hwDone, quizDegree: cur.quizDegree ?? null, message_state: !!cur.message_state, student_message_state: !!cur.student_message_state, parent_message_state: !!cur.parent_message_state };
            }
            
            const courseOrGrade = (student.course ?? student.grade) ?? null;
            const normalizedCourse = courseOrGrade ? String(courseOrGrade).toUpperCase() : null;
            return {
              id: student.id,
              name: student.name,
              grade: normalizedCourse,
              course: normalizedCourse,
              courseType: student.courseType || null,
              phone: student.phone,
              parents_phone: (student.parentsPhone1 || student.parentsPhone || null),
              parentsPhone2: student.parentsPhone2 || null,
              address: student.address || null,
              center: student.center,
              main_center: student.main_center,
              main_comment: (student.main_comment ?? student.comment ?? null),
              attended_the_session: safeCurrent.attended || false,
              lastAttendance: safeCurrent.lastAttendance || null,
              lastAttendanceCenter: safeCurrent.lastAttendanceCenter || null,
              hwDone: safeCurrent.hwDone || false,
              quizDegree: safeCurrent.quizDegree || null,
              school: student.school || null,
              age: student.age || null,
              message_state: safeCurrent.message_state || false,
              student_message_state: safeCurrent.student_message_state || false,
              parent_message_state: safeCurrent.parent_message_state || false,
              account_state: student.account_state || "Activated",
              payment: student.payment || null,
              weeks: student.weeks || [],
              lessons: student.lessons || {}
            };
          });
          
          mappedStudents.push(...batchMapped);
        }
        
        console.log(`📈 Returning ${mappedStudents.length} students in original format`);
        
        // Debug: Log payment data for first few students
        console.log('🔍 Payment data debug:');
        mappedStudents.slice(0, 3).forEach(student => {
          console.log(`Student ${student.id}: payment =`, student.payment);
        });
        
        res.json(mappedStudents);
      }
    } else if (req.method === 'POST') {
      // Add new student
      const { name, grade, course, courseType, phone, parents_phone, parents_phone2, address, main_center, school, main_comment, comment, account_state } = req.body;
      const normalizedCourse = (course || grade) ? String(course || grade).toUpperCase() : '';
      if (!name || !normalizedCourse || !courseType || !phone || !parents_phone || !parents_phone2 || !address || !main_center || !school) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      
      // Generate new student ID automatically
      // Find the highest existing ID and increment by 1
      const lastStudent = await db.collection('students').findOne({}, { sort: { id: -1 } });
      const newId = lastStudent ? lastStudent.id + 1 : 1;
      
      // Create empty lessons object for new students
      const lessonsObject = {};
      
      const student = {
        id: newId,
        name,
        course: normalizedCourse,
        courseType: courseType ? courseType.charAt(0).toUpperCase() + courseType.slice(1).toLowerCase() : courseType,
        school,
        phone,
        parentsPhone1: parents_phone,
        parentsPhone2: parents_phone2,
        address: address,
        main_center,
        main_comment: (main_comment ?? comment ?? null),
        account_state: account_state || "Activated", // Default to Activated
        lessons: lessonsObject,
        payment: {
          numberOfSessions: null,
          cost: null,
          paymentComment: null,
          date: null
        },
        mockExams: [
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null },
          { examDegree: null, outOf: null, percentage: null, date: null }
        ],
      };
      await db.collection('students').insertOne(student);
      res.json({ id: newId });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Students API error:', error);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch student data', 
      details: error.message 
    });
  } finally {
    if (client) await client.close();
  }
} 