import * as readline from 'readline';
import { insertDataInMongoDB } from './Excelread_inputMongo';
import { getSchedule, getScheduleFromMongoDB } from './getSchedule';

// Основная асинхронная функция для выполнения программы
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Введите 1 для загрузки расписания в базу данных или 2 для получения расписания: ', async (choice) => {
    if (choice === '1') {
      rl.question('Введите полный путь к файлу Excel с расписанием: ', async (filePath) => {
        try {
          await insertDataInMongoDB(filePath);
          console.log('Расписание успешно загружено в базу данных.');
        } catch (error) {
          console.error('Произошла ошибка при загрузке расписания:', error);
        } finally {
          rl.close();
        }
      });
    } else if (choice === '2') {
      rl.question('Введите фамилию преподавателя, название группы (например, "22з") или номер аудитории (например, "1-467"): ', async (input) => {
        const groupPattern = /^[0-9]{2}[а-я]{1}$/i; // Регулярное выражение для определения группы
        const classroomPattern = /^\d{1}-\d{3}$/; // Регулярное выражение для определения аудитории

        try {
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
    } else {
      console.log('Неверный выбор. Пожалуйста, введите 1 или 2.');
      rl.close();
    }
  });
}

main();