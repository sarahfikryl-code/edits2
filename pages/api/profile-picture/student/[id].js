import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { getSignedImageUrlServer } from '../../../../lib/cloudinary';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

console.log('🔗 Profile Picture API - Env Config:', {
  hasMongoUri: !!envConfig.MONGO_URI,
  hasDbName: !!envConfig.DB_NAME,
  mongoUri: MONGO_URI,
  dbName: DB_NAME
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (admin/assistant/developer only)
    const user = await authMiddleware(req);
    
    // Only allow admin, assistant, or developer to view student profile pictures
    if (user.role !== 'admin' && user.role !== 'assistant' && user.role !== 'developer') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    let client;
    try {
      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);
      
      // Get student's profile_picture public_id from users collection
      // Convert id to number (students collection uses numeric IDs)
      const userId = /^\d+$/.test(id) ? Number(id) : id;
      
      console.log('🔍 Looking for student profile picture:', { 
        originalId: id, 
        userId,
        idType: typeof id,
        userIdType: typeof userId
      });
      
      // Find user with numeric ID (ID is stored as number in users collection)
      const userDoc = await db.collection('users').findOne(
        { 
          id: userId,
          role: 'student'
        },
        { projection: { profile_picture: 1, id: 1, role: 1 } }
      );
      
      console.log('📋 User document found:', { 
        found: !!userDoc, 
        hasProfilePicture: !!userDoc?.profile_picture,
        profilePicture: userDoc?.profile_picture,
        userId: userDoc?.id
      });
      
      if (!userDoc || !userDoc.profile_picture) {
        console.log('❌ No profile picture found for student:', id);
        return res.status(200).json({ url: null });
      }
      
      // Generate signed URL
      console.log('🖼️ Generating signed URL for:', userDoc.profile_picture);
      const signedUrl = await getSignedImageUrlServer(userDoc.profile_picture);
      
      if (!signedUrl) {
        console.error('❌ Failed to generate signed URL');
        return res.status(500).json({ error: 'Failed to generate image URL' });
      }
      
      console.log('✅ Signed URL generated successfully');
      res.status(200).json({ url: signedUrl });
      
    } finally {
      if (client) await client.close();
    }
    
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (error.message === 'Forbidden') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    console.error('Error getting student profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

