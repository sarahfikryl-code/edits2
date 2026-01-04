import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
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
const EMAIL_USER = envConfig.EMAIL_USER || process.env.EMAIL_USER;
// Remove spaces from app password (Gmail app passwords may have spaces for readability)
const EMAIL_PASS = (envConfig.EMAIL_PASS || process.env.EMAIL_PASS)?.replace(/\s+/g, '') || '';

// Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('📧 Email Config Check:', {
    hasEmailUser: !!EMAIL_USER,
    hasEmailPass: !!EMAIL_PASS,
    emailUserLength: EMAIL_USER?.length || 0,
    emailPassLength: EMAIL_PASS?.length || 0,
    emailUserPreview: EMAIL_USER ? EMAIL_USER.substring(0, 5) + '...' : 'N/A'
  });
}

// Create nodemailer transporter for Gmail SMTP
let transporter = null;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
} else {
  console.error('❌ Gmail SMTP credentials are not configured');
}

// Generate 8-digit random OTP
function generateOTP() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;

  console.log('📧 Send OTP request received:', { id, hasEmailConfig: !!(EMAIL_USER && EMAIL_PASS) });

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

    // Check if Gmail SMTP is configured
    if (!transporter || !EMAIL_USER || !EMAIL_PASS) {
      console.error('❌ Gmail SMTP is not configured.');
      console.error('❌ EMAIL_USER from env.config:', !!envConfig.EMAIL_USER);
      console.error('❌ EMAIL_PASS from env.config:', !!envConfig.EMAIL_PASS);
      console.error('❌ EMAIL_USER from process.env:', !!process.env.EMAIL_USER);
      console.error('❌ EMAIL_PASS from process.env:', !!process.env.EMAIL_PASS);
      return res.status(500).json({ 
        error: 'Email service is not configured. Please contact administrator.',
        debug: process.env.NODE_ENV === 'development' ? {
          envConfigKeys: Object.keys(envConfig),
          hasEmailUser: 'EMAIL_USER' in envConfig,
          hasEmailPass: 'EMAIL_PASS' in envConfig
        } : undefined
      });
    }

    console.log('📧 Attempting to send OTP email to:', user.email);
    console.log('🔑 Generated OTP code:', otpCode);
    console.log('👤 User name:', userName);
    console.log('📧 Using email from:', EMAIL_USER);

    try {
      // Verify connection before sending
      await transporter.verify();
      console.log('✅ SMTP connection verified');
      
      const emailResult = await transporter.sendMail({
        from: `"Demo Attendance System" <${EMAIL_USER}>`,
        to: user.email,
        subject: "Password Reset OTP Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #2C5281; padding: 0;">
            <div style="padding: 40px 30px; background-color: #2C5281;">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="https://demosys.myvnc.com/logo.png" alt="Logo" style="width: 100px; height: 100px; margin: 0 auto; display: block; border-radius: 10px;" />
              </div>
              <p style="color: white; font-size: 16px; margin: 0 0 20px 0;">Hi ${userName},</p>
              <p style="color: white; font-size: 16px; margin: 0 0 30px 0;">Welcome to the Demo Attendance System platform! To reset your password, please use this OTP code:</p>
              <div style="background-color: #2A4264; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #0E80C7;">
                <div style="color: white; font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: 'Roboto, Sans-serif';">${otpCode}</div>
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
            <div style="border-top: 1px solid rgb(94, 88, 88); padding: 15px 30px; background-color: #2A4264;">
              <p style="color: white; font-size: 12px; margin: 0; text-align: center;">This is an automated message. Please do not reply directly to this email.</p>
            </div>
          </div>
        `,
      });

      console.log('✅ Email sent successfully');
      console.log('✅ Email message ID:', emailResult.messageId);
      console.log('✅ Email response:', emailResult.response);
      
      // Email sent successfully - NOW save OTP to database
      const emailId = emailResult.messageId || `gmail-${Date.now()}`;
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
      console.error('❌ Email error code:', emailError?.code);
      console.error('❌ Email error command:', emailError?.command);
      console.error('❌ Email error response:', emailError?.response);
      console.error('❌ Email error responseCode:', emailError?.responseCode);
      console.error('❌ Email error stack:', emailError?.stack);
      
      // Handle Nodemailer/Gmail SMTP errors
      let errorMessage = 'Failed to send email';
      let errorDetails = null;

      // Extract detailed error information
      if (emailError?.response) {
        errorDetails = emailError.response;
        errorMessage = typeof errorDetails === 'string' ? errorDetails : (errorDetails.message || errorMessage);
      } else if (emailError?.message) {
        errorMessage = emailError.message;
        errorDetails = { 
          message: emailError.message, 
          code: emailError.code,
          command: emailError.command,
          responseCode: emailError.responseCode
        };
      }

      // Check for common Gmail SMTP errors
      const errorMsgLower = errorMessage.toLowerCase();
      if (errorMsgLower.includes('invalid login') || 
          errorMsgLower.includes('authentication failed') || 
          errorMsgLower.includes('username and password not accepted') ||
          emailError?.code === 'EAUTH' ||
          emailError?.responseCode === 535) {
        errorMessage = 'Email authentication failed. Please verify EMAIL_USER and EMAIL_PASS (App Password) in env.config.';
      } else if (errorMsgLower.includes('connection') || 
                 errorMsgLower.includes('econnrefused') ||
                 emailError?.code === 'ECONNECTION' ||
                 emailError?.code === 'ETIMEDOUT') {
        errorMessage = 'Failed to connect to Gmail SMTP server. Please check your internet connection.';
      } else if (errorMsgLower.includes('rate limit') || 
                 errorMsgLower.includes('too many') ||
                 emailError?.code === 'EENVELOPE') {
        errorMessage = 'Email sending rate limit exceeded. Please try again later.';
      } else if (errorMsgLower.includes('self signed certificate') ||
                 errorMsgLower.includes('certificate')) {
        errorMessage = 'SSL certificate error. Please check Gmail SMTP configuration.';
      }

      // Return detailed error for debugging
      res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        debug: process.env.NODE_ENV === 'development' ? {
          hasEmailUser: !!EMAIL_USER,
          hasEmailPass: !!EMAIL_PASS,
          emailUser: EMAIL_USER ? EMAIL_USER.substring(0, 3) + '***' : 'N/A',
          errorCode: emailError?.code,
          responseCode: emailError?.responseCode,
          command: emailError?.command
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

