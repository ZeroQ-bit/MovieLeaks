import { addCode } from './supporters.js';

const subscriber = {
  email: 'luisitoa76@gmail.com',
  from_name: 'Ocele78',
  message_id: 'manual-' + Date.now(),
  amount: '5.00',
  currency: 'USD',
  type: 'Subscription'
};

const result = await addCode(subscriber.email, subscriber);

console.log('✅ Supporter code generated successfully!');
console.log('');
console.log('═'.repeat(60));
console.log('Name:', result.kofi_from_name);
console.log('Email:', result.email);
console.log('Code:', result.code);
console.log('Expires:', new Date(result.expires_at).toLocaleDateString());
console.log('═'.repeat(60));
console.log('');
console.log('📧 Send this message to Ocele78 via Ko-fi:');
console.log('─'.repeat(60));
console.log(`
Hi Ocele78!

Thank you for supporting Movie Leaks! 🎬

Your Supporter Code: ${result.code}

How to use it:
1. Install the addon: https://movie-leaks.vercel.app/manifest.json
2. Open Stremio > Add-ons > Movie Leaks > Settings (⚙️ icon)
3. Paste your code in "Supporter Code" field
4. Enjoy all 477+ movies!

Optional: Get free RPDB key at ratingposterdb.com for enhanced posters

Your code expires in 30 days and auto-renews with your subscription.

Thanks again for your support! 🙏
`);
console.log('─'.repeat(60));
