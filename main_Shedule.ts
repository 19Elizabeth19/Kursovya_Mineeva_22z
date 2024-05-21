import * as readline from 'readline';
import { insertDataIntoMongoDB } from './Excelread_inputMongo';
import { getSchedule, getScheduleFromMongoDB } from './getSchedule';

async function main() {
    // Создание интерфейса командной строки и запрос у пользователя информации
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  
    rl.question('Введите фамилию преподавателя, название группы (например, "22з") или номер аудитории (например, "1-467"): ', async (input) => {
      const filePath = 'C:\\Users\\qwerty\\project1\\kursovya\\src\\Raspisanie.xlsx'; // Укажите актуальный путь к файлу Excel
      const groupPattern = /^[0-9]{2}[а-я]{1}$/i; // Регулярное выражение для определения группы
      const classroomPattern = /^\d{1,2}-\d{3}$/; // Регулярное выражение для определения аудитории
  
      try {
        await insertDataIntoMongoDB(filePath);
        if (groupPattern.test(input)) {
          // Фильтр для группы
          const groupFilter = (pair: { group: string; classroom: string; subject: string; }) => pair.group.includes(input);
          await getSchedule(groupFilter, `${input}_schedule.html`, `группы ${input}`);
        } else if (classroomPattern.test(input)) {
          // Фильтр для аудитории
          const classroomFilter = (pair: { group: string; classroom: string; subject: string; }) => pair.classroom === input;
          await getSchedule(classroomFilter, `classroom_${input}_schedule.html`, `аудитории ${input}`);
        } else {
          // В противном случае предполагаем, что это фамилия преподавателя и получаем расписание преподавателя
          await getScheduleFromMongoDB(input);
        }
      } catch (error) {
        console.error('Произошла ошибка:', error);
      } finally {
        rl.close();
      }
    });
  }
  
  main();