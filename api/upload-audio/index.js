import { put } from '@vercel/blob';
import busboy from 'busboy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const bb = busboy({ headers: req.headers });
  let audioFileBuffer;
  let audioFileName;

  bb.on('file', (fieldname, file, info) => {
    if (fieldname === 'audio') {
      const { filename, mimeType } = info;
      audioFileName = filename;
      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('end', () => {
        audioFileBuffer = Buffer.concat(chunks);
      });
    }
  });

  bb.on('close', async () => {
    if (!audioFileBuffer) {
      return res.status(400).json({ error: 'No audio file received' });
    }

    const audioId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const fileName = `${audioId}.webm`;

    try {
      const blob = await put(fileName, audioFileBuffer, {
        access: 'public',
        contentType: 'audio/webm',
      });

      res.status(200).json({ audioId, url: blob.url });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  req.pipe(bb);
}
