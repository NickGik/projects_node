<script>
  import Router, { link, location, push } from "svelte-spa-router";

  import { routerPrefix, routePatterns, getActiveNoteId } from "./lib";
  import { deleteAllArchived, getNotes } from "./api";

  import NoteCard from "./NoteCard.svelte";
  import Progress from "./Progress.svelte";
  import NoteView from "./NoteView.svelte";
  import NoteNew from "./NoteNew.svelte";
  import NoteEdit from "./NoteEdit.svelte";

  // Определяем маршруты приложения
  export const routes = {
    [routePatterns.new]: NoteNew,
    [routePatterns.view]: NoteView,
    [routePatterns.edit]: NoteEdit,
  };

  // Получаем ID активной заметки из URL
  $: activeNoteId = getActiveNoteId($location);

  // Переменные состояния
  let fetching = true;
  let search = "";
  let age = "1month";
  let archived = false; // Для фильтрации по архиву
  let entries = [];

  // Функция для получения заметок с сервера
  const fetch = ({ reset = false } = {}) => {
    if (reset) {
      entries = [];
    }
    fetching = true;
    return getNotes({ age, search, archived })
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          entries = entries.concat(data);
        } else {
          entries = [];
        }
      })
      .finally(() => {
        fetching = false;
      });
  };

  // Вызываем fetch для начальной загрузки заметок
  fetch();

  // Функция для полной перезагрузки заметок
  const fetchFromScratch = ({ resetNav = true } = {}) => {
    if (resetNav) {
      push("/");
    }
    return fetch({ reset: true });
  };

  // Функция для обновления заметок
  const refetch = async () => {
    await fetchFromScratch({ resetNav: false });
  };

  // Функция для удаления всех заархивированных заметок
  const deleteAll = async () => {
    try {
      await deleteAllArchived();
      age = "1month";
      fetchFromScratch();
    } catch (error) {
      console.error("Ошибка при удалении архива:", error);
    }
  };

  // Обработчик событий маршрутизации
  const routeEvent = (event) => {
    const { type, id } = (event && event.detail) || {};
    switch (type) {
      case "note-create-cancelled":
      case "note-closed":
        push("/");
        break;
      case "note-deleted":
      case "note-archived":
      case "note-unarchived":
        push("/");
        refetch();
        break;
      case "note-edit-started":
        push(`/note/${id}/edit`);
        break;
      case "note-edit-cancelled":
        push(`/note/${id}`);
        break;
      case "note-created":
      case "note-edited":
        push(`/note/${id}`);
        refetch();
        break;
    }
  };
</script>

<section class="uk-flex uk-grid-collapse">
  <aside class="uk-width-1-4 uk-padding-small">
    {#if age !== 'archive'}
      {#if activeNoteId === 'new'}
        <button disabled class="uk-button uk-button-primary uk-display-block uk-width-1-1">Новая заметка</button>
      {:else}
        <a use:link={'/note/new'} href="/" class="uk-button uk-button-primary uk-display-block uk-width-1-1">Новая заметка</a>
      {/if}
    {:else}
      <button on:click={deleteAll} class="uk-button uk-button-secondary uk-display-block uk-width-1-1">Удалить весь архив</button>
    {/if}

    <p>
      <select bind:value={age} on:change={() => { archived = age === 'archive'; fetchFromScratch(); }} class="uk-select">
        <option value="1month">за месяц</option>
        <option value="3months">за 3 месяца</option>
        <option value="alltime">за всё время</option>
        <option value="archive">архив</option>
      </select>
    </p>

    {#if !fetching}
      {#if entries.length > 0}
        {#each entries as entry}
          <NoteCard {entry} isActive={entry._id === activeNoteId} />
        {/each}
      {:else}
        <p>Нет заметок.</p>
      {/if}
    {/if}

    {#if fetching}
      <Progress />
    {/if}
  </aside>

  <div class="uk-width-3-4 uk-padding-small">
    <Router {routes} prefix={routerPrefix} on:routeEvent={routeEvent} on:routeLoaded={() => { window.scrollTo(0, 0); }} />
  </div>
</section>
