const Bot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const VERCEL_URL = process.env.VERCEL_URL || 'https://spasibo.vercel.app';

// Используем polling для разработки, вебхук для продакшена
const bot = process.env.VERCEL_ENV === 'production' 
  ? new Bot(BOT_TOKEN, { webHook: true })
  : new Bot(BOT_TOKEN, { polling: false });

const userState = new Map();

// Настройка почты
const mailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD
  }
});

// Функция для установки вебхука
async function setWebhook() {
  try {
    await bot.setWebHook(`${VERCEL_URL}/api/bot`);
    console.log('Webhook set successfully');
  } catch (error) {
    console.error('Error setting webhook:', error);
  }
}

// Устанавливаем вебхук при запуске
if (process.env.VERCEL_ENV === 'production') {
  setWebhook();
}

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  
  console.log('Incoming request:', { method, url });

  // Обработка вебхука Telegram
  if (method === 'POST' && url === '/api/bot') {
    try {
      const { body } = req;
      console.log('Telegram webhook body:', JSON.stringify(body, null, 2));

      if (!body.message) {
        return res.status(200).json({ ok: true, message: 'No message in update' });
      }

      const chatId = body.message.chat.id;
      const text = body.message.text;
      const voice = body.message.voice;
      const firstName = body.message.from.first_name;

      console.log('Processing message:', { chatId, text, voice: !!voice });

      // Команда /start
      if (text === '/start' || text?.includes('/start')) {
        userState.delete(chatId);
        await bot.sendMessage(
          chatId, 
          `❤️ Привет, ${firstName || 'друг'}! Добро пожаловать в проект "Спасибо"!\n\nЯ помогу тебе отправить голосовую благодарность дорогому человеку.\n\n🎤 **Как это работает:**\n1. Запиши голосовое сообщение с благодарностью\n2. Отправь его мне\n3. Укажи email получателя\n4. Я анонимно отправлю твое сообщение!\n\nПросто запиши голосовое сообщение и отправь мне 🎵`,
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть веб-приложение", web_app: { url: VERCEL_URL } }
              ]]
            }
          }
        );
      } 
      // Обработка голосового сообщения
      else if (voice) {
        console.log('Voice message received, file_id:', voice.file_id);
        userState.set(chatId, { 
          voiceFileId: voice.file_id,
          timestamp: Date.now()
        });
        
        await bot.sendMessage(
          chatId, 
          "🎵 Отлично! Голосовое сообщение получено!\n\nТеперь введи **email получателя**, на который нужно отправить твою благодарность:",
          { parse_mode: 'Markdown' }
        );
      } 
      // Обработка email
      else if (text && text.includes('@') && text.includes('.')) {
        const userData = userState.get(chatId);
        console.log('Email received:', text, 'User data:', userData);
        
        if (userData?.voiceFileId) {
          await bot.sendMessage(chatId, "⏳ Обрабатываю твое сообщение и отправляю благодарность...");
          
          try {
            // Получаем информацию о файле
            const file = await bot.getFile(userData.voiceFileId);
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
            
            console.log('File URL:', fileUrl);

            // Отправка email
            await mailTransporter.sendMail({
              from: `"Проект Спасибо" <${GMAIL_USER}>`,
              to: text,
              subject: "💌 Вам пришла голосовая благодарность!",
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 2px; border-radius: 15px;">
                    <div style="background: white; padding: 30px; border-radius: 13px; text-align: center;">
                      <h1 style="color: #e91e63; margin-bottom: 20px;">❤️ Вам пришло голосовое сообщение с благодарностью!</h1>
                      <p style="font-size: 16px; margin-bottom: 25px; color: #333;">
                        Кто-то очень ценит вас и хочет сказать "Спасибо" просто за то, что вы есть в их жизни.
                      </p>
                      
                      <div style="background: #f9f9f9; padding: 25px; border-radius: 10px; margin: 25px 0;">
                        <p style="font-weight: bold; color: #e91e63; margin-bottom: 15px;">🎵 Ваше голосовое сообщение:</p>
                        <audio controls style="width: 100%; margin: 15px 0;">
                          <source src="${fileUrl}" type="audio/ogg">
                          Ваш браузер не поддерживает аудио элементы.
                        </audio>
                        <p style="margin-top: 10px;">
                          <a href="${fileUrl}" style="color: #e91e63; text-decoration: none; font-weight: bold;">📥 Скачать сообщение</a>
                        </p>
                      </div>
                      
                      <p style="font-style: italic; color: #666; margin-top: 25px;">
                        С любовью от проекта "Спасибо" ❤️<br>
                        <small>Это сообщение отправлено анонимно. Цените тех, кто вас окружает!</small>
                      </p>
                    </div>
                  </div>
                </div>
              `
            });

            console.log('Email sent successfully to:', text);

            await bot.sendMessage(
              chatId, 
              `✅ **Готово!** Твоя благодарность успешно отправлена на email:\n\n📧 ${text}\n\nСпасибо, что делишься добром и делаешь мир теплее! ❤️\n\nХочешь отправить еще одну благодарность? Просто запиши новое голосовое сообщение!`,
              { parse_mode: 'Markdown' }
            );
            
            // Очищаем состояние
            userState.delete(chatId);
            
          } catch (error) {
            console.error('Error processing voice message:', error);
            await bot.sendMessage(
              chatId, 
              "❌ Произошла ошибка при отправке. Пожалуйста, проверь email и попробуй еще раз. Если проблема повторится, попробуй записать сообщение покороче."
            );
          }
        } else {
          await bot.sendMessage(
            chatId, 
            "❌ Сначала запиши голосовое сообщение с благодарностью и отправь его мне! Просто нажми и удерживай значок микрофона в Telegram."
          );
        }
      }
      // Любой другой текст
      else if (text) {
        await bot.sendMessage(
          chatId, 
          `📝 Чтобы отправить благодарность:\n1. Запиши голосовое сообщение (нажми и удерживай значок микрофона 📎)\n2. Отправь его мне\n3. Укажи email получателя\n\nИли открой веб-приложение для подробной инструкции 👇`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: "📱 Открыть приложение", web_app: { url: VERCEL_URL } }
              ]]
            }
          }
        );
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ ok: false, error: error.message });
    }
  } 
  // Health check и установка вебхука
  else if (method === 'GET' && url === '/api/bot') {
    try {
      const webhookInfo = await bot.getWebHookInfo();
      res.status(200).json({ 
        status: 'OK', 
        project: 'Spasibo Bot',
        bot: '@Spasibotebe_bot',
        webhook: webhookInfo
      });
    } catch (error) {
      res.status(200).json({ 
        status: 'ERROR', 
        error: error.message 
      });
    }
  }
  // Установка вебхука
  else if (method === 'POST' && url === '/api/set-webhook') {
    try {
      await setWebhook();
      res.status(200).json({ ok: true, message: 'Webhook set successfully' });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  }
  else {
    res.status(404).json({ error: 'Not found' });
  }
};
