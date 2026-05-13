import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

// CRC16-CCITT for QRIS (Polynomial: 0x1021, Init: 0xFFFF)
function crc16(data: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQRIS(basePayload: string, amount: number) {
  if (!basePayload || basePayload.length < 10) return basePayload;
  
  // Clean payload
  let payload = basePayload.trim();
  
  // Remove existing CRC
  if (payload.includes('6304')) {
    payload = payload.split('6304')[0];
  }

  // Simple EMV Tag Parser & Modifier
  const tags: Record<string, string> = {};
  let i = 0;
  while (i < payload.length - 4) {
    const tag = payload.substring(i, i + 2);
    const lenStr = payload.substring(i + 2, i + 4);
    const len = parseInt(lenStr);
    const val = payload.substring(i + 4, i + 4 + len);
    
    if (isNaN(len)) break;
    
    tags[tag] = val;
    i += 4 + len;
  }

  // Update Tags
  tags['01'] = '12'; // Set to Dynamic
  tags['54'] = Math.floor(amount).toString(); // Set Amount
  
  // Re-assemble (Keeping original order as much as possible is good, but standard order is also fine)
  // Most important tags are 00, 01, 26-45, 51-53, 54, 58, 59, 60, 61, 62, 63
  let newPayload = "";
  const sortedTags = Object.keys(tags).sort();
  
  for (const tag of sortedTags) {
    const val = tags[tag];
    newPayload += tag + val.length.toString().padStart(2, '0') + val;
  }

  // Add CRC
  newPayload += '6304';
  return newPayload + crc16(newPayload);
}
