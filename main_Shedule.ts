import * as readline from 'readline';
import { insertDataInMongoDB } from './Excelread_inputMongo';
import { getSchedule, getScheduleFromMongoDB } from './getSchedule';

// Основная асинхронная функция для выполнения программы
async function main() {
    // Создание интерфейса командной строки для взаимодействия с пользователем
    const rl = readline.createInterface({
      input: process.stdin, // Ввод 
      output: process.stdout // Вывод 
    });
  
    // Задаем пользователю вопрос и ожидаем ввода
    rl.question('Введите фамилию преподавателя, название группы (например, "22з") или номер аудитории (например, "1-467"): ', async (input) => {

      // Путь к файлу с расписанием
      const filePath = 'C:\\Users\\qwerty\\project1\\kursovya\\src\\Raspisanie.xlsx';
      
      // Выражение для определения группы
      const groupPattern = /^[0-9]{2}[а-я]{1}$/i;
      // Выражение для определения аудитории
      const classroomPattern = /^\d{1,2}-\d{3}$/;
  
      try {
        // Вставка данных из Excel файла в MongoDB
        await insertDataInMongoDB(filePath);
        // Проверка введенных данных на соответствие шаблону группы
        if (groupPattern.test(input)) {
          // Создание фильтра для группы
          const groupFilter = (pair: { group: string; classroom: string; subject: string; }) => pair.group.includes(input);
          // Получение и сохранение расписания для группы
          await getSchedule(groupFilter, `${input}_schedule.html`, `группы ${input}`);
        } else if (classroomPattern.test(input)) {
          // Создание фильтра для аудитории
          const classroomFilter = (pair: { group: string; classroom: string; subject: string; }) => pair.classroom === input;
          // Получение и сохранение расписания для аудитории
          await getSchedule(classroomFilter, `classroom_${input}_schedule.html`, `аудитории ${input}`);
        } else {
          // Если введенные данные не соответствуют шаблонам группы или аудитории, предполагаем, что это фамилия преподавателя
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