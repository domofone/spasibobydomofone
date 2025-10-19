import busboy from 'busboy';

// Используем временное хранилище в памяти
const storage = new Map();

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

  bb.on('file', (fieldname, file, info) => {
    if (fieldname === 'audio') {
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

    // Сохраняем в памяти на 1 час
    storage.set(audioId, audioFileBuffer);

    // Удаляем через 1 час
    setTimeout(() => {
      storage.delete(audioId);
    }, 60 * 60 * 1000);

    res.status(200).json({ audioId });
  });

  req.pipe(bb);
}
