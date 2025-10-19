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

        if (text === '/start' || text.includes('/start')) {
          userState.delete(chatId);
          await bot.sendMessage(
            chatId, 
            `❤️ Добро пожаловать в проект "Спасибо"!\n\nЯ помогу вам отправить голосовую благодарность дорогому человеку.\n\n🎤 **Как использовать:**\n1. Запишите голосовое сообщение с благодарностью\n2. Отправьте его мне\n3. Укажите email получателя\n4. Я анонимно отправлю ваше сообщение!\n\n💌 **Ваша благодарность будет доставлена в виде:**\n• Красивого письма на email\n• Голосового сообщения для прослушивания\n• Ссылки для скачивания\n\nДавайте сделаем мир добрее! ✨`,
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
        else if (voice) {
          userState.set(chatId, { voiceFileId: voice.file_id });
          await bot.sendMessage(
            chatId, 
            "🎵 Отлично! Голосовое сообщение получено!\n\nТеперь введите **email получателя**, на который нужно отправить вашу благодарность:",
            { parse_mode: 'Markdown' }
          );
        } 
        else if (text && text.includes('@')) {
          const userData = userState.get(chatId);
          
          if (userData?.voiceFileId) {
            await bot.sendMessage(chatId, "⏳ Обрабатываю ваше сообщение и отправляю благодарность...");
            
            try {
              const fileLink = await bot.getFileLink(userData.voiceFileId);
              
              // Отправка email
              await mailTransporter.sendMail({
                from: `"Проект Спасибо" <${GMAIL_USER}>`,
                to: text,
                subject: "💌 Вам пришла голосовая благодарность!",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div style="background: white; color: #333; padding: 30px; border-radius: 15px; text-align: center;">
                      <h1 style="color: #e91e63; margin-bottom: 20px;">❤️ Вам пришло голосовое сообщение с благодарностью!</h1>
                      <p style="font-size: 16px; margin-bottom: 25px;">Кто-то очень ценит вас и хочет сказать "Спасибо" просто за то, что вы есть в их жизни.</p>
                      
                      <div style="background: #f9f9f9; padding: 25px; border-radius: 10px; margin: 25px 0;">
                        <p style="font-weight: bold; color: #e91e63; margin-bottom: 15px;">🎵 Ваше голосовое сообщение:</p>
                        <audio controls style="width: 100%; margin: 15px 0;">
                          <source src="${fileLink}" type="audio/ogg">
                          Ваш браузер не поддерживает аудио элементы.
                        </audio>
                        <p style="margin-top: 10px;">
                          <a href="${fileLink}" style="color: #e91e63; text-decoration: none; font-weight: bold;">📥 Скачать сообщение</a>
                        </p>
                      </div>
                      
                      <p style="font-style: italic; color: #666; margin-top: 25px;">
                        С любовью от проекта "Спасибо" ❤️<br>
                        <small>Это сообщение отправлено анонимно. Цените тех, кто вас окружает!</small>
                      </p>
                    </div>
                  </div>
                `
              });

              await bot.sendMessage(
                chatId, 
                `✅ **Готово!** Ваша благодарность успешно отправлена на email:\n\n📧 ${text}\n\nСпасибо, что делитесь добром и делаете мир теплее! ❤️\n\nХотите отправить еще одну благодарность? Просто запишите новое голосовое сообщение!`,
                { parse_mode: 'Markdown' }
              );
              
              userState.delete(chatId);
              
            } catch (error) {
              console.error('Error:', error);
              await bot.sendMessage(
                chatId, 
                "❌ Произошла ошибка при отправке. Пожалуйста, проверьте email и попробуйте еще раз."
              );
            }
          } else {
            await bot.sendMessage(
              chatId, 
              "❌ Сначала запишите голосовое сообщение с благодарностью и отправьте его мне!"
            );
          }
        }
        else if (text) {
          await bot.sendMessage(
            chatId, 
            "📝 Чтобы отправить благодарность:\n1. Запишите голосовое сообщение\n2. Отправьте его мне\n3. Укажите email получателя\n\nИли откройте веб-приложение для подробной инструкции 👇",
            {
              reply_markup: {
                inline_keyboard: [[
                  { text: "📱 Открыть приложение", web_app: { url: VERCEL_URL } }
                ]]
              }
            }
          );
        }
      }
      
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(200).json({ ok: false });
    }
  } 
  // Health check
  else {
    res.status(200).json({ 
      status: 'OK', 
      project: 'Spasibo Bot',
      bot: '@Spasibotebe_bot'
    });
  }
};
