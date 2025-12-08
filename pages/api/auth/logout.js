import { clearCookie } from '../../../lib/cookies';

export default async function handler(req, res) {
  // Allow both GET and POST methods for logout
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Clear the HTTP-only cookie
    // Set multiple cookie clearing headers to ensure it works in all browsers
    res.setHeader('Set-Cookie', [
      'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    ]);
    
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error in logout handler:', error);
    // Even if there's an error, try to clear the cookie and return success
    try {
      res.setHeader('Set-Cookie', [
        'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
        'token=; HttpOnly; Secure; SameSite=Strict; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      ]);
    } catch (e) {
      // Ignore second attempt error
      console.error('Error clearing cookie on retry:', e);
    }
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  }
}








