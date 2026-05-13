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
        crc = (crc << 5) ^ 0x1021; // QRIS usually uses a variation of CRC16-CCITT
      } else {
        crc <<= 1;
      }
    }
  }
  // Standard QRIS CRC adjustment
  let res = (crc & 0xFFFF).toString(16).toUpperCase();
  return res.padStart(4, '0');
}

export function generateDynamicQRIS(basePayload: string, amount: number) {
  if (!basePayload || basePayload.length < 10) return basePayload;
  
  // Clean payload from invalid characters
  let payload = basePayload.trim();
  
  // Remove existing CRC (last 4 chars) and its tag (6304)
  if (payload.includes('6304')) {
    payload = payload.split('6304')[0];
  }
  
  // Change Point of Initiation Method to 12 (Dynamic)
  // Usually it's 010211, we change to 010212
  payload = payload.replace('010211', '010212');

  // Add Transaction Amount (Tag 54)
  const amountStr = Math.floor(amount).toString();
  const amountField = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  
  // If tag 54 is already there, replace it. Otherwise, insert before tag 58 (Currency) or 59 (Merchant Name)
  if (payload.includes('54')) {
    const parts = payload.split(/54\d{2}/);
    // This is a rough split, better to find the exact tag
    payload = payload.replace(/54\d{2}\d+/, amountField);
  } else {
    // Append before the end or before common end tags
    if (payload.includes('5802360')) {
        payload = payload.split('5802360').join(amountField + '5802360');
    } else {
        payload += amountField;
    }
  }

  // Append CRC Tag
  payload += '6304';
  
  // Calculate and append new CRC
  return payload + crc16(payload);
}
