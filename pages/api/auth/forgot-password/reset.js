import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, newPassword } = req.body;

  if (!id || !newPassword) {
    return res.status(400).json({ error: 'ID and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Check if user exists
    const userId = /^\d+$/.test(id) ? Number(id) : id;
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: id }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify OTP was cleared (authorization check)
    const otpData = user.OTP_rest_password;
    const isAuthorized = otpData && 
                        (otpData.OTP === null || otpData.OTP === undefined) &&
                        (otpData.OTP_Expiration_Date === null || otpData.OTP_Expiration_Date === undefined);

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized. Please verify OTP first.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.collection('users').updateOne(
      { id: user.id },
      {
        $set: {
          password: hashedPassword
        }
      }
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  } finally {
    if (client) await client.close();
  }
}

