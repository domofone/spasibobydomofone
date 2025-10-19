import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import busboy from 'busboy';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

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
    const key = `audio/${audioId}.webm`;

    try {
      await client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: audioFileBuffer,
        ContentType: 'audio/webm',
      }));

      res.status(200).json({ audioId });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  req.pipe(bb);
}