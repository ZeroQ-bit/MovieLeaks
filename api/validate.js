/**
 * Code Validation API
 * Allows external validation of supporter codes
 */

import { validateCode } from '../supporters.js';

export default async function handler(req, res) {
  // Accept GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const code = req.method === 'GET' ? req.query.code : req.body.code;

  if (!code) {
    return res.status(400).json({ 
      valid: false,
      error: 'No code provided' 
    });
  }

  try {
    const result = await validateCode(code);
    
    return res.status(200).json({
      valid: result.valid,
      expired: result.expired || false,
      tier: result.valid ? 'supporter' : 'free'
    });
  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({ 
      valid: false,
      error: 'Validation failed' 
    });
  }
}
