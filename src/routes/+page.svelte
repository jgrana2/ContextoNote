<script lang="ts">
    import { onMount } from "svelte";
    import { marked } from "marked";
    import { fade } from "svelte/transition";

    // Estado de notas usando localStorage
    let notes = [];
    let selectedNoteId = null;
    let noteDate = "";
    let noteContent = "";
    let noteTitle = "";

    // Modal para nueva nota
    let showNoteModal = false;
    let newNoteTitle = "";
    let newNoteContent = "";

    // Para edición de nota desde vista Markdown
    let showEditNoteModal = false;
    let editNoteTitle = "";
    let editNoteContent = "";

    // Cargar prompts desde localStorage o inicializar vacío
    let prompts = [];
    let editingPromptId = null;

    let showPromptModal = false;
    let newPromptName = "";
    let newPromptText = "";
    let selectedPrompt = null;
    let promptText = "";
    // Hovered note for action buttons in note list
    let hoveredNoteId: number | null = null;

    // Resultado LLM
    let llmResult = "";

    // Contexto de notas para LLM
    let selectedContextNotes = [];
    // Computar el texto concatenado de notas seleccionadas
    $: contextText = selectedContextNotes
        .map((id) => notes.find((n) => n.id === id)?.content || "")
        .filter((text) => text)
        .join("\n\n");

    // Para gestión de cadena de prompts
    let promptChain: { id: number; name: string; text: string }[] = [];

    // Aplica altura fija a un elemento de nota según su ID
    function establecerAlturaNota(nota, altura) {
      const el = document.querySelector(`[data-note-id="${nota.id}"]`);
      if (el) {
        el.style.height = altura;
        el.style.position = 'relative';
      }
    }

    // Función para cargar notas y prompts desde localStorage al iniciar
    onMount(() => {
        const savedNotes = JSON.parse(localStorage.getItem("notes")) || [];
        notes = savedNotes;
        const savedPrompts = JSON.parse(localStorage.getItem("prompts")) || [];
        prompts = savedPrompts;
        // Aplicar altura fija tras montar
        notes.forEach(n => establecerAlturaNota(n, '30px'));
    });

    // Sincroniza localStorage
    function persistNotes() {
        localStorage.setItem("notes", JSON.stringify(notes));
    }

    function persistPrompts() {
        localStorage.setItem("prompts", JSON.stringify(prompts));
    }

    // Funciones para notas
    function openNote(note) {
        if (hasUnsavedChanges()) {
            const confirmDiscard = confirm(
                "Hay cambios sin guardar. ¿Deseas guardar antes de cambiar de nota?",
            );
            if (confirmDiscard) {
                saveNote();
            }
        }
        selectedNoteId = note.id;
        noteDate = note.date;
        noteTitle = note.title;
        noteContent = note.content;
    }

    function saveNote() {
        if (selectedNoteId !== null) {
            const idx = notes.findIndex((n) => n.id === selectedNoteId);
            if (idx !== -1) {
                notes[idx].title = noteTitle;
                notes[idx].content = noteContent;
                persistNotes();
            }
        }
    }

    function deleteNote(noteId) {
        const confirmDelete = confirm("¿Seguro que deseas eliminar esta nota?");
        if (confirmDelete) {
            notes = notes.filter((n) => n.id !== noteId);
            persistNotes();
            if (selectedNoteId === noteId) {
                selectedNoteId = null;
                noteTitle = "";
                noteContent = "";
            }
        }
    }

    function createNewNote() {
        if (hasUnsavedChanges()) {
            const confirmDiscard = confirm(
                "Hay cambios sin guardar. ¿Deseas guardar antes de crear nueva nota?",
            );
            if (confirmDiscard) {
                saveNote();
            }
        }
        selectedNoteId = null;
        noteDate = "";
        noteTitle = "";
        noteContent = "";
        showNoteModal = true;
        newNoteTitle = "";
        newNoteContent = "";
    }

    function openEditNoteModal() {
      editNoteTitle = noteTitle;
      editNoteContent = noteContent;
      showEditNoteModal = true;
    }

    function cancelEditNote() {
      showEditNoteModal = false;
    }

    function saveEditedNote() {
      if (selectedNoteId !== null) {
        const idx = notes.findIndex((n) => n.id === selectedNoteId);
        if (idx !== -1) {
          notes[idx].title = editNoteTitle;
          notes[idx].content = editNoteContent;
          persistNotes();
          // Actualizar vista Markdown
          noteTitle = editNoteTitle;
          noteContent = editNoteContent;
        }
      }
      showEditNoteModal = false;
    }

    async function saveNewNote() {
        const id = notes.length ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
        const formattedDateTime = new Date().toLocaleString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        const capitalized = formattedDateTime.charAt(0).toUpperCase() + formattedDateTime.slice(1);
        const dateObj = new Date();
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const rawDate = `${day}/${month}`;
        console.log(rawDate);
        const note = {
            id,
            dateRaw: rawDate,
            date: capitalized,
            title: newNoteTitle || "Nueva nota",
            content: newNoteContent,
        };
        notes = [note, ...notes];
        persistNotes();
        // Aplicar altura fija a la nueva nota
        establecerAlturaNota(note, '30px');
        showNoteModal = false;
        openNote(note);
    }

    // Función para detectar cambios no guardados
    function hasUnsavedChanges() {
        if (selectedNoteId === null) return false;
        const current = notes.find((n) => n.id === selectedNoteId);
        return (
            current &&
            (current.title !== noteTitle || current.content !== noteContent)
        );
    }

    // Funciones para prompts
    function openPromptModal(promptToEdit = null) {
        if (promptToEdit) {
            // Editar prompt existente
            editingPromptId = promptToEdit.id;
            newPromptName = promptToEdit.name;
            newPromptText = promptToEdit.text;
        } else {
            // Crear nuevo prompt
            editingPromptId = null;
            newPromptName = "";
            newPromptText = "";
        }
        showPromptModal = true;
    }

    function savePrompt() {
        if (newPromptName && newPromptText) {
            if (editingPromptId !== null) {
                // Actualizar prompt existente
                const idx = prompts.findIndex((p) => p.id === editingPromptId);
                if (idx !== -1) {
                    prompts[idx].name = newPromptName;
                    prompts[idx].text = newPromptText;
                }
            } else {
                // Crear nuevo prompt
                const id = prompts.length
                    ? Math.max(...prompts.map((p) => p.id)) + 1
                    : 1;
                prompts = [
                    ...prompts,
                    { id, name: newPromptName, text: newPromptText },
                ];
            }
            persistPrompts();
            showPromptModal = false;
        }
    }

    function deletePrompt(promptId: number) {
        const confirmDelete = confirm(
            "¿Seguro que deseas eliminar este prompt?",
        );
        if (confirmDelete) {
            prompts = prompts.filter((p) => p.id !== promptId);
            persistPrompts();
            if (selectedPrompt === promptId) {
                selectedPrompt = null;
                promptText = "";
            }
        }
    }

    // Añadir un prompt a la cadena (evita duplicados)
    function addPromptToChain(p: { id: number; name: string; text: string }) {
        // Evitar duplicados: si ya existe en cadena, no lo añade
        if (!promptChain.find((item) => item.id === p.id)) {
            promptChain = [...promptChain, p];
        }
    }

    // Limpiar la cadena de prompts
    function clearPromptChain() {
        promptChain = [];
    }

    // Ejecutar prompt o cadena de prompts
    async function executePrompt() {
        if (promptChain.length === 0) {
            // Si no hay cadena, se comporta igual que antes
            let structuredPrompt =
                "Por favor, utiliza la siguiente información de contexto y responde de forma clara:\n\n";
            if (selectedContextNotes.length > 0) {
                structuredPrompt += "=== CONTEXTO ===\n";
                selectedContextNotes.forEach((id, index) => {
                    const note = notes.find((n) => n.id === id);
                    if (note) {
                        structuredPrompt += `Nota ${index + 1} (Fecha: ${note.date}, Título: ${note.title}):\n${note.content}\n\n`;
                    }
                });
            }
            structuredPrompt += "=== PETICIÓN ===\n";
            structuredPrompt += `${promptText.trim()}\n`;
            try {
                llmResult = "Cargando respuesta...";
                llmResult = await sendToAI(structuredPrompt);
            } catch (error) {
                llmResult = `Error al obtener respuesta del LLM: ${error.message}`;
            }
            return;
        }

        // Si hay prompts en cadena, encadenar pasos
        let previousOutput = "";
        for (let i = 0; i < promptChain.length; i++) {
            const p = promptChain[i];
            let stepPrompt = "";
            if (i === 0) {
                // Incluir contexto en el primer paso
                stepPrompt =
                    "Por favor, utiliza la siguiente información de contexto y responde de forma clara:\n\n";
                if (selectedContextNotes.length > 0) {
                    stepPrompt += "=== CONTEXTO ===\n";
                    selectedContextNotes.forEach((id, index) => {
                        const note = notes.find((n) => n.id === id);
                        if (note) {
                            stepPrompt += `Nota ${index + 1} (Fecha: ${note.date}, Título: ${note.title}):\n${note.content}\n\n`;
                        }
                    });
                }
                stepPrompt += `=== PETICIÓN (${p.name}) ===\n${p.text.trim()}\n`;
            } else {
                // Los pasos intermedios toman la salida previa como entrada
                stepPrompt = `Basándote en la siguiente respuesta previa:\n\n${previousOutput}\n\nRealiza la siguiente petición (${p.name}):\n${p.text.trim()}\n`;
            }

            try {
                llmResult = `Cargando paso ${i + 1} (${p.name})...`;
                previousOutput = await sendToAI(stepPrompt);
            } catch (error) {
                llmResult = `Error en paso ${i + 1} (${p.name}): ${error.message}`;
                return;
            }
        }
        // Al finalizar todos los pasos, mostrar el output final
        llmResult = previousOutput;
    }

    // Función de búsqueda simple (por texto o por fecha/etiquetas placeholder)
    let searchQuery = "";
    function filterNotes() {
        if (!searchQuery) {
            // Recargar notas desde localStorage solo en función, no en top-level
            const saved = JSON.parse(localStorage.getItem("notes")) || [];
            notes = saved;
        } else {
            notes = (JSON.parse(localStorage.getItem("notes")) || []).filter(
                (n) =>
                    n.title.includes(searchQuery) ||
                    n.content.includes(searchQuery),
            );
        }
    }

    async function sendToAI(prompt: string): Promise<string> {
        const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt }),
        });
        if (!res.body) {
            throw new Error("El servidor no abrió un stream válido");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            llmResult = accumulated;
        }

        return accumulated;
    }

    function renderMarkdown(md: string): string {
        // Renderizar Markdown sin convertir saltos de línea simples en <br>
        marked.setOptions({ breaks: false, gfm: true });
        return marked(md);
    }

    function copyToClipboard() {
        if (llmResult) {
            navigator.clipboard
                .writeText(llmResult)
                .then(() => {
                    alert("Resultado copiado al portapapeles");
                })
                .catch((err) => {
                    console.error("Error copiando al portapapeles:", err);
                });
        }
    }
