import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { getCookieValue } from '../../../lib/cookies';
import { authMiddleware } from "../../../lib/authMiddleware";
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
  const { id } = req.query;
  const idStr = String(id || '').trim();
  const isNumericId = /^[0-9]+$/.test(idStr);
  const student_id = isNumericId ? parseInt(idStr, 10) : null;
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    if (req.method === 'GET') {
      // Get student info by id or phone (student or parent)
      let student = null;
      const normalized = idStr.replace(/[^0-9]/g, '');
      if (student_id !== null && idStr.length < 10) {
        // Short numeric token -> most likely ID; try ID first
        student = await db.collection('students').findOne({ id: student_id });
      }
      if (!student && normalized) {
        // Try phone search (11-digit local numbers)
        student = await db.collection('students').findOne({
          $or: [
            { phone: normalized },
            { parentsPhone: normalized },
            { parentsPhone1: normalized }
          ]
        });
      }
      if (!student) return res.status(404).json({ error: 'Student not found' });
      
      // Find the current lesson (last attended lesson or default if none)
      let currentLesson;
      if (student.lessons && typeof student.lessons === 'object') {
        const attendedLessons = Object.values(student.lessons).filter(l => l && l.attended);
        currentLesson = attendedLessons.length > 0 ? 
          attendedLessons[attendedLessons.length - 1] : 
          Object.values(student.lessons)[0];
      }
      if (!currentLesson) {
        currentLesson = { lesson: lessons[0], attended: false, lastAttendance: null, lastAttendanceCenter: null, hwDone: false, quizDegree: null, message_state: false };
      }
      
      let lastAttendance = currentLesson.lastAttendance;
      if (currentLesson.lastAttendance && currentLesson.lastAttendanceCenter) {
        // Try to parse the date part and reformat
        const dateMatch = currentLesson.lastAttendance.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
        let dateStr = currentLesson.lastAttendance;
        if (dateMatch) {
          dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
        }
        lastAttendance = `${dateStr} in ${currentLesson.lastAttendanceCenter}`;
      }
      
      const courseOrGrade = (student.course ?? student.grade) ?? null;
      const normalizedCourse = courseOrGrade ? String(courseOrGrade).toUpperCase() : null;
      res.json({
        id: student.id,
        name: student.name,
        grade: normalizedCourse,
        course: normalizedCourse, // alias for backward and new usage
        courseType: student.courseType || null,
        phone: student.phone,
        parents_phone: student.parentsPhone1 || student.parentsPhone, // Support both old and new field names
        center: student.center,
        main_center: student.main_center,
        main_comment: (student.main_comment ?? student.comment ?? null),
        attended_the_session: currentLesson.attended,
        lastAttendance: lastAttendance,
        lastAttendanceCenter: currentLesson.lastAttendanceCenter,
        attendanceLesson: currentLesson.lesson,
        hwDone: currentLesson.hwDone,
        homework_degree: currentLesson.homework_degree,
        school: student.school || null,
        parentsPhone2: (student.parentsPhone2 || student.parents_phone2 || null),
        address: student.address || null,
        age: student.age || null,
        quizDegree: currentLesson.quizDegree,
        message_state: currentLesson.message_state,
        student_message_state: currentLesson.student_message_state,
        parent_message_state: currentLesson.parent_message_state,
        account_state: student.account_state || "Activated", // Default to Activated
        lessons: student.lessons || [], // Include the full lessons array
        payment: student.payment || null, // Include payment data
        mockExams: student.mockExams && Array.isArray(student.mockExams) ? student.mockExams : Array(10).fill(null).map(() => ({
          examDegree: null,
          outOf: null,
          percentage: null,
          date: null
        })) // Include mock exam data
      });
    } else if (req.method === 'PUT') {
      // Edit student - handle partial updates properly
      const { name, grade, course, courseType, phone, parents_phone, parents_phone2, address, main_center, school, main_comment, comment, account_state } = req.body;
      
      // Build update object with only defined values (not null or undefined)
      const update = {};
      
      if (name !== undefined && name !== null) {
        update.name = name;
      }
      const normalizedCourse = (course !== undefined && course !== null) ? String(course).toUpperCase()
        : (grade !== undefined && grade !== null) ? String(grade).toUpperCase() : undefined;
      if (normalizedCourse !== undefined) {
        update.course = normalizedCourse;
        // Optionally remove legacy grade on write or keep for BC; we'll keep both for now
      }
      if (courseType !== undefined && courseType !== null) {
        update.courseType = courseType ? courseType.charAt(0).toUpperCase() + courseType.slice(1).toLowerCase() : courseType;
      }
      if (phone !== undefined && phone !== null) {
        update.phone = phone;
      }
      if (parents_phone !== undefined && parents_phone !== null) {
        update.parentsPhone1 = parents_phone;
      }
      if (parents_phone2 !== undefined && parents_phone2 !== null) {
        update.parentsPhone2 = parents_phone2;
      }
      if (address !== undefined && address !== null) {
        update.address = address;
      }
      if (main_center !== undefined && main_center !== null) {
        update.main_center = main_center;
      }
      if (school !== undefined && school !== null) {
        update.school = school;
      }
      if (main_comment !== undefined) {
        update.main_comment = main_comment; // allow null or string
      } else if (comment !== undefined) {
        // backward compat
        update.main_comment = comment;
      }
      if (account_state !== undefined && account_state !== null) {
        update.account_state = account_state;
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      const result = await db.collection('students').updateOne(
        { id: student_id },
        { $set: update }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Student not found' });
      res.json({ success: true });
    } else if (req.method === 'DELETE') {
      // Delete student
      const result = await db.collection('students').deleteOne({ id: student_id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Student not found' });
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 