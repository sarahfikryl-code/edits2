import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const studentId = parseInt(id);
  const { comment, lesson } = req.body;

  if (!lesson) {
    return res.status(400).json({ error: 'lesson is required' });
  }
  if (isNaN(studentId)) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Verify authentication
    await authMiddleware(req);

    // Validate student and lessons
    const student = await db.collection('students').findOne({ id: studentId });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Ensure lessons object exists
    if (!student.lessons) {
      await db.collection('students').updateOne(
        { id: studentId },
        { $set: { lessons: {} } }
      );
    }

    // Update comment in the selected lesson
    await db.collection('students').updateOne(
      { id: studentId },
      { $set: { [`lessons.${lesson}.comment`]: (comment && String(comment).trim() !== '') ? String(comment).trim() : null } }
    );

    return res.json({ success: true });
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    console.error('Error updating lesson comment:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}