</script>

<!-- Modal para crear nueva nota -->
{#if showNoteModal}
    <div
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 200 }}
        class="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
    >
        <div
            class="bg-gray-100 rounded-lg p-6 w-[800px] h-[600px] border border-gray-200 shadow-lg flex flex-col"
        >
            <h2 class="text-xl font-bold mb-4 text-gray-900">
                Crear Nueva Nota
            </h2>
            <input
                type="text"
                placeholder="Título de la nota"
                bind:value={newNoteTitle}
                class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800"
            />
            <textarea
                rows="6"
                placeholder="Contenido de la nota"
                bind:value={newNoteContent}
                class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800 h-full"
            ></textarea>
            <div class="flex justify-end space-x-2">
                <button
                    class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                    on:click={() => (showNoteModal = false)}
                >
                    Cancelar
                </button>
                <button
                    class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                    on:click={saveNewNote}
                >
                    Guardar
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal para editar nota existente -->
{#if showEditNoteModal}
  <div
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 200 }}
    class="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-gray-100 rounded-lg p-6 w-[800px] h-[600px] border border-gray-200 shadow-lg flex flex-col">
      <h2 class="text-xl font-bold mb-4 text-gray-900">Editar Nota</h2>
      <input
        type="text"
        placeholder="Título de la nota"
        bind:value={editNoteTitle}
        class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800"
      />
      <textarea
        rows="6"
        placeholder="Contenido de la nota"
        bind:value={editNoteContent}
        class="w-full h-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800"
      ></textarea>
      <div class="flex justify-end space-x-2">
        <button
          class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
          on:click={cancelEditNote}
        >
          Cancelar
        </button>
        <button
          class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
          on:click={saveEditedNote}
        >
          Guardar
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal para crear nuevo prompt -->
{#if showPromptModal}
    <div
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 200 }}
        class="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
    >
        <div
            class="bg-gray-100 rounded-lg p-6 w-96 border border-gray-200 shadow-lg"
        >
            <h2 class="text-xl font-bold mb-4 text-gray-900">
                Crear Nueva Instrucción
            </h2>
            <input
                type="text"
                placeholder="Nombre del prompt"
                bind:value={newPromptName}
                class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800"
            />
            <textarea
                rows="4"
                placeholder="Texto del prompt"
                bind:value={newPromptText}
                class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-3 text-gray-800"
            ></textarea>
            <div class="flex justify-end space-x-2">
                <button
                    class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                    on:click={() => (showPromptModal = false)}
                >
                    Cancelar
                </button>
                <button
                    class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                    on:click={savePrompt}
                >
                    Guardar
                </button>
            </div>
        </div>
    </div>
{/if}

