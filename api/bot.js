const Bot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const VERCEL_URL = process.env.VERCEL_URL || 'https://spasibo.vercel.app';

const bot = new Bot(BOT_TOKEN, { webHook: true });
const userState = new Map();

// Настройка почты
const mailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

// Установка вебхука
bot.setWebHook(`${VERCEL_URL}/api/bot`);

module.exports = async (req, res) => {
  const { method, url } = req;
  
  // Обработка вебхука Telegram
  if (method === 'POST' && url === '/api/bot') {
    try {
      const { body } = req;
      
      if (body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text;
        const voice = body.message.voice;

        if (text === '/start') {
          userState.delete(chatId);
          await bot.sendMessage(
            chatId, 
            `❤️ Добро пожаловать в проект "Спасибо"!\n\nОтправьте голосовое сообщение с благодарностью, затем укажите email получателя.`,
            { 
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[
                  { text: "📱 Открыть приложение", web_app: { url: VERCEL_URL } }
                ]]
              }
            }
          );
        } 
        else if (voice) {
          userState.set(chatId, { voiceFileId: voice.file_id });
          await bot.sendMessage(chatId, "🎵 Голосовое получено! Теперь введите email получателя:");
        } 
        else if (text && text.includes('@')) {
          const userData = userState.get(chatId);
          
          if (userData?.voiceFileId) {
            await bot.sendMessage(chatId, "⏳ Отправляю вашу благодарность...");
            
            try {
              const fileLink = await bot.getFileLink(userData.voiceFileId);
              
              // Отправка email
              await mailTransporter.sendMail({
                from: `"Проект Спасибо" <${GMAIL_USER}>`,
                to: text,
                subject: "💌 Вам пришла благодарность!",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #e91e63;">❤️ Вам пришло голосовое сообщение с благодарностью!</h2>
                    <p>Кто-то хочет сказать вам "Спасибо" просто за то, что вы есть в их жизни.</p>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
                      <p>🎵 <strong>Голосовое сообщение:</strong></p>
                      <audio controls style="width: 100%; margin: 10px 0;">
                        <source src="${fileLink}" type="audio/ogg">
                        Ваш браузер не поддерживает аудио элементы.
                      </audio>
                      <p><a href="${fileLink}" style="color: #e91e63;">Ссылка для скачивания</a></p>
                    </div>
                    <p><em>С любовью от проекта "Спасибо" ❤️</em></p>
                  </div>
                `
              });

              await bot.sendMessage(chatId, `✅ Благодарность отправлена на ${text}\n\nСпасибо, что делаете мир добрее! ❤️`);
              userState.delete(chatId);
              
            } catch (error) {
              console.error('Error:', error);
              await bot.sendMessage(chatId, "❌ Ошибка отправки. Попробуйте еще раз.");
            }
          }
        }
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ ok: false });
    }
  } 
  // Health check и другие методы
  else {
    res.status(200).json({ status: 'OK', project: 'Spasibo Bot' });
  }
};