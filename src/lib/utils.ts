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

// Simple logic to generate a dynamic QRIS payload if we have a base static payload
// This is a simplified version and might need a proper CRC calculation in production
export function generateDynamicQRIS(basePayload: string, amount: number) {
  if (!basePayload) return "";
  
  // Basic QRIS amount field is tag 54
  // Format: 54[length][amount]
  const amountStr = amount.toString();
  const amountField = `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`;
  
  // We need to replace or insert tag 54 and recalculate CRC (tag 63)
  // For simplicity in this demo, we'll just return a placeholder or the base if it's too complex
  // In a real app, you'd use a dedicated library or backend service for CRC calculation.
  
  return basePayload; // Returning base for now as CRC calculation is non-trivial without a dedicated lib
}
