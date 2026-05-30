/**
 * Forensic Sketching Canvas Utilities
 */

/**
 * Calculates the bounding box size for an annotation callout based on text content.
 */
export const calculateCalloutSize = (text: string, fontSize: number = 14) => {
  const lines = text.split('\n');
  const maxChars = Math.max(...lines.map(l => l.length), 1);
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.3;
  
  const w = Math.max(60, maxChars * charWidth + 20); // Minimal padding
  const boxH = Math.max(30, lines.length * lineHeight + 15);
  const h = boxH * 1.33; // Add tail height proportionally
  
  return { w, h };
};

/**
 * Determines the effective Z-Index for an object, accounting for template layers.
 */
export const getEffectiveZIndex = (obj: any) => {
  if (obj.isTemplate) {
    if (obj.zIndex < 0) return obj.zIndex; 
    return (obj.zIndex || 0) + 100000; 
  }
  return obj.zIndex || 0;
};
