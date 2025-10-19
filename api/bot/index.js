import { Telegraf } from 'telegraf';
import { createReadStream, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Создаем бота
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Временное хранилище аудио
const audioStorage = new Map();

// Обработка команды /start
bot.command('start', (ctx) => {
  const args = ctx.message.text.split(' ')[1];
  if (args && audioStorage.has(args)) {
    const audioFileId = audioStorage.get(args);
    ctx.replyWithVoice({ source: audioFileId });
    // Удаляем после отправки
    audioStorage.delete(args);
  } else {
    ctx.reply('👋 Привет! Я бот "Спасибо".\n\nОткрой Mini App, чтобы записать голосовое сообщение.');
  }
});

// Обработка webhook
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const body = req.body;

    if (body.type === 'send_voice_email') {
      try {
        // Сохраняем аудио во временный файл
        const audioBuffer = Buffer.from(body.audioData, 'base64');
        const tempFilePath = join(tmpdir(), `voice_${body.audioId}.webm`);
        writeFileSync(tempFilePath, audioBuffer);

        // Сохраняем в памяти
        audioStorage.set(body.audioId, tempFilePath);

        // Отправляем email
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: body.email,
            subject: 'Тебе спасибо! ❤️',
            body: `Привет!\n\nКто-то хотел сказать тебе спасибо. Перейди по ссылке, чтобы послушать голосовое сообщение:\n\nhttps://t.me/YOUR_BOT_USERNAME?start=${body.audioId}\n\nС теплом,\nТвой друг ❤️`
          })
        });

        const result = await response.json();

        if (result.success) {
          res.status(200).json({ success: true });
        } else {
          res.status(500).json({ success: false, error: result.error });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    } else {
      // Обработка Telegram webhook
      try {
        await bot.handleUpdate(body);
        res.status(200).json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};