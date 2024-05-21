import { MongoClient} from 'mongodb';
import * as fs from 'fs';
import * as path from 'path'
import { HTMLGeneratorT, HTMLGenerator, MongoTeacherSchedule, ExtendedScheduleEntry } from './HTMLGenerators';
import { PairSchedule} from './Excelread_inputMongo';


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
  
      // Поиск расписания преподавателя по фамилии
      const query = { name: { $regex: teacherLastName, $options: 'i' } };
      const teacher = await collection.findOne(query);
  
      if (teacher) {
        // Генерация HTML-таблицы с расписанием
        const htmlTable = HTMLGeneratorT.generateTable(teacher.schedule);
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
  
        // Запись HTML в файл
        const filename = `${teacherLastName}_schedule.html`;
        fs.writeFileSync(path.join(__dirname, filename), htmlContent);
        console.log(`Расписание для ${teacher.name} сохранено: ${filename}`);
      } else {
        console.log(`Расписание для преподавателя: ${teacherLastName}, не найдено.`);
      }
    } catch (err) {
      console.error("Произошла ошибка при получении расписания:", err);
    } finally {
      // Закрываем соединение с базой данных
      await client.close();
    }
}

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

    // Retrieve all teacher schedules
    const teachers = await collection.find({}).toArray();

    // Используем Map для хранения уникальных записей
    const uniqueEntries = new Map<string, ExtendedScheduleEntry>();

    for (const teacher of teachers) {
    for (const weekType of ['odd', 'even'] as const) {
        for (const daySchedule of teacher.schedule[weekType]) {
        for (const pair of daySchedule.pairs) {
            if (filter(pair)) {
            // Создаем уникальный ключ для каждой записи
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

    // Преобразуем Map обратно в массив для генерации HTML
    const filteredEntries = Array.from(uniqueEntries.values());

    const htmlGenerator = new HTMLGenerator();
    const htmlTable = htmlGenerator.generateHTMLTable(filteredEntries);

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