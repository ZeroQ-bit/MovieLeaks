#!/usr/bin/env node
/**
 * Test email delivery
 */
import nodemailer from 'nodemailer';
import 'dotenv/config';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;

console.log('Testing email delivery...');
console.log('From:', EMAIL_USER);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASSWORD
  }
});

try {
  const info = await transporter.sendMail({
    from: `"Movie Leaks 🎬" <${EMAIL_USER}>`,
    to: EMAIL_USER, // Sending to yourself for testing
    subject: '🎬 Test: Your Movie Leaks Supporter Code',
    html: `
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Welcome to Movie Leaks!</h1>
            <p>Thank you for supporting the project!</p>
          </div>
          
          <div class="content">
            <p>Hi there,</p>
            
            <p>This is a test email. Your supporter code system is working! 🎉</p>
            
            <div class="code-box">
              <p style="margin: 0 0 10px 0; color: #666;">Your Test Code:</p>
              <div class="code">TEST123456789ABC</div>
            </div>
            
            <p><strong>✅ Email delivery is configured correctly!</strong></p>
            
            <p>When real subscribers join via Ko-fi, they'll automatically receive an email like this with their actual supporter code.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });

  console.log('✅ Test email sent successfully!');
  console.log('Message ID:', info.messageId);
  console.log('Check your inbox:', EMAIL_USER);
  process.exit(0);
} catch (error) {
  console.error('❌ Failed to send test email:', error.message);
  process.exit(1);
}
