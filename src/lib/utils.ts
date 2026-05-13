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
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

export function generateDynamicQRIS(basePayload: string, amount: number) {
  if (!basePayload || basePayload.length < 10) return basePayload;
  
  // Remove existing CRC (last 4 chars) and its tag (6304)
  let payload = basePayload.substring(0, basePayload.length - 8);
  
  // Change Point of Initiation Method to 12 (Dynamic)
  // Tag 01 is usually at index 3: 010211 (static) -> 010212 (dynamic)
  payload = payload.replace('010211', '010212');

  // Add Transaction Amount (Tag 54)
  const amountStr = amount.toString();
  const amountField = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  
  // Check if tag 54 already exists, if so replace it, else append before tag 58/59 or at the end
  if (payload.includes('54')) {
    // Simple replacement if present
    const regex = /54\d{2}\d+/;
    payload = payload.replace(regex, amountField);
  } else {
    payload += amountField;
  }

  // Append CRC Tag
  payload += '6304';
  
  // Calculate and append new CRC
  return payload + crc16(payload);
}
