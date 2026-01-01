import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../../lib/authMiddleware';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', '..', '..', 'env.config');
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (admin, developer, or assistant only)
    const user = await authMiddleware(req);
    const allowedRoles = ['admin', 'developer', 'assistant'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { id } = req.query;
    const studentId = parseInt(id);

    let client;
    try {
      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Check if student account exists in users collection
      const userAccount = await db.collection('users').findOne({
        id: studentId,
        role: 'student'
      });

      if (!userAccount) {
        return res.status(404).json({ error: 'Student account not found' });
      }

      // Return account info (excluding password)
      res.status(200).json({
        id: userAccount.id,
        role: userAccount.role,
        account_state: userAccount.account_state || 'Activated',
        email: userAccount.email || null
      });

    } finally {
      if (client) await client.close();
    }

  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.error('Error getting student account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

