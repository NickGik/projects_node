<script>
  import { onMount, createEventDispatcher } from "svelte";
  import EasyMDE from "easymde";

  import Progress from "./Progress.svelte";
  import { getNote, editNote } from "./api";

  export let params;

  const dispatch = createEventDispatcher();

  let title;
  let textarea;
  let loading = true;

  onMount(async () => {
    let mdEditor;

    try {
      const data = await getNote(params.id);
      title = data.title;

      setTimeout(() => {
        mdEditor = new EasyMDE({
          element: textarea,
          forceSync: true,
          status: false,
          initialValue: data.content // Use data.content instead of data.text
        });
      });
    } catch (error) {
      console.error("Ошибка при получении заметки:", error);
      // Here you can add more user-friendly error handling
    } finally {
      loading = false;
    }

    return () => {
      try {
        mdEditor && mdEditor.cleanup();
      } catch (_err) {}
    };
  });

  const save = async () => {
    const content = textarea.value; // Use content instead of text
    if (!title && !content) {
      return;
    }
    await editNote(params.id, title, content); // Use content instead of text
    dispatch("routeEvent", { type: "note-edited", id: params.id });
  };

  const cancel = () => {
    dispatch("routeEvent", { type: "note-edit-cancelled", id: params.id });
  };
</script>

{#if loading}
  <Progress />
{:else}
  <div class="uk-margin-bottom">
    <button on:click={save} class="uk-button uk-button-primary">
      <i class="fas fa-save" /> Сохранить
    </button>
    <button on:click={cancel} class="uk-button uk-button-default">
      <i class="fas fa-undo" /> Отмена
    </button>
  </div>

  <div class="uk-margin">
    <input bind:value={title} class="uk-input" type="text" placeholder="Заголовок" />
  </div>

  <div class="uk-margin">
    <textarea bind:this={textarea} class="uk-textarea" />
  </div>
{/if}
