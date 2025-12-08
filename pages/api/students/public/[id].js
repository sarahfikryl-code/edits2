import { MongoClient } from 'mongodb';
import { verifySignature } from '../../../../lib/hmac';
import fs from 'fs';
import path from 'path';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    // Try multiple possible paths for env.config
    const possiblePaths = [
      path.join(process.cwd(), '..', 'env.config'), // From frontend folder
      path.join(process.cwd(), '..', '..', 'env.config'), // From frontend/pages
      path.join(process.cwd(), '..', '..', '..', 'env.config'), // From frontend/pages/api
      path.join(process.cwd(), '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/students
      path.join(process.cwd(), '..', '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/students/public
      path.join(__dirname, '..', '..', '..', '..', '..', 'env.config'), // Using __dirname
    ];
    
    console.log('🔍 Current working directory:', process.cwd());
    console.log('🔍 Looking for env.config in multiple locations...');
    
    let envPath = null;
    for (const testPath of possiblePaths) {
      console.log('🔍 Testing path:', testPath);
      if (fs.existsSync(testPath)) {
        envPath = testPath;
        console.log('✅ Found env.config at:', envPath);
        break;
      }
    }
    
    if (!envPath) {
      throw new Error('env.config file not found in any expected location');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('✅ Successfully loaded env.config file');
    console.log('🔍 env.config content:', envContent);
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          envVars[key] = value;
          console.log(`🔍 Loaded env var: ${key} = ${value}`);
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('❌ Error loading env.config:', error.message);
    console.error('❌ Full error:', error);
    console.log('⚠️ Falling back to environment variables');
    return {};
  }
}

const envConfig = loadEnvConfig();

// Always use env.config file for MongoDB connection (both development and production)
// The server will have the proper MongoDB credentials in env.config
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/mr-ahmad-badr';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-ahmad-badr';

// Ensure we're using the correct URI format
console.log('🔍 Final MONGO_URI:', MONGO_URI);
console.log('🔍 Final DB_NAME:', DB_NAME);

console.log('🔍 envConfig loaded:', Object.keys(envConfig));
console.log('🔍 envConfig.MONGO_URI exists:', !!envConfig.MONGO_URI);
console.log('🔍 process.env.MONGO_URI exists:', !!process.env.MONGO_URI);

console.log('🔍 Using MongoDB URI from env.config file');
console.log('🔍 MongoDB URI (masked):', MONGO_URI.replace(/\/\/.*@/, '//***:***@'));
console.log('🔍 Database name:', DB_NAME);
console.log('🔍 Full MongoDB URI length:', MONGO_URI.length);
console.log('🔍 MongoDB URI starts with mongodb://:', MONGO_URI.startsWith('mongodb://'));
console.log('🔍 Full MongoDB URI:', MONGO_URI);
console.log('🔍 MongoDB URI type:', typeof MONGO_URI);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;
  const { sig } = req.query;

  // Verify HMAC signature
  if (!verifySignature(id, sig)) {
    console.log('❌ Public API: Invalid HMAC signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let client;
  try {
    console.log('🔍 Public API: Connecting to MongoDB with URI:', MONGO_URI.replace(/\/\/.*@/, '//***:***@'));
    console.log('🔍 Public API: Using database:', DB_NAME);
    console.log('🔍 Public API: Full URI for debugging:', MONGO_URI);
    console.log('🔍 Public API: URI characters:', MONGO_URI.split('').map((char, index) => `${index}:${char}`).join(' '));
    console.log('🔍 Public API: URI JSON:', JSON.stringify(MONGO_URI));
    console.log('🔍 Public API: URI length:', MONGO_URI.length);
    console.log('🔍 Public API: URI type:', typeof MONGO_URI);
    console.log('🔍 Public API: URI starts with mongodb://:', MONGO_URI.startsWith('mongodb://'));
    console.log('🔍 Public API: URI starts with mongodb+srv://:', MONGO_URI.startsWith('mongodb+srv://'));
    console.log('🔍 Public API: URI first 20 chars:', MONGO_URI.substring(0, 20));
    console.log('🔍 Public API: URI last 20 chars:', MONGO_URI.substring(MONGO_URI.length - 20));
    console.log('🔍 Public API: URI contains newlines:', MONGO_URI.includes('\n'));
    console.log('🔍 Public API: URI contains carriage returns:', MONGO_URI.includes('\r'));
    
    // Clean the URI to remove any potential issues
    const cleanURI = MONGO_URI.trim().replace(/[\r\n]/g, '');
    console.log('🔍 Public API: Cleaned URI:', cleanURI);
    
    // Validate MongoDB URI format
    if (!MONGO_URI.startsWith('mongodb://') && !MONGO_URI.startsWith('mongodb+srv://')) {
      throw new Error(`Invalid MongoDB URI format: ${MONGO_URI}`);
    }
    
    // Additional validation
    if (typeof MONGO_URI !== 'string') {
      throw new Error(`MongoDB URI is not a string: ${typeof MONGO_URI}`);
    }
    
    if (MONGO_URI.length === 0) {
      throw new Error('MongoDB URI is empty');
    }
    
    try {
      client = await MongoClient.connect(cleanURI);
      console.log('✅ Public API: MongoDB connected successfully');
    } catch (connectionError) {
      console.error('❌ MongoDB connection error:', connectionError);
      console.error('❌ Connection error details:', {
        message: connectionError.message,
        name: connectionError.name,
        stack: connectionError.stack
      });
      throw connectionError;
    }
    
    const db = client.db(DB_NAME);
    const studentsCollection = db.collection('students');

    let student;
    
    // Try to find by numeric ID first
    if (/^\d+$/.test(id)) {
      student = await studentsCollection.findOne({ id: parseInt(id) });
    }
    
    // If not found by numeric ID, try by MongoDB ObjectId
    if (!student) {
      try {
        const { ObjectId } = require('mongodb');
        student = await studentsCollection.findOne({ _id: new ObjectId(id) });
      } catch (error) {
        console.log('❌ Invalid ObjectId format:', id);
      }
    }

    if (!student) {
      console.log('❌ Public API: Student not found:', id);
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('✅ Public API: Student found:', { id: student.id, name: student.name });
    
    client.close();
    return res.status(200).json(student);
  } catch (error) {
    console.error('❌ Public API: Database error:', error);
    if (client) {
      client.close();
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}