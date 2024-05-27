import { MongoClient} from 'mongodb';
import * as fs from 'fs';
import * as path from 'path'
import { HTMLGeneratorT, HTMLGenerator, ExtendedScheduleEntry } from './HTMLGenerators';
import { PairSchedule} from './Excelread_inputMongo';

// Определение интерфейса для записи расписания в MongoDB
interface MongoScheduleEntry {
  dayOfWeek: string; 
  time: string; 
  pairs: {
    group: string; 
    classroom: string; 
    subject: string; 
  }[];
}

// Определение интерфейса для расписания преподавателя в MongoDB
export interface MongoTeacherSchedule {
  _id: string; 
  name: string; 
  schedule: {
      odd: MongoScheduleEntry[]; 
      even: MongoScheduleEntry[]; 
  };
}

// Асинхронная функция для получения расписания преподавателя из MongoDB
export async function getScheduleFromMongoDB(teacherLastName: string): Promise<void> {
    const url = "mongodb://root:example@localhost:27017/";
    const dbName = 'Kursovya';
    const collectionNameT = 'Teachers'; 

    const client = new MongoClient(url);
  
    try {
      await client.connect();
      console.log("Успешное подключение к MongoDB");
  
      const db = client.db(dbName);
      const collection = db.collection(collectionNameT);
  
      const query = { name: { $regex: teacherLastName, $options: 'i' } };
      const teacher = await collection.findOne(query);
  
      if (teacher) {
        // Генерация HTML-таблицы с расписанием с помощью класса HTMLGeneratorT
        const htmlTable = HTMLGeneratorT.generateTable(teacher.schedule);
        // Формирование полного HTML-документа
        const htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Расписание для ${teacher.name}</title>
            <style>
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Расписание для преподавателя: ${teacher.name}</h1>
            ${htmlTable}
          </body>
          </html>
        `;
  
        const filename = `${teacherLastName}_schedule.html`;
        fs.writeFileSync(path.join(__dirname, filename), htmlContent);
        console.log(`Расписание для ${teacher.name} сохранено: ${filename}`);
      } else {
        console.log(`Расписание для преподавателя: ${teacherLastName}, не найдено.`);
      }
    } catch (err) {
      console.error("Произошла ошибка при получении расписания:", err);
    } finally {
      await client.close();
    }
}

// Асинхронная функция для получения и фильтрации расписания, а затем сохранения его в HTML-файл
export async function getSchedule(
    filter: (entry: PairSchedule) => boolean, 
    filename: string, 
    title: string 
    ): Promise<void> {
    const url = "mongodb://root:example@localhost:27017/";
    const dbName = 'Kursovya'; 
    const collectionNameT = 'Teachers'; 
    const client = new MongoClient(url);

    try {
        await client.connect();
        console.log("Успешное соединение с MongoDB");

        const db = client.db(dbName);
        const collection = db.collection<MongoTeacherSchedule>(collectionNameT);

        const teachers = await collection.find({}).toArray();
        const uniqueEntries = new Map<string, ExtendedScheduleEntry>();

        // Все расписаний преподавателей
        for (const teacher of teachers) {
            // Расписание: нечетные и четные недели
            for (const weekType of ['odd', 'even'] as const) {
                // Дни недели
                for (const daySchedule of teacher.schedule[weekType]) {
                    // Все пар в дне
                    for (const pair of daySchedule.pairs) {
                      const fullPair: PairSchedule = {
                        group: pair.group,
                        classroom: pair.classroom,
                        subject: pair.subject,
                        teacher: teacher.name 
                      };
                        // Применение фильтра к паре
                        if (filter(fullPair)) {
                            const key = `${weekType}-${daySchedule.dayOfWeek}-${daySchedule.time}-${pair.subject}-${pair.group}-${pair.classroom}`;
                            if (!uniqueEntries.has(key)) {
                                uniqueEntries.set(key, {
                                    Преподаватель: teacher.name,
                                    dayOfWeek: daySchedule.dayOfWeek,
                                    time: daySchedule.time,
                                    subject: pair.subject,
                                    group: pair.group,
                                    classroom: pair.classroom,
                                    weekType: weekType
                                });
                            }
                        }
                    }
                }
            }
        }

        // Преобразование в массив для генерации HTML
        const filteredEntries = Array.from(uniqueEntries.values());

        if (filteredEntries.length === 0) {
          console.log(`Нет расписания для ${title}.`);
          process.exit(1);
      }
        // Создание экземпляра класса HTMLGenerator для генерации HTML-таблицы
        const htmlGenerator = new HTMLGenerator();
        const htmlTable = htmlGenerator.generateHTMLTable(filteredEntries);

        // Формирование полного HTML-документа
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Расписание для ${title}</title>
            <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .week-header { background-color: #e8e8e8; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Расписание для ${title}</h1>
            ${htmlTable}
        </body>
        </html>
        `;

        fs.writeFileSync(path.join(__dirname, filename), htmlContent);
        console.log(`Расписание было сохранено - ${filename}`);
    } catch (err) {
        console.error("Произошла ошибка при получении расписания:", err);
    } finally {
        await client.close();
    }
}