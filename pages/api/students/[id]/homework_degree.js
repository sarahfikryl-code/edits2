import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { lessons } from '../../../../constants/lessons.js';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const student_id = parseInt(id);
  const { homework_degree, lesson } = req.body;
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Get the current student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Determine which lesson to update
    const lessonName = lesson || lessons[0];
    
    // Ensure the lessons object exists and has the lesson entry
    if (!student.lessons || typeof student.lessons !== 'object') {
      await db.collection('students').updateOne(
        { id: student_id },
        { $set: { lessons: {} } }
      );
    }
    
    // Update the homework degree for the specific lesson
    const result = await db.collection('students').updateOne(
      { id: student_id },
      { $set: { [`lessons.${lessonName}.homework_degree`]: homework_degree } }
    );
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Student not found' });
    
    console.log('✅ Homework degree updated for student', student_id, 'lesson', lessonName, 'to', homework_degree);
    res.json({ success: true });
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error updating homework degree:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
}
