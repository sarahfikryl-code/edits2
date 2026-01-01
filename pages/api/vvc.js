import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../lib/authMiddleware';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

// Helper function to generate VVC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
const generateVVCCode = () => {
  const numbers = '0123456789';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  
  // Generate 5 random numbers
  const numPart = Array.from({ length: 5 }, () => 
    numbers[Math.floor(Math.random() * numbers.length)]
  ).join('');
  
  // Generate 2 random uppercase letters
  const upperPart = Array.from({ length: 2 }, () => 
    uppercase[Math.floor(Math.random() * uppercase.length)]
  ).join('');
  
  // Generate 2 random lowercase letters
  const lowerPart = Array.from({ length: 2 }, () => 
    lowercase[Math.floor(Math.random() * lowercase.length)]
  ).join('');
  
  // Combine and shuffle to randomize order
  const code = (numPart + upperPart + lowerPart).split('');
  for (let i = code.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [code[i], code[j]] = [code[j], code[i]];
  }
  
  return code.join('');
};

// Format date as MM/DD/YYYY at hour:minute AM/PM
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year} at ${hoursStr}:${minutes} ${ampm}`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Check if pagination parameters are provided
      const { page, limit, search, sortBy, sortOrder, viewed, code_state, payment_state } = req.query;
      const hasPagination = page || limit;

      if (hasPagination) {
        // Paginated response
        const currentPage = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 100;
        const searchTerm = search ? search.trim() : '';
        const sortField = sortBy || 'date';
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        // Build query filter for VVC collection
        let vvcQueryFilter = {};

        // Search: VVC code starts with OR made_by_who contains
        if (searchTerm.trim()) {
          const search = searchTerm.trim();
          vvcQueryFilter.$or = [
            { VVC: { $regex: `^${search}`, $options: 'i' } }, // VVC code starts with
            { made_by_who: { $regex: search, $options: 'i' } } // made_by_who contains
          ];
        }

        // Filter: viewed
        if (viewed !== undefined && viewed !== '') {
          const viewedValue = viewed === 'true';
          vvcQueryFilter.viewed = viewedValue;
        }

        // Filter: code_state
        if (code_state && code_state !== '') {
          vvcQueryFilter.code_state = code_state;
        }

        // Filter: payment_state
        if (payment_state && payment_state !== '') {
          vvcQueryFilter.payment_state = payment_state;
        }

        // Get total count for pagination
        const totalCount = await db.collection('VVC').countDocuments(vvcQueryFilter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const skip = (currentPage - 1) * pageSize;

        // Get VVC records with pagination
        const vvcRecords = await db.collection('VVC')
          .find(vvcQueryFilter)
          .sort({ [sortField]: sortDirection })
          .skip(skip)
          .limit(pageSize)
          .toArray();

        return res.status(200).json({
          data: vvcRecords,
          pagination: {
            currentPage,
            totalPages,
            totalCount,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
          }
        });
      }

      // Non-paginated response (for backward compatibility)
      const vvcRecords = await db.collection('VVC').find({}).toArray();
      return res.status(200).json({ data: vvcRecords });
    } catch (error) {
      console.error('VVC API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'POST') {
    // Create new VVC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { number_of_codes, number_of_views, code_state } = req.body;

      // Validation
      const codesCount = number_of_codes ? parseInt(number_of_codes) : 1;
      if (codesCount < 1 || codesCount > 50) {
        return res.status(400).json({ error: 'Number of codes must be between 1 and 50' });
      }

      if (!number_of_views || number_of_views < 1) {
        return res.status(400).json({ error: 'Number of views must be at least 1' });
      }

      if (!code_state || !['Activated', 'Deactivated'].includes(code_state)) {
        return res.status(400).json({ error: 'Code state must be Activated or Deactivated' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      const madeByWho = user.assistant_id || user.id || 'unknown';

      // Generate multiple VVC codes
      const newVVCs = [];
      for (let i = 0; i < codesCount; i++) {
        const code = generateVVCCode();
        newVVCs.push({
          VVC: code,
          number_of_views: parseInt(number_of_views),
          viewed: false,
          viewed_by_who: null,
          code_state: code_state,
          payment_state: 'Not Paid',
          made_by_who: madeByWho,
          date: formattedDate
        });
      }

      const result = await db.collection('VVC').insertMany(newVVCs);

      return res.status(201).json({
        success: true,
        message: `${codesCount} VVC code(s) created successfully`,
        data: newVVCs.map((vvc, index) => ({ ...vvc, _id: result.insertedIds[index] }))
      });
    } catch (error) {
      console.error('Create VVC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'PUT') {
    // Update VVC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id } = req.query;
      const { number_of_views, code_state, payment_state } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'VVC ID is required' });
      }

      // Validation
      if (number_of_views !== undefined && number_of_views < 1) {
        return res.status(400).json({ error: 'Number of views must be at least 1' });
      }

      if (code_state && !['Activated', 'Deactivated'].includes(code_state)) {
        return res.status(400).json({ error: 'Code state must be Activated or Deactivated' });
      }

      if (payment_state && !['Paid', 'Not Paid'].includes(payment_state)) {
        return res.status(400).json({ error: 'Payment state must be Paid or Not Paid' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Build update object
      const update = {};
      if (number_of_views !== undefined) {
        update.number_of_views = parseInt(number_of_views);
      }
      if (code_state !== undefined) {
        update.code_state = code_state;
      }
      if (payment_state !== undefined) {
        update.payment_state = payment_state;
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Update VVC record
      const result = await db.collection('VVC').updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'VVC record not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'VVC updated successfully'
      });
    } catch (error) {
      console.error('Update VVC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'DELETE') {
    // Delete VVC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'VVC ID is required' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Delete VVC record
      const result = await db.collection('VVC').deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'VVC record not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'VVC deleted successfully'
      });
    } catch (error) {
      console.error('Delete VVC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

