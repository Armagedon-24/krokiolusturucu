import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { verifyAuth } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Secure centralized authentication check
    if (!verifyAuth(req, res)) {
      return;
    }

    const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dzen3qvgp';
    const API_KEY = process.env.CLOUDINARY_API_KEY;
    const API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary API anahtarları eksik.' });
    }

    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'Config verisi eksik.' });
    }
    
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = 'kroki_config_v2';
    
    // Cloudinary signed upload signature calculation
    const paramsToSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(paramsToSign + API_SECRET).digest('hex');

    const fileDataUri = "data:application/json;base64," + Buffer.from(JSON.stringify(config)).toString('base64');

    const formData = new URLSearchParams();
    formData.append('file', fileDataUri);
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', API_KEY);
    formData.append('signature', signature);
    formData.append('resource_type', 'raw');
    formData.append('invalidate', 'true');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`,
      { method: 'POST', body: formData }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error('Cloudinary Save Error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Config Save Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
