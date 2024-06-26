import { Schedule, DaySchedule } from './Excelread_inputMongo';


const timeSlots = ['08.00-09.35', '09.45-11.20', '11.30-13.05', '13.55-15.30', '15.40-17.15'];
const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

// Класс для генерации HTML-таблицы из расписания преподавателя
export class HTMLGeneratorT{
    
    static generateTable(schedule: Schedule): string {
      // Создание строк таблицы каждого дня недели
      const createRows = (daySchedules: DaySchedule[], dayNames: string[]) => {
        const rows = []; // Массив для хранения строк таблицы
        const dayGroups: Record<string, DaySchedule[]> = {}; // Для группировки расписаний по дням недели
  
        // Инициализация dayGroups с пустыми массивами для каждого дня недели
        for (const dayName of dayNames) {
          dayGroups[dayName] = [];
        }
  
        // Группировка daySchedules по дням недели
        for (const daySchedule of daySchedules) {
          dayGroups[daySchedule.dayOfWeek].push(daySchedule);
        }
  
        // Генерация строк таблицы для каждого дня недели
        for (const dayName of dayNames) {
          const daySchedules = dayGroups[dayName]; // Получаем расписание для текущего дня недели
          const rowspan = daySchedules.length || 1; // Количество строк, которое будет объединено по вертикали
          const firstSchedule = daySchedules[0] || { time: '', pairs: [] }; // Первое расписание для дня или пустой шаблон
  
          // Генерация HTML для пар
          const pairsHTML = firstSchedule.pairs.map(pair => `
            <td>${pair.subject}</td>
            <td>${pair.group}</td>
            <td>${pair.classroom}</td>
          `).join('') || '<td colspan="3"></td>'; // Генерация ячеек пустых ячеек, если пар нет
  
          // Добавление первой строки для текущего дня недели
          rows.push(`
            <tr>
              <td rowspan="${rowspan}">${dayName}</td>
              <td>${firstSchedule.time}</td>
              ${pairsHTML}
            </tr>
          `);
  
          // Добавление оставшихся пар для текущего дня
          for (let i = 1; i < daySchedules.length; i++) {
            const schedule = daySchedules[i]; // Текущее расписание
            const pairsHTML = schedule.pairs.map(pair => `
              <td>${pair.subject}</td>
              <td>${pair.group}</td>
              <td>${pair.classroom}</td>
            `).join(''); // Генерация HTML для пар
  
            rows.push(`
              <tr>
                <td>${schedule.time}</td>
                ${pairsHTML}
              </tr>
            `);
          }
        }
  
        return rows.join(''); // Возвращаем строки таблицы, объединенные в одну строку
      };
  
      // Генерация строк таблицы для нечетной и четной недели
      const oddRowsHTML = createRows(schedule.odd, dayNames);
      const evenRowsHTML = createRows(schedule.even, dayNames);
  
      // Возвращаем полную HTML-таблицу
      return `
        <table>
          <thead>
            <tr>
              <th>День недели</th>
              <th>Время</th>
              <th>Занятие</th>
              <th>Группа</th>
              <th>Аудитория</th>
            </tr>
          </thead>
          <tbody>
            <tr><th colspan="5">Нечетная неделя</th></tr>
            ${oddRowsHTML}
            <tr><th colspan="5">Четная неделя</th></tr>
            ${evenRowsHTML}
          </tbody>
        </table>
      `;
    }
}
  
// Интерфейс для расширенной записи расписания
export interface ExtendedScheduleEntry {
    Преподаватель: string; 
    dayOfWeek: string; 
    time: string; 
    subject: string; 
    group: string; 
    classroom: string; 
    weekType: 'odd' | 'even'; // Тип недели 
}

// Класс для генерации HTML-таблицы
export class HTMLGenerator {
    generateHTMLTable(data: ExtendedScheduleEntry[]): string {
        // Сортировка данных по типу недели, дню недели и времени
        data.sort((a, b) => {
            if (a.weekType !== b.weekType) {
                return a.weekType === 'odd' ? -1 : 1;
            }
            if (a.dayOfWeek !== b.dayOfWeek) {
                return dayNames.indexOf(a.dayOfWeek) - dayNames.indexOf(b.dayOfWeek);
            }
            return timeSlots.indexOf(a.time) - timeSlots.indexOf(b.time);
        });

        // Генерация HTML-таблицы
        let currentWeekType = ''; // Изменение типа недели
        let currentDayOfWeek = ''; // дня
        let currentDayRowSpan = 0;  //сколько строк объеденить
        const rows: string[] = []; // строки таблицы

        // Обработка каждой записи расписания
        data.forEach((entry, index) => {
            let weekTypeHeader = ''; 
            let dayOfWeekHeader = ''; 
            // Если тип недели изменился, добавляем заголовок
            if (entry.weekType !== currentWeekType) {
                currentWeekType = entry.weekType;
                currentDayOfWeek = '';
                weekTypeHeader = `<tr class="week-header"><td colspan="7">${currentWeekType === 'odd' ? 'Нечетная неделя' : 'Четная неделя'}</td></tr>`;
            }
            // Если день недели изменился, добавляем заголовок
            if (entry.dayOfWeek !== currentDayOfWeek) {
                if (currentDayRowSpan > 0) {
                    // Обновляем rowspan предыдущего дня недели
                    rows[rows.length - currentDayRowSpan] = rows[rows.length - currentDayRowSpan].replace('rowspan="1"', `rowspan="${currentDayRowSpan}"`);
                }
                currentDayOfWeek = entry.dayOfWeek;
                currentDayRowSpan = 1;
                dayOfWeekHeader = `<td rowspan="1">${entry.dayOfWeek}</td>`;
            } else {
                currentDayRowSpan++;
            }

            // Создание строки таблицы
            const row = `
                <tr>
                ${weekTypeHeader}
                ${dayOfWeekHeader}
                <td>${entry.Преподаватель}</td>
                <td>${entry.time}</td>
                <td>${entry.subject}</td>
                <td>${entry.group}</td>
                <td>${entry.classroom}</td>
                </tr>
            `;
            rows.push(row); // все строки таблицы

            // Обновление rowspan последнего дня недели
            if (index === data.length - 1 || data[index + 1].dayOfWeek !== entry.dayOfWeek) {
                rows[rows.length - currentDayRowSpan] = rows[rows.length - currentDayRowSpan].replace('rowspan="1"', `rowspan="${currentDayRowSpan}"`);
            }
        });

        // Возвращаем полную HTML-таблицу
        return `
        <table>
            <tr>
            <th>День</th>
            <th>Преподаватель</th>
            <th>Время</th>
            <th>Предмет</th>
            <th>Группа</th>
            <th>Аудитория</th>
            </tr>
            ${rows.join('')}
        </table>
        `;
    }
}