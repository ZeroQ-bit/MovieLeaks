/**
 * Ko-fi Webhook Handler
 * Receives payment notifications and generates supporter codes
 * 
 * Ko-fi Webhook Documentation: https://help.ko-fi.com/hc/en-us/articles/360001857891
 */

import { addCode, extendCode, deactivateCode } from '../supporters.js';

// Verification token from Ko-fi settings (optional but recommended)
const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN || '';

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ko-fi sends data as form-data with key 'data'
    const kofiData = JSON.parse(req.body.data || '{}');
    
    console.log('Ko-fi webhook received:', {
      type: kofiData.type,
      from: kofiData.from_name,
      email: kofiData.email,
      amount: kofiData.amount
    });

    // Verify token if configured
    if (KOFI_VERIFICATION_TOKEN && kofiData.verification_token !== KOFI_VERIFICATION_TOKEN) {
      console.error('Invalid verification token');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Handle different Ko-fi event types
    switch (kofiData.type) {
      case 'Donation':
      case 'Subscription': {
        // New subscription or donation - generate code
        const supporter = await addCode(kofiData.email, kofiData);
        
        if (supporter) {
          console.log('✅ Generated code for', kofiData.email, ':', supporter.code);
          
          // Return code so Ko-fi can include it in confirmation email
          // You can customize Ko-fi's thank you message to include {data.code}
          return res.status(200).json({
            success: true,
            code: supporter.code,
            message: `Thank you! Your supporter code is: ${supporter.code}`
          });
        } else {
          console.error('Failed to generate code');
          return res.status(500).json({ error: 'Failed to generate code' });
        }
      }

      case 'Subscription Payment': {
        // Monthly renewal - extend existing code
        // Find code by email and extend expiry
        console.log('💳 Subscription renewal for', kofiData.email);
        
        // Note: You'll need to track email->code mapping
        // For now, we'll create a new code if none exists
        const supporter = await addCode(kofiData.email, kofiData);
        
        return res.status(200).json({
          success: true,
          message: 'Subscription renewed'
        });
      }

      case 'Subscription Cancelled': {
        // Subscription cancelled - deactivate code
        console.log('❌ Subscription cancelled for', kofiData.email);
        
        const deactivated = await deactivateCode(kofiData.email);
        
        return res.status(200).json({
          success: true,
          deactivated
        });
      }

      default:
        console.log('Unknown Ko-fi event type:', kofiData.type);
        return res.status(200).json({ success: true });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
