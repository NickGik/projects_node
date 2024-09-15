// api.js

// Префикс API
const PREFIX = "/api";

// Универсальная функция для отправки запросов
const req = (url, options = {}) => {
  // Извлекаем тело запроса, если оно есть
  const { body } = options;

  // Извлекаем токен авторизации из cookie
  let token = null;
  try {
    const tokenCookie = document.cookie.split('; ').find(row => row.startsWith('token='));
    token = tokenCookie ? tokenCookie.split('=')[1] : null;
  } catch (error) {
    console.error('Error getting token from cookie:', error);
  }

  // Формируем URL запроса
  const requestUrl = (PREFIX + url).replace(/\/\/$/, "");

  // Выполняем fetch-запрос
  return fetch(requestUrl, {
    // Распространяем переданные опции
    ...options,
    // Преобразуем тело запроса в JSON, если оно есть
    body: body ? JSON.stringify(body) : null,
    // Устанавливаем заголовки
    headers: {
      // Распространяем переданные заголовки
      ...options.headers,
      // Добавляем Content-Type для JSON-запросов
      ...(body ? { "Content-Type": "application/json" } : null),
      // Добавляем авторизацию, если токен есть
      Authorization: token ? `Bearer ${token}` : undefined,
    },
  })
  // Обрабатываем ответ
  .then((res) => {
    // Если ответ успешный
    if (res.ok) {
      // Если это DELETE-запрос со статусом 204 (No Content), возвращаем ответ как есть
      if (options.method === 'DELETE' && res.status === 204) {
        return res;
      }
      // В остальных случаях пытаемся разобрать ответ как JSON
      return res.json();
    } else {
      // Если ответ неуспешный, извлекаем текст ошибки и выбрасываем исключение
      return res.text().then((message) => {
        throw new Error(message);
      });
    }
  });
};

// Функция для получения списка заметок
export const getNotes = ({ age, search, archived } = {}) => {
  // Формируем URL запроса
  let url = `/api/notes`;
  const params = new URLSearchParams();
  if (age) params.append("age", age);
  if (search) params.append("search", search);
  if (archived) params.append("archived", archived);

  if (Array.from(params).length) {
    url += `?${params.toString()}`;
  }

  // Выполняем fetch-запрос
  return fetch(url)
    .then(response => {
      // Если ответ неуспешный, выбрасываем исключение
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      // Разобрать ответ как JSON
      return response.json();
    })
    .then(data => {
      // Выводим данные в консоль
      console.log("Data from getNotes:", data);
      // Возвращаем данные
      return data;
    });
};

// Функция для создания новой заметки
export const createNote = (title, content) => {
  return req(`/notes`, {
    method: "POST",
    body: { title, content },
  });
};

// Функция для получения заметки по ID
export const getNote = (id) => {
  return req(`/notes/${id}`);
};

// Функция для архивирования заметки
export const archiveNote = (id) => {
  return req(`/notes/${id}/archive`, {
    method: "PATCH",
  });
};

// Функция для разархивирования заметки
export const unarchiveNote = (id) => {
  return req(`/notes/${id}/unarchive`, {
    method: "PATCH",
  });
};

// Функция для редактирования заметки
export const editNote = (id, title, content) => {
  return req(`/notes/${id}`, {
    method: "PUT",
    body: { title, content },
  });
};

// Функция для удаления заметки
export const deleteNote = (id) => {
  return req(`/notes/${id}`, {
    method: "DELETE",
  });
};

// Функция для удаления всех заархивированных заметок
export const deleteAllArchived = () => {
  return req(`/notes/archived/deleteAll`, {
    method: "DELETE",
  });
};

// Функция для получения URL PDF-версии заметки
export const notePdfUrl = (id) => {
  return `/api/notes/${id}/pdf`;
};

// Функция для скачивания PDF-версии заметки
export const downloadNotePdf = (id) => {
  // Создаем скрытую ссылку
  const link = document.createElement('a');
  link.href = notePdfUrl(id);
  link.target = '_blank'; // Открываем в новой вкладке
  link.download = `note-${id}.pdf`; // Устанавливаем имя файла

  // Добавляем ссылку на страницу (не обязательно отображать)
  document.body.appendChild(link);

  // Имитируем клик по ссылке
  link.click();

  // Удаляем ссылку после скачивания
  document.body.removeChild(link);
};
