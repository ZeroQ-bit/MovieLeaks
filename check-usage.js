#!/usr/bin/env node
/**
 * Check supporter code usage from Vercel logs
 */

import { readFileSync } from 'fs';

const supportersData = JSON.parse(readFileSync('./supporters.json', 'utf8'));

console.log('📊 Supporter Codes Status:\n');
console.log('═'.repeat(80));

supportersData.codes.forEach((supporter, index) => {
  const created = new Date(supporter.created_at);
  const expires = new Date(supporter.expires_at);
  const now = new Date();
  const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
  
  console.log(`\n${index + 1}. ${supporter.kofi_from_name || 'Unknown'}`);
  console.log(`   Email: ${supporter.email}`);
  console.log(`   Code: ${supporter.code}`);
  console.log(`   Status: ${supporter.status}`);
  console.log(`   Created: ${created.toLocaleDateString()}`);
  console.log(`   Expires: ${expires.toLocaleDateString()} (${daysLeft} days left)`);
  console.log(`   Transaction: ${supporter.kofi_transaction_id || 'N/A'}`);
});

console.log('\n' + '═'.repeat(80));
console.log(`\nTotal Active Codes: ${supportersData.codes.filter(c => c.status === 'active').length}`);

console.log('\n📝 To check if a code is being used:');
console.log('   1. Check recent Vercel deployment logs');
console.log('   2. Look for "Supporter: YES" in logs');
console.log('   3. Or check production logs with: vercel logs <deployment-url>');
console.log('\n💡 Tip: Add usage tracking by updating supporters.js to log last_used timestamp');
