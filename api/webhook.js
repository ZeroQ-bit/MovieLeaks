/**
 * Ko-fi Webhook Handler
 * Receives payment notifications and generates supporter codes
 * 
 * Ko-fi Webhook Documentation: https://help.ko-fi.com/hc/en-us/articles/360001857891
 */

import { addCode, extendCode, deactivateCode } from '../supporters.js';
import nodemailer from 'nodemailer';

// Verification token from Ko-fi settings (optional but recommended)
const KOFI_VERIFICATION_TOKEN = process.env.KOFI_VERIFICATION_TOKEN || '';

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

// Create email transporter (only if credentials are provided)
let transporter = null;
if (EMAIL_USER && EMAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD
    }
  });
  console.log('📧 Email delivery enabled with Gmail');
} else {
  console.log('⚠️  Email delivery disabled - EMAIL_USER or EMAIL_PASSWORD not configured');
}

/**
 * Send supporter code via email
 */
async function sendCodeEmail(email, name, code, isRenewal = false) {
  if (!transporter) {
    console.log('⚠️  Skipping email - transporter not configured');
    return false;
  }

  try {
    const subject = isRenewal 
      ? '🎬 Your Movie Leaks Subscription Renewed!'
      : '🎬 Your Movie Leaks Supporter Code!';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                    color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .code-box { background: white; border: 3px solid #667eea; padding: 20px; 
                      margin: 20px 0; text-align: center; border-radius: 8px; }
          .code { font-size: 24px; font-family: 'Courier New', monospace; 
                  color: #667eea; font-weight: bold; letter-spacing: 2px; }
          .button { display: inline-block; padding: 15px 30px; background: #667eea; 
                    color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .steps ol { padding-left: 20px; }
          .steps li { margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 ${isRenewal ? 'Subscription Renewed!' : 'Welcome to Movie Leaks!'}</h1>
            <p>${isRenewal ? 'Your supporter access has been extended' : 'Thank you for supporting the project!'}</p>
          </div>
          
          <div class="content">
            <p>Hi ${name || 'there'},</p>
            
            ${isRenewal 
              ? '<p>Your Movie Leaks subscription has been renewed for another 30 days! 🎉</p>'
              : '<p>Thank you for becoming a Movie Leaks supporter! Your contribution helps keep this project alive. 🙏</p>'
            }
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666;">Your Supporter Code:</p>
              <div class="code">${code}</div>
            </div>
            
            <div class="steps">
              <h3>📱 How to Install:</h3>
              <ol>
                <li>Open <strong>Stremio</strong> on any device</li>
                <li>Click the <strong>puzzle piece icon</strong> (Add-ons)</li>
                <li>Click <strong>"Community Add-ons"</strong> at the bottom</li>
                <li>Paste this URL and click Install:<br>
                    <code style="background: #f0f0f0; padding: 5px;">https://movie-leaks.vercel.app/manifest.json</code>
                </li>
                <li>In the addon settings, paste your code above</li>
                <li>Enjoy <strong>477+ leaked movies</strong>! 🍿</li>
              </ol>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <strong>⚠️ Important:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Save this code - you'll need it to configure the addon</li>
                <li>Your code expires in 30 days</li>
                <li>It auto-renews with your Ko-fi subscription</li>
                <li>Don't share your code publicly</li>
              </ul>
            </div>
            
            <h3>🌟 What You Get:</h3>
            <ul>
              <li>✅ <strong>477+ leaked movies</strong> (vs 100 free tier)</li>
              <li>✅ New movies added weekly from r/movieleaks</li>
              <li>✅ Optional RPDB poster overlays (bring your own key)</li>
              <li>✅ Support ongoing development & hosting</li>
            </ul>
            
            <h3>❓ Need Help?</h3>
            <p>If you have any questions or need assistance:</p>
            <ul>
              <li>Reply to this email</li>
              <li>Message me on Ko-fi</li>
              <li>Check the README for troubleshooting</li>
            </ul>
            
            <p style="margin-top: 30px;">Thanks again for your support! 🎉</p>
            
            <div class="footer">
              <p>This email was sent because you subscribed to Movie Leaks on Ko-fi.</p>
              <p>Your subscription renews automatically each month.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Movie Leaks 🎬" <${EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html
    });

    console.log('✅ Email sent to', email);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return false;
  }
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ko-fi sends data as form-data with key 'data'
    // For testing, also accept direct JSON
    let kofiData;
    if (req.body.data) {
      // Real Ko-fi webhook format
      kofiData = JSON.parse(req.body.data);
    } else {
      // Testing format (direct JSON)
      kofiData = req.body;
    }
    
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
          
          // Send email with the code
          await sendCodeEmail(kofiData.email, kofiData.from_name, supporter.code, false);
          
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
        
        // Send renewal notification email
        if (supporter) {
          await sendCodeEmail(kofiData.email, kofiData.from_name, supporter.code, true);
        }
        
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
