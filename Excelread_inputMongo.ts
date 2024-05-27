import * as ExcelJS from 'exceljs';
import { MongoClient} from 'mongodb';

// Интерфейс для пары в расписании
export interface PairSchedule {
    group: string;
    classroom: string;
    subject: string;
    teacher: string;
  }

// Интерфейс для расписания на один день
export interface DaySchedule {
    dayOfWeek: string;
    time: string;
    pairs: PairSchedule[]; // Массив пар в этот день
}

// Интерфейс для полного расписания (нечетные и четные недели)
export interface Schedule {
    odd: DaySchedule[]; 
    even: DaySchedule[];
}

// Интерфейс для расписания преподавателя
export interface TeacherSchedule {
    name: string; 
    schedule: Schedule; 
}

// Функция для разделения содержимого ячейки на группу, аудиторию и предмет
const splitGroupAndClassroom = (cellContent: string): PairSchedule => {
    let group = '';
    let classroom = '';
    let subject = '';
    let teacher = '';

    // Удаляем лишние точки с запятой из строки с группами
    const cleanedGroupString = cellContent.replace(/;+/g, ';').replace(/;+$/, '');

    // Проверка формата "группа;группа а.аудитория"
    const groupAndClassroomRegex = /((?:\d{2}[а-яА-Я]~?[;]?)+)\s+а\.(\d{1,2}-\d{3})/i;
    // Поиск соответствия в строке
    const groupAndClassroomMatch = cleanedGroupString.match(groupAndClassroomRegex);

    if (groupAndClassroomMatch) {
        // Извлекаем информацию о группе, если она есть
        group = groupAndClassroomMatch[1].trim();
        // Извлекаем информацию об аудитории
        classroom = groupAndClassroomMatch[2].trim();
        // Предполагаем, что оставшаяся часть строки - это предмет
        subject = cleanedGroupString.replace(groupAndClassroomMatch[0], '').trim();
    } else {
        // Если информация о группе и аудитории отсутствует, предполагаем, что вся ячейка - это предмет
        subject = cleanedGroupString.trim();
    }

    return { group, classroom, subject, teacher };
};


const timeSlots = ['08.00-09.35', '09.45-11.20', '11.30-13.05', '13.55-15.30', '15.40-17.15'];
const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

// Асинхронная функция для чтения Excel файла и преобразования данных в структурированный формат
async function ExcelReader(filePath: string): Promise<TeacherSchedule[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Преподаватели');

    if (!worksheet) {
        throw new Error('Worksheet "Преподаватели" not found.');
    }

    const teacherSchedules: TeacherSchedule[] = [];
    let currentRow = 7; // Начальная строка для первого преподавателя

    // Цикл по строкам листа, пока не закончатся преподаватели
    while (worksheet.getCell(`B${currentRow}`).value) {
        // Получаем имя преподавателя из ячейки
        const teacherName = worksheet.getCell(`B${currentRow}`).value as string;
        // Создаем объект расписания для преподавателя
        const schedule: Schedule = { odd: [], even: [] };

        // Обработка каждого времени
        for (let timeSlotIndex = 0; timeSlotIndex < timeSlots.length; timeSlotIndex++) {
            const time = timeSlots[timeSlotIndex]; // Время проведения пары

            // Обработка каждого дня недели
            for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                // Создаем объекты для расписания на нечетные и четные недели
                const dayScheduleOdd: DaySchedule = { dayOfWeek: dayNames[dayIndex], time, pairs: [] };
                const dayScheduleEven: DaySchedule = { dayOfWeek: dayNames[dayIndex], time, pairs: [] };

                // Считывание данных для нечетной и четной недели
                const rowForTimeSlot = currentRow + 2 + timeSlotIndex * 4; // Строка для времени
                const colForDay = 2 + dayIndex; // Столбец для дня недели

                // Нечетная неделя
                const groupAndClassroomOdd = worksheet.getCell(rowForTimeSlot, colForDay).text.trim();
                const subjectOdd = worksheet.getCell(rowForTimeSlot + 1, colForDay).text.trim();
                // Если есть информация о группе и предмете, добавляем в расписание
                if (groupAndClassroomOdd && subjectOdd) {
                    const { group, classroom } = splitGroupAndClassroom(groupAndClassroomOdd);
                    dayScheduleOdd.pairs.push({ group, classroom, subject: subjectOdd, teacher: teacherName  });
                }

                // Четная неделя
                const groupAndClassroomEven = worksheet.getCell(rowForTimeSlot + 2, colForDay).text.trim();
                const subjectEven = worksheet.getCell(rowForTimeSlot + 3, colForDay).text.trim();
                // Если есть информация о группе и предмете, добавляем в расписание
                if (groupAndClassroomEven && subjectEven) {
                    const { group, classroom } = splitGroupAndClassroom(groupAndClassroomEven);
                    dayScheduleEven.pairs.push({ group, classroom, subject: subjectEven, teacher: teacherName  });
                }

                // Добавление сформированных объектов DaySchedule в расписание
                if (dayScheduleOdd.pairs.length > 0) {
                    schedule.odd.push(dayScheduleOdd);
                }
                if (dayScheduleEven.pairs.length > 0) {
                    schedule.even.push(dayScheduleEven);
                }
            }
        }

        // Добавляем расписание преподавателя в массив
        teacherSchedules.push({ name: teacherName, schedule });
        currentRow += 32; // Переход к следующему преподавателю
    }

    return teacherSchedules;
}

// Асинхронная функция для вставки данных в MongoDB
export async function insertDataInMongoDB(filePath: string): Promise<void> {
    const teacherSchedules = await ExcelReader(filePath);

    const url = "mongodb://root:example@localhost:27017/";
    const dbName = 'Kursovya';
    const collectionNameT = 'Teachers';

    const client = new MongoClient(url);
    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection<TeacherSchedule>(collectionNameT);

        for (const teacherSchedule of teacherSchedules) {
            await collection.updateMany(
              { name: teacherSchedule.name },
              { $set: teacherSchedule },
              { upsert: true }
            );
          }
    } catch (err) {
        console.error("Произошла ошибка при вставке или обновлении данных в MongoDB:", err);
    } finally {
        await client.close();
    }
}