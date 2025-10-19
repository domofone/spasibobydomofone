// api/get-audio/index.js
export const config = {
  api: {
    bodyParser: false,
  },
};

// Используем ту же память
const storage = new Map();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing audio ID' });
  }

  const buffer = storage.get(id);
  if (!buffer) {
    return res.status(404).json({ error: 'Audio not found' });
  }

  res.setHeader('Content-Type', 'audio/webm');
  res.send(buffer);
}