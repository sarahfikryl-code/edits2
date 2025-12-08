import { MongoClient } from 'mongodb';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auth middleware is now imported from shared utility

function sendWhatsAppMessage(phoneNumber, message) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../../../../backend/whatsapp.py');
    
    // Prepare command line arguments
    const args = [
      pythonScript,
      '--phone', phoneNumber,
      '--message', message,
      '--quiet'
    ];
    
    console.log(`🐍 Executing Python script: python ${args.join(' ')}`);
    console.log(`📁 Script path: ${pythonScript}`);
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`💬 Message length: ${message.length} characters`);
    
    // Check if Python script exists
    const fs = require('fs');
    if (!fs.existsSync(pythonScript)) {
      console.error(`❌ Python script not found at: ${pythonScript}`);
      reject(new Error(`Python script not found at: ${pythonScript}`));
      return;
    }
    
    const pythonProcess = spawn('python', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(pythonScript) // Set working directory to script location
    });
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.error('❌ Python process timed out after 60 seconds');
      pythonProcess.kill('SIGTERM');
      reject(new Error('Python process timed out after 60 seconds'));
    }, 60000); // 60 seconds timeout
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`🐍 Python stdout: ${data.toString().trim()}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log(`🐍 Python stderr: ${data.toString().trim()}`);
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout); // Clear the timeout
      console.log(`🐍 Python process exited with code: ${code}`);
      
      if (code === 0) {
        try {
          const result = JSON.parse(stdout.trim());
          console.log(`✅ Python script succeeded:`, result);
          resolve(result);
        } catch (error) {
          console.error(`❌ Failed to parse Python output: ${stdout}`);
          reject(new Error(`Failed to parse Python output: ${stdout}`));
        }
      } else {
        console.error(`❌ Python script failed with code ${code}`);
        console.error(`❌ stderr: ${stderr}`);
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout); // Clear the timeout
      console.error(`❌ Failed to start Python process: ${error.message}`);
      console.error(`❌ This might mean Python is not installed or not in PATH`);
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const studentId = parseInt(id);
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Get student data
    const student = await db.collection('students').findOne({ id: studentId });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Format the parent phone number (add '2' if not present)
    let parentNumber = student.parentsPhone ? student.parentsPhone.replace(/[^0-9]/g, '') : null;
    if (parentNumber && !parentNumber.startsWith('2')) {
      parentNumber = '2' + parentNumber;
    }
    
    if (!parentNumber) {
      return res.status(400).json({ error: 'No parent number available' });
    }

    // Get the lesson to use (from request body or find current attended lesson)
    const requestedLesson = req.body.lesson;
    let currentLesson;
    
    // Ensure lessons object exists and is in object format
    if (!student.lessons || Array.isArray(student.lessons)) {
      console.log(`🔄 Converting lessons from array to object format for student ${studentId}`);
      student.lessons = {};
      await db.collection('students').updateOne(
        { id: studentId },
        { $set: { lessons: {} } }
      );
    }
    
    if (requestedLesson) {
      // Use the requested lesson - create it if it doesn't exist
      if (!student.lessons[requestedLesson]) {
        console.log(`🧩 Creating missing lesson "${requestedLesson}" for student ${studentId}`);
        const newLesson = {
          lesson: requestedLesson,
          attended: false,
          lastAttendance: null,
          lastAttendanceCenter: null,
          hwDone: false,
          quizDegree: null,
          comment: null,
          message_state: false,
          homework_degree: null
        };
        
        await db.collection('students').updateOne(
          { id: studentId },
          { $set: { [`lessons.${requestedLesson}`]: newLesson } }
        );
        
        // Update in-memory reference
        student.lessons[requestedLesson] = newLesson;
        console.log(`✅ Created lesson "${requestedLesson}" for student ${studentId}`);
      }
      currentLesson = student.lessons[requestedLesson];
      console.log(`📚 Using lesson "${currentLesson.lesson}" for student ${studentId}`);
    } else {
      // Find the current lesson (last attended lesson or first lesson if none)
      if (student.lessons && typeof student.lessons === 'object') {
        const attendedLessons = Object.values(student.lessons).filter(l => l.attended);
        currentLesson = attendedLessons.length > 0 ? attendedLessons[attendedLessons.length - 1] : Object.values(student.lessons)[0];
      }
      if (!currentLesson) {
        // Create default lesson if none exists
        const defaultLesson = lessons[0];
        const newLesson = {
          lesson: defaultLesson,
          attended: false,
          lastAttendance: null,
          lastAttendanceCenter: null,
          hwDone: false,
          quizDegree: null,
          comment: null,
          message_state: false,
          homework_degree: null
        };
        
        await db.collection('students').updateOne(
          { id: studentId },
          { $set: { [`lessons.${defaultLesson}`]: newLesson } }
        );
        
        student.lessons[defaultLesson] = newLesson;
        currentLesson = newLesson;
      }
    }

    // Create the message
    let message = `TopPhysics academy:

  • Name: ${student.name}
  • Age: ${student.age || 'N/A'}
  • Grade: ${student.grade || 'N/A'}
  • School: ${student.school || 'N/A'}
  • Attended: ${currentLesson.attended ? `${currentLesson.lastAttendance}` : 'No'}`;

    // Only show attendance-related info if student attended
    if (currentLesson.attended) {
      message += `
  • Homework: ${currentLesson.hwDone ? 'Done' : 'Not Done'}
  • Quiz Degree: ${currentLesson.quizDegree || '0/0'}`;
    }

    message += `

Thanks for choosing us 😊❤`;

    // Send message via Python Selenium script
    const result = await sendWhatsAppMessage(parentNumber, message);

    if (result.success) {
      // Update message state in the current lesson
      if (currentLesson) {
        console.log(`🔄 Updating message_state for student ${studentId}, lesson "${currentLesson.lesson}"`);
        const updateResult = await db.collection('students').updateOne(
          { id: studentId },
          { $set: { [`lessons.${currentLesson.lesson}.message_state`]: true } }
        );
        console.log(`✅ Update result:`, updateResult);
        console.log(`✅ Updated message_state to true for student ${studentId}, lesson "${currentLesson.lesson}"`);
      } else {
        console.log(`❌ No currentLesson found for student ${studentId}`);
      }

      // Update history if student is attended
      if (currentLesson.attended) {
        await db.collection('history').updateOne(
          { 
            studentId: studentId,
            lesson: currentLesson.lesson
          },
          { $set: { message_state: true } }
        );
      }

      res.json({ 
        success: true, 
        message: `Message sent to ${student.name}'s parent`,
        data: result 
      });
    } else {
      // Provide user-friendly error message
      let errorMessage = 'Error to send message';
      
      // Check for specific error types and provide appropriate messages
      if (result.error && result.error.includes('Invalid phone number')) {
        errorMessage = 'Error to send message - Invalid phone number or WhatsApp not available';
      } else if (result.error && result.error.includes('Send button not found')) {
        errorMessage = 'Error to send message - Invalid phone number or WhatsApp not available';
      } else if (result.error && result.error.includes('Failed to send')) {
        errorMessage = 'Error to send message - Please try again later';
      } else if (result.error && result.error.includes('Failed to parse')) {
        errorMessage = 'Error to send message - System temporarily unavailable';
      }
      
      res.status(500).json({ 
        error: errorMessage
      });
    }

  } catch (error) {
    console.error('WhatsApp Python Script Error:', error.message);
    res.status(500).json({ 
      error: 'Error to send message'
    });
  } finally {
    if (client) await client.close();
  }
} 