import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
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
const RESEND_API_KEY = envConfig.RESEND_API_KEY || envConfig.RESND_API_KEY || process.env.RESEND_API_KEY || process.env.RESND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not configured');
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Generate 8-digit random OTP
function generateOTP() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;

  console.log('📧 Send OTP request received:', { id, hasResendKey: !!RESEND_API_KEY });

  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }

  let client;
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    console.log('✅ Connected to database');

    // Check if user exists (can be number or string)
    const userId = /^\d+$/.test(id) ? Number(id) : id;
    console.log('🔍 Searching for user with ID:', userId, 'or', id);
    
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: id }
      ]
    });

    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', { id: user.id, email: user.email, hasEmail: !!user.email });

    if (!user.email) {
      console.log('❌ User does not have email');
      return res.status(400).json({ error: 'User does not have an email address' });
    }

    // Check resend_expiration - only send if null or expired
    const resendExpiration = user.OTP_rest_password?.resend_expiration;
    const now = new Date();
    
    if (resendExpiration) {
      const expirationDate = new Date(resendExpiration);
      if (now < expirationDate) {
        // Still in cooldown period
        console.log('⏳ Resend cooldown active, cannot send email yet');
        return res.status(429).json({ 
          success: false, 
          error: 'Please wait before requesting another OTP',
          resend_expiration: resendExpiration
        });
      }
    }

    // Get user name
    let userName = user.name || 'User';
    
    // If user is a student (numeric ID), get name from students collection
    // For other roles (assistant, admin, developer), use name from users collection
    if (typeof userId === 'number' && user.role === 'student') {
      const student = await db.collection('students').findOne({ id: userId });
      if (student && student.name) {
        userName = student.name;
      }
    }

    // Generate OTP (but don't save to DB yet - only save after successful email send)
    const otpCode = generateOTP();
    const hashedOTP = await bcrypt.hash(otpCode, 10);
    
    // Set expiration to 10 minutes from now
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + 10);

    // Set resend expiration to 3 minutes from now
    const resendExpirationDate = new Date();
    resendExpirationDate.setMinutes(resendExpirationDate.getMinutes() + 3);

    // Check if Resend is configured
    if (!resend || !RESEND_API_KEY) {
      console.error('❌ Resend is not configured. RESEND_API_KEY:', !!RESEND_API_KEY);
      console.error('❌ RESEND_API_KEY from env.config:', !!envConfig.RESEND_API_KEY);
      console.error('❌ RESEND_API_KEY from process.env:', !!process.env.RESEND_API_KEY);
      return res.status(500).json({ 
        error: 'Email service is not configured. Please contact administrator.',
        debug: process.env.NODE_ENV === 'development' ? {
          envConfigKeys: Object.keys(envConfig),
          hasResendInEnv: 'RESEND_API_KEY' in envConfig || 'RESND_API_KEY' in envConfig
        } : undefined
      });
    }

    // Validate API key format (Resend keys start with 're_')
    if (!RESEND_API_KEY.startsWith('re_')) {
      console.error('❌ Invalid Resend API key format. Keys should start with "re_"');
      return res.status(500).json({ 
        error: 'Invalid email service configuration. Please check RESEND_API_KEY format.' 
      });
    }

    console.log('📧 Attempting to send OTP email to:', user.email);
    console.log('🔑 Generated OTP code:', otpCode);
    console.log('👤 User name:', userName);

    try {
      const emailResult = await resend.emails.send({
        from: "Student System <onboarding@resend.com>",
        to: user.email,
        subject: "Password Reset Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2C5281; padding: 0;">
            <div style="padding: 40px 30px; background-color: #2C5281;">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://demosys.myvnc.com/logo.png" alt="Logo" style="width: 50px; height: 50px; margin: 0 auto; display: block;" />
              </div>
              <h1 style="color: white; font-size: 28px; font-weight: bold; text-align: center; margin: 0 0 30px 0; padding: 0;">Welcome to Demo Attendance System</h1>
              <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${userName},</p>
              <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">Welcome to the Demo Attendance System platform! To reset your password, please use this OTP code:</p>
              <div style="background-color: #2A4264; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <div style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: 'Courier New', monospace;">${otpCode}</div>
              </div>
              <p style="color: white; font-size: 16px; margin: 20px 0;">This code is valid for <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
              <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">If you didn't request this, please ignore this email or contact our support team.</p>
              <p style="color: white; font-size: 16px; margin: 30px 0 0 0;">Best Regards,</p>
              <p style="color: white; font-size: 16px; margin: 5px 0 0 0;">The Demo Attendance System Team</p>
            </div>
            <div style="border-top: 1px solid rgba(255, 255, 255, 0.2); padding: 30px; background-color: #2C5281;">
              <div style="color: white; font-size: 20px; font-weight: bold; font-family: sans-serif; margin-bottom: 15px; text-align: center;">Demo Attendance System</div>
              <div style="color: white; text-decoration: underline; font-size: 14px; margin-bottom: 20px; text-align: center;">
                <a href="https://demosys.myvnc.com" style="color: white; text-decoration: underline;">demosys.myvnc.com</a>
              </div>
            </div>
            <div style="border-top: 1px solid rgba(255, 255, 255, 0.2); padding: 15px 30px; background-color: #2A4264;">
              <p style="color: white; font-size: 12px; margin: 0; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
          </div>
        `,
      });

      console.log('✅ Email API response:', emailResult);
      console.log('✅ Email result data:', JSON.stringify(emailResult, null, 2));
      
      // Check for errors in response first
      if (emailResult?.error) {
        console.error('❌ Email error in response:', emailResult.error);
        return res.status(500).json({ 
          error: emailResult.error.message || 'Failed to send email',
          details: emailResult.error
        });
      }

      // Check if email was actually sent successfully
      // Resend SDK returns { data: { id: ... }, error: null } or throws an error
      const emailId = emailResult?.data?.id || emailResult?.id;
      if (!emailId) {
        console.error('❌ Email response missing ID - email may not have been sent');
        console.error('❌ Full response structure:', JSON.stringify(emailResult, null, 2));
        return res.status(500).json({ 
          error: 'Email service returned invalid response. Please check Resend API key and configuration.',
          details: emailResult
        });
      }

      // Email sent successfully - NOW save OTP to database
      console.log('✅ Email sent successfully with ID:', emailId);
      await db.collection('users').updateOne(
        { id: user.id },
        {
          $set: {
            OTP_rest_password: {
              OTP: hashedOTP,
              OTP_Expiration_Date: expirationDate,
              resend_expiration: resendExpirationDate
            }
          }
        }
      );
      console.log('✅ OTP saved to database after successful email send');

      res.json({ 
        success: true, 
        message: 'OTP sent to email',
        email_id: emailId,
        resend_expiration: resendExpirationDate
      });
    } catch (emailError) {
      console.error('❌ Email sending error:', emailError);
      console.error('❌ Email error type:', typeof emailError);
      console.error('❌ Email error message:', emailError?.message);
      console.error('❌ Email error response:', emailError?.response);
      console.error('❌ Email error data:', emailError?.response?.data);
      console.error('❌ Email error stack:', emailError?.stack);
      
      // Handle Resend-specific errors
      let errorMessage = 'Failed to send email';
      let errorDetails = null;

      if (emailError?.response?.data) {
        errorDetails = emailError.response.data;
        errorMessage = errorDetails.message || errorMessage;
      } else if (emailError?.message) {
        errorMessage = emailError.message;
        errorDetails = { message: emailError.message };
      }

      // Check for common Resend API errors
      if (errorMessage.includes('API key') || errorMessage.includes('unauthorized')) {
        errorMessage = 'Email service authentication failed. Please check RESEND_API_KEY configuration.';
      } else if (errorMessage.includes('domain') || errorMessage.includes('sender')) {
        errorMessage = 'Email sender domain not verified. Please verify your domain in Resend dashboard.';
      }

      res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        debug: process.env.NODE_ENV === 'development' ? {
          hasApiKey: !!RESEND_API_KEY,
          apiKeyLength: RESEND_API_KEY?.length || 0,
          apiKeyPrefix: RESEND_API_KEY?.substring(0, 3) || 'N/A'
        } : undefined
      });
    }
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to send OTP. Please try again.', details: error.message });
  } finally {
    if (client) await client.close();
  }
}