<div class="h-screen flex flex-col bg-gray-50">
    <!-- Header simplificado -->
    <header
        class="flex items-center justify-between px-4 py-2 bg-gray-100 rounded-b-lg shadow"
    >
        <div class="text-2xl font-bold text-gray-900">🗒️ ContextNote</div>
        <button
            class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
        >
            Iniciar sesión
        </button>
    </header>

    <div class="flex flex-1 overflow-hidden">
        <!-- Panel izquierdo: búsqueda y lista de notas -->
        <aside class="w-80 bg-gray-100 border-r border-gray-200 flex flex-col">
            <div class="p-4">
                <input
                    type="text"
                    placeholder="Buscar notas..."
                    bind:value={searchQuery}
                    on:input={filterNotes}
                    class="w-full border border-gray-300 bg-white rounded px-3 py-2 text-gray-800"
                />
            </div>
            <div class="p-4">
                <button
                    class="flex items-center w-full p-2 hover:bg-gray-200 rounded transition"
                    on:click={createNewNote}
                >
                    <!-- Heroicon Plus Circle -->
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6 text-gray-800"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                        />
                    </svg>
                    <span class="ml-3 font-medium text-gray-900"
                        >Nueva Nota</span
                    >
                </button>
            </div>
            <ul id="notesList" class="flex-1 overflow-y-auto p-4 space-y-2">
                {#each notes as note}
                    <li
                        data-note-id="{note.id}"
                        on:mouseenter={() => (hoveredNoteId = note.id)}
                        on:mouseleave={() => (hoveredNoteId = null)}
                        class="flex items-center justify-between"
                    >
                        <div
                            class="cursor-pointer"
                            on:click={() => openNote(note)}
                        >
                            <div class="font-medium text-gray-900">
                                {note.title}
                            </div>
                        </div>
                        {#if hoveredNoteId === note.id}
                          <div in:fade={{ duration: 150 }} out:fade={{ duration: 150 }} class="flex space-x-2">
                            <!-- Edit Button -->
                            <button
                              class="p-1 hover:bg-gray-200 rounded"
                              on:click={() => {
                                openNote(note);
                                openEditNoteModal();
                              }}
                            >
                              <!-- Heroicon Pencil -->
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487a1.875 1.875 0 112.651 2.651L7.5 19.151 3 20.25l1.099-4.5L16.862 4.487z" />
                              </svg>
                            </button>
                            <!-- Delete Button -->
                            <button
                              class="p-1 hover:bg-gray-200 rounded"
                              on:click={() => deleteNote(note.id)}
                            >
                              <!-- Heroicon Trash -->
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9L14.394 18.0m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084A2.25 2.25 0 015.84 19.673L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        {/if}
                    </li>
                {/each}
            </ul>
        </aside>

        <!-- Panel central: Contenido de la nota -->
        <main class="flex-1 overflow-y-auto p-4">
          {#if selectedNoteId !== null}
            <div class="flex items-center justify-between text-gray-400 mb-2 text-sm">
              <div>{noteDate}</div>
              <button
                class="bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
                on:click={openEditNoteModal}
              >
                Editar
              </button>
            </div>
            <div class="text-gray-800 text-sm markdown-result mb-4">
              {@html renderMarkdown(`# ${noteTitle}\n\n${noteContent}`)}
            </div>
          {:else}
            <div class="text-gray-600">
              Selecciona una nota o crea una nueva para comenzar.
            </div>
          {/if}
        </main>

        <!-- Panel derecho: Instrucciones y Resultado -->
        <aside
            class="w-1/3 border-l border-gray-200 flex flex-col p-4 overflow-y-auto bg-gray-50"
        >
            <!-- Nuevo prompt -->
            <button
                class="bg-gray-800 text-white px-3 py-1 rounded mb-4 hover:bg-gray-700 w-full text-center"
                on:click={() => openPromptModal()}
            >
                <!-- Heroicon Plus Circle -->
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-6 w-6 inline-block text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                    />
                </svg>
                <span class="ml-2">Nueva Instrucción</span>
            </button>

            <!-- Lista de Instrucciones Guardadas -->
            <section class="mb-4">
                <h2 class="text-lg font-bold mb-2 text-gray-900">
                    Instrucciones Guardadas
                </h2>
                <ul class="space-y-1">
                    {#each prompts as p}
                        <li class="flex items-center justify-between">
                            <span
                                class="cursor-pointer hover:underline text-gray-800"
                                on:click={() => {
                                    selectedPrompt = p.id;
                                    promptText = p.text;
                                }}
                            >
                                {p.name}
                            </span>
                            <div class="flex items-center space-x-2">
                                <button
                                    class="p-1 hover:bg-gray-200 rounded"
                                    on:click={() => addPromptToChain(p)}
                                >
                                    <!-- Heroicon Plus -->
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-5 w-5 text-gray-800"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M12 4v16m8-8H4"
                                        />
                                    </svg>
                                </button>
                                <button
                                    class="p-1 hover:bg-gray-200 rounded"
                                    on:click={() => openPromptModal(p)}
                                    ><svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="size-6"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                                        />
                                    </svg></button
                                >
                                <button
                                    class="p-1 hover:bg-gray-200 rounded"
                                    on:click={() => deletePrompt(p.id)}
                                    ><!-- Heroicon Trash -->
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke-width="1.5"
                                        stroke="currentColor"
                                        class="size-6"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                        />
                                    </svg></button
                                >
                            </div>
                        </li>
                    {/each}
                </ul>

                <!-- Cadena de Instrucciones -->
                <div class="mt-4">
                    <h2 class="font-semibold mb-2 text-gray-900">
                        Cadena de Instrucciones :
                    </h2>
                    {#if promptChain.length === 0}
                        <p class="text-gray-600 text-sm">
                            No hay instrucciones en la cadena.
                        </p>
                    {:else}
                        <ul class="space-y-1">
                            {#each promptChain as pc, index}
                                <li class="flex items-center justify-between">
                                    <span class="text-gray-800">
                                        {index + 1}. {pc.name}
                                    </span>
                                </li>
                            {/each}
                        </ul>
                        <button
                            class="mt-2 bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                            on:click={clearPromptChain}
                        >
                            Limpiar Cadena
                        </button>
                    {/if}
                </div>
            </section>

            <!-- Área de Instrucción y Resultado LLM -->
            <section
                class="flex-1 flex flex-col bg-gray-100 p-4 rounded-lg shadow"
            >
                <h2 class="text-lg font-bold mb-2 text-gray-900">
                    Contexto adicional
                </h2>
                <select
                    multiple
                    bind:value={selectedContextNotes}
                    class="w-full border border-gray-300 bg-white rounded px-3 py-2 mb-2 text-gray-800 h-fit"
                >
                    {#each notes as note}
                        <option value={note.id} class="text-gray-800">
                            {note.dateRaw} - {note.title}
                        </option>
                    {/each}
                </select>
                <button
                    class="flex justify-center bg-gray-800 text-white px-3 py-1 rounded mb-2 hover:bg-gray-700"
                    on:click={executePrompt}
                >
                    <!-- Heroicon Paper Airplane -->
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-6"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                        />
                    </svg>

                    <span class="ml-2">Ejecutar</span>
                </button>
                <div
                    class="border-t border-gray-200 bg-white p-4 rounded-lg shadow overflow-y-auto"
                >
                    <div class="flex items-center justify-between">
                        <h2 class="text-lg font-bold text-gray-900">
                            Resultado:
                        </h2>
                        <button
                            class="p-1 hover:bg-gray-200 rounded"
                            on:click={copyToClipboard}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke-width="1.5"
                                stroke="currentColor"
                                class="size-6"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                                />
                            </svg>
                        </button>
                    </div>
                    {#if llmResult}
                        <div class="text-gray-800 text-sm markdown-result mt-2">
                            {@html renderMarkdown(llmResult)}
                        </div>
                    {/if}
                </div>
            </section>
        </aside>
    </div>
</div>
