import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'mr_ahmad_badr_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/mr-ahmad-badr';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-ahmad-badr';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function requireAdminOrDeveloper(req) {
  const user = await authMiddleware(req);
  if (user.role !== 'admin' && user.role !== 'developer') {
    throw new Error('Forbidden: Admin or Developer access required');
  }
  return user;
}

export default async function handler(req, res) {
  const { id } = req.query;
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify admin or developer access
    const admin = await requireAdminOrDeveloper(req);
    
    if (req.method === 'GET') {
      // Get assistant by ID (exclude password field for security)
      const assistant = await db.collection('assistants').findOne(
        { id }, 
        { projection: { password: 0 } } // Exclude password field at database level
      );
      if (!assistant) return res.status(404).json({ error: 'Assistant not found' });
      // Explicitly remove password field as a safety measure (even though projection excludes it)
      const { password, ...assistantWithoutPassword } = assistant;
      res.json({ 
        ...assistantWithoutPassword,
        account_state: assistant.account_state || "Activated" // Default to Activated
      });
    } else if (req.method === 'PUT') {
      // Edit assistant - handle partial updates properly
      const { id: newId, name, phone, password, role, account_state } = req.body;
      
      // Build update object with only defined values (not null or undefined)
      const update = {};
      
      if (name !== undefined && name !== null && name.trim() !== '') {
        update.name = name;
      }
      if (phone !== undefined && phone !== null && phone.trim() !== '') {
        update.phone = phone;
      }
      if (role !== undefined && role !== null && role.trim() !== '') {
        update.role = role;
      }
      if (password !== undefined && password !== null && password.trim() !== '') {
        update.password = await bcrypt.hash(password, 10);
      }
      if (newId && newId !== id && newId.trim() !== '') {
        // Check for unique new ID
        const exists = await db.collection('assistants').findOne({ id: newId });
        if (exists) {
          return res.status(409).json({ error: 'Assistant ID already exists' });
        }
        update.id = newId;
      }
      if (account_state !== undefined && account_state !== null) {
        update.account_state = account_state;
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      const result = await db.collection('assistants').updateOne({ id }, { $set: update });
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Assistant not found' });
      res.json({ success: true });
    } else if (req.method === 'DELETE') {
      // Delete assistant
      const result = await db.collection('assistants').deleteOne({ id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Assistant not found' });
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Error in assistants [id] API:', error);
    if (error.message === 'Unauthorized') {
      res.status(401).json({ error: 'Unauthorized' });
    } else if (error.message === 'Forbidden: Admin or Developer access required') {
      res.status(403).json({ error: 'Forbidden: Admin or Developer access required' });
    } else {
      console.error('❌ Internal server error details:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  } finally {
    if (client) await client.close();
  }
} 