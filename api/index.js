const { exec } = require('child_process');

module.exports = (req, res) => {
  // Запускаем бота через npm start
  const child = exec('npm start');
  
  // Отправляем ответ сразу
  res.status(200).json({ message: 'Bot started' });
};