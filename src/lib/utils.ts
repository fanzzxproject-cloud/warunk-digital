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

// CRC16-CCITT for QRIS (Standard EMV QR Specification)
function crc16(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        let x = ((crc >> 8) ^ data.charCodeAt(i)) & 0xFF;
        x ^= x >> 4;
        crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQRIS(basePayload: string, amount: number) {
  if (!basePayload || basePayload.length < 10) return basePayload;
  
  let payload = basePayload.trim();
  
  // 1. Remove Existing CRC (Tag 63)
  const crcIndex = payload.lastIndexOf('6304');
  if (crcIndex !== -1) {
    payload = payload.substring(0, crcIndex);
  }

  // Helper: Find tag position and length
  const findTag = (p: string, targetTag: string) => {
    let i = 0;
    while (i < p.length - 4) {
      const tag = p.substring(i, i + 2);
      const len = parseInt(p.substring(i + 2, i + 4));
      if (isNaN(len)) break;
      if (tag === targetTag) return { start: i, len: len };
      i += 4 + len;
    }
    return null;
  };

  // 2. Set Point of Initiation Method to 12 (Dynamic)
  const tag01 = findTag(payload, '01');
  if (tag01) {
    payload = payload.substring(0, tag01.start + 4) + '12' + payload.substring(tag01.start + 6);
  } else {
    // Standard static payload might be missing it, inject after 00
    payload = payload.substring(0, 4) + '010212' + payload.substring(4);
  }

  // 3. Set/Replace Transaction Amount (Tag 54)
  const amountStr = Math.floor(amount).toString();
  const amountTag = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  
  const tag54 = findTag(payload, '54');
  if (tag54) {
    payload = payload.substring(0, tag54.start) + amountTag + payload.substring(tag54.start + 4 + tag54.len);
  } else {
    // Insert before Tag 58
    const tag58 = findTag(payload, '58');
    if (tag58) {
      payload = payload.substring(0, tag58.start) + amountTag + payload.substring(tag58.start);
    } else {
      payload += amountTag;
    }
  }

  // 4. Re-calculate CRC
  payload += '6304';
  return payload + crc16(payload);
}
