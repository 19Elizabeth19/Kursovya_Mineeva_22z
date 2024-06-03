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
    const groupAndClassroomRegex = /((?:\d{2}[а-яА-Я]~?[;]?)+)\s+а\.(\d{1}-\d{3})/i;
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
    let currentRow = 7;

    while (worksheet.getCell(`B${currentRow}`).value) {
        const teacherName = worksheet.getCell(`B${currentRow}`).value as string;
        const schedule: Schedule = { odd: [], even: [] };

        for (let timeSlotIndex = 0; timeSlotIndex < timeSlots.length; timeSlotIndex++) {
            const time = timeSlots[timeSlotIndex];

            for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
                const rowForTimeSlot = currentRow + 2 + timeSlotIndex * 4;
                const colForDay = 2 + dayIndex;

                const groupAndClassroomOddCell = worksheet.getCell(rowForTimeSlot, colForDay).text.trim();
                const subjectOddCell = worksheet.getCell(rowForTimeSlot + 1, colForDay).text.trim();
                const groupAndClassroomEvenCell = worksheet.getCell(rowForTimeSlot + 2, colForDay).text.trim();
                const subjectEvenCell = worksheet.getCell(rowForTimeSlot + 3, colForDay).text.trim();

                // Проверяем, если первая и четвертая ячейки пусты, а вторая и третья содержат информацию
                if (!groupAndClassroomOddCell && subjectOddCell && groupAndClassroomEvenCell && !subjectEvenCell) {
                    const { group, classroom } = splitGroupAndClassroom(subjectOddCell);
                    const subject = groupAndClassroomEvenCell; // Предмет берется из третьей ячейки
                    const pair = { group, classroom, subject, teacher: teacherName };
                    // Добавляем пару в обе недели
                    schedule.odd.push({ dayOfWeek: dayNames[dayIndex], time, pairs: [pair] });
                    schedule.even.push({ dayOfWeek: dayNames[dayIndex], time, pairs: [pair] });
                } else {
                    // Обрабатываем нечетную неделю
                    if (groupAndClassroomOddCell && subjectOddCell) {
                        const { group, classroom } = splitGroupAndClassroom(groupAndClassroomOddCell);
                        schedule.odd.push({ dayOfWeek: dayNames[dayIndex], time, pairs: [{ group, classroom, subject: subjectOddCell, teacher: teacherName }] });
                    }
                    // Обрабатываем четную неделю
                    if (groupAndClassroomEvenCell && subjectEvenCell) {
                        const { group, classroom } = splitGroupAndClassroom(groupAndClassroomEvenCell);
                        schedule.even.push({ dayOfWeek: dayNames[dayIndex], time, pairs: [{ group, classroom, subject: subjectEvenCell, teacher: teacherName }] });
                    }
                }
            }
        }
        
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


        for (const newTeacherSchedule of teacherSchedules) {
            // Извлечение существующего расписания преподавателя
            const existingTeacherSchedule = await collection.findOne({ name: newTeacherSchedule.name });
            let mergedSchedule;
    
            if (existingTeacherSchedule) {
                // Объединение существующего расписания с новым
                mergedSchedule = {
                    odd: existingTeacherSchedule.schedule.odd.concat(newTeacherSchedule.schedule.odd),
                    even: existingTeacherSchedule.schedule.even.concat(newTeacherSchedule.schedule.even)
                };
                // Удаление дубликатов пар
                mergedSchedule.odd = mergedSchedule.odd.filter((pair, index, self) =>
                    index === self.findIndex((t) => (  // t - индекс первого элемента в массиве
                        t.dayOfWeek === pair.dayOfWeek && t.time === pair.time && t.pairs.every((p, i) => p.group === pair.pairs[i].group)
                    ))
                );
                mergedSchedule.even = mergedSchedule.even.filter((pair, index, self) =>
                    index === self.findIndex((t) => (
                        t.dayOfWeek === pair.dayOfWeek && t.time === pair.time && t.pairs.every((p, i) => p.group === pair.pairs[i].group)
                    ))
                );
            } else {
                // Если существующего расписания нет, использовать новое
                mergedSchedule = newTeacherSchedule.schedule;
            }
    
            // Обновление расписания преподавателя с объединенным расписанием
            await collection.updateOne(
                { name: newTeacherSchedule.name },
                { $set: { schedule: mergedSchedule } },
                { upsert: true }
            );
        }
        
        
          
    } catch (err) {
        console.error("Произошла ошибка при вставке или обновлении данных в MongoDB:", err);
    } finally {
        await client.close();
    }
}