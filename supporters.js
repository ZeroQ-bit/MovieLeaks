import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

const SUPPORTERS_FILE = join(process.cwd(), 'supporters.json');

/**
 * Generate a unique supporter code
 */
export function generateCode() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

/**
 * Load supporter codes from JSON file
 */
async function loadCodes() {
  try {
    const data = await readFile(SUPPORTERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load supporters file:', error);
    return { codes: [] };
  }
}

/**
 * Save supporter codes to JSON file
 */
async function saveCodes(data) {
  try {
    await writeFile(SUPPORTERS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save supporters file:', error);
    return false;
  }
}

/**
 * Validate a supporter code
 * Returns { valid: boolean, data: object }
 */
export async function validateCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false };
  }

  const data = await loadCodes();
  const supporter = data.codes.find(c => c.code === code.toUpperCase());

  if (!supporter) {
    return { valid: false };
  }

  // Check if expired
  const now = new Date();
  const expiryDate = new Date(supporter.expires_at);

  if (expiryDate < now) {
    return { 
      valid: false, 
      expired: true,
      data: supporter 
    };
  }

  return { 
    valid: true, 
    data: supporter 
  };
}

/**
 * Add a new supporter code
 */
export async function addCode(email, kofiData = {}) {
  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  const data = await loadCodes();
  
  const newSupporter = {
    code,
    email,
    status: 'active',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    kofi_transaction_id: kofiData.message_id || null,
    kofi_from_name: kofiData.from_name || null
  };

  data.codes.push(newSupporter);
  
  const saved = await saveCodes(data);
  
  return saved ? newSupporter : null;
}

/**
 * Extend a supporter code expiry (on renewal)
 */
export async function extendCode(code) {
  const data = await loadCodes();
  const supporter = data.codes.find(c => c.code === code.toUpperCase());

  if (!supporter) {
    return false;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Extend 30 days

  supporter.expires_at = expiresAt.toISOString();
  supporter.status = 'active';

  return await saveCodes(data);
}

/**
 * Deactivate a supporter code (on cancellation)
 */
export async function deactivateCode(email) {
  const data = await loadCodes();
  const supporter = data.codes.find(c => c.email === email);

  if (!supporter) {
    return false;
  }

  supporter.status = 'cancelled';
  
  return await saveCodes(data);
}
