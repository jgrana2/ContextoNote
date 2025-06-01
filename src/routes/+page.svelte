<script lang="ts">
    import { onMount } from "svelte";

    // Estado de notas usando localStorage
    let notes = [];
    let selectedNoteId = null;
    let noteContent = "";
    let noteTitle = "";

    // Modal para nueva nota
    let showNoteModal = false;
    let newNoteTitle = "";
    let newNoteContent = "";

    // Cargar prompts desde localStorage o inicializar vacío
    let prompts = [];
    let editingPromptId = null;

    let showPromptModal = false;
    let newPromptName = "";
    let newPromptText = "";
    let selectedPrompt = null;
    let promptText = "";

    // Resultado LLM
    let llmResult = "";

    // Contexto de notas para LLM
    let selectedContextNotes = [];
    // Computar el texto concatenado de notas seleccionadas
    $: contextText = selectedContextNotes
        .map((id) => notes.find((n) => n.id === id)?.content || "")
        .filter((text) => text)
        .join("\n\n");

    // Función para cargar notas y prompts desde localStorage al iniciar
    onMount(() => {
        const savedNotes = JSON.parse(localStorage.getItem("notes")) || [];
        notes = savedNotes;
        const savedPrompts = JSON.parse(localStorage.getItem("prompts")) || [];
        prompts = savedPrompts;
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
        noteTitle = "";
        noteContent = "";
        showNoteModal = true;
        newNoteTitle = "";
        newNoteContent = "";
    }

    async function saveNewNote() {
        const id = notes.length ? Math.max(...notes.map((n) => n.id)) + 1 : 1;
        const date = new Date().toISOString().slice(0, 10);
        const note = {
            id,
            date,
            title: newNoteTitle || "Nueva nota",
            content: newNoteContent,
        };
        notes = [note, ...notes];
        persistNotes();
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
        const confirmDelete = confirm("¿Seguro que deseas eliminar este prompt?");
        if (confirmDelete) {
            prompts = prompts.filter(p => p.id !== promptId);
            persistPrompts();
            if (selectedPrompt === promptId) {
                selectedPrompt = null;
                promptText = "";
            }
        }
    }

    // Ejecutar prompt
    async function executePrompt() {
        // Generar prompt estructurado para LLM
        let structuredPrompt =
            "Por favor, utiliza la siguiente información de contexto y responde de forma clara:\n\n";

        if (selectedContextNotes.length > 0) {
            structuredPrompt += "=== CONTEXTO ===\n";
            // Añadir contenido de cada nota al contexto
            selectedContextNotes.forEach((id, index) => {
                const note = notes.find((n) => n.id === id);
                if (note) {
                    structuredPrompt += `Nota ${index + 1} (Fecha: ${note.date}, Título: ${note.title}):\n${note.content}\n\n`;
                }
            });
        }

        structuredPrompt += "=== PETICIÓN ===\n";
        structuredPrompt += `${promptText.trim()}\n`;
        // Enviar prompt estructurado al LLM y await la respuesta
        try {
            llmResult = "Cargando respuesta...";
            llmResult = await sendToAI(structuredPrompt);
        } catch (error) {
            llmResult = `Error al obtener respuesta del LLM: ${error.message}`;
        }
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
</script>

<!-- Modal para crear nueva nota -->
{#if showNoteModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 w-96">
            <h2 class="text-xl font-bold mb-4">Crear Nueva Nota</h2>
            <input
                type="text"
                placeholder="Título de la nota"
                bind:value={newNoteTitle}
                class="w-full border rounded px-3 py-2 mb-3"
            />
            <textarea
                rows="6"
                placeholder="Contenido de la nota"
                bind:value={newNoteContent}
                class="w-full border rounded px-3 py-2 mb-3"
            ></textarea>
            <div class="flex justify-end space-x-2">
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded"
                    on:click={() => (showNoteModal = false)}>Cancelar</button
                >
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded"
                    on:click={saveNewNote}>Guardar</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Modal para crear nuevo prompt -->
{#if showPromptModal}
    <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
        <div class="bg-white rounded-lg p-6 w-96">
            <h2 class="text-xl font-bold mb-4">Crear Nuevo Prompt</h2>
            <input
                type="text"
                placeholder="Nombre del prompt"
                bind:value={newPromptName}
                class="w-full border rounded px-3 py-2 mb-3"
            />
            <textarea
                rows="4"
                placeholder="Texto del prompt"
                bind:value={newPromptText}
                class="w-full border rounded px-3 py-2 mb-3"
            ></textarea>
            <div class="flex justify-end space-x-2">
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded"
                    on:click={() => (showPromptModal = false)}>Cancelar</button
                >
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded"
                    on:click={savePrompt}>Guardar</button
                >
            </div>
        </div>
    </div>
{/if}

<div class="h-screen flex flex-col">
    <!-- Header simplificado -->
    <header
        class="flex items-center justify-between px-4 py-2 bg-gray-100 border-b"
    >
        <div class="text-2xl font-bold">🗒️ ContextNote</div>
        <button class="bg-blue-500 text-white px-3 py-1 rounded"
            >Iniciar sesión</button
        >
    </header>

    <div class="flex flex-1 overflow-hidden">
        <!-- Panel izquierdo: búsqueda y lista de notas -->
        <aside class="w-1/4 border-r overflow-y-auto p-4">
            <div class="mb-4">
                <input
                    type="text"
                    placeholder="Buscar notas..."
                    bind:value={searchQuery}
                    on:input={filterNotes}
                    class="w-full border rounded px-3 py-2"
                />
            </div>
            <button
                class="bg-blue-500 text-white px-3 py-1 rounded mb-4 w-full text-center"
                on:click={createNewNote}>+ Nueva Nota</button
            >
            <ul>
                {#each notes as note}
                    <li class="flex items-center justify-between mb-2">
                        <div
                            class="cursor-pointer"
                            on:click={() => openNote(note)}
                        >
                            <div class="text-sm text-gray-600">{note.date}</div>
                            <div class="font-medium">{note.title}</div>
                        </div>
                        <button
                            class="bg-blue-500 text-white px-2 py-1 rounded text-sm"
                            on:click={() => deleteNote(note.id)}>X</button
                        >
                    </li>
                {/each}
            </ul>
        </aside>

        <!-- Panel central: Contenido de la nota -->
        <main class="flex-1 overflow-y-auto p-4">
            {#if selectedNoteId !== null}
                <h2 class="text-xl font-bold mb-2">Editar Nota</h2>
                <input
                    type="text"
                    bind:value={noteTitle}
                    placeholder="Título de la nota"
                    class="w-full border rounded px-3 py-2 mb-2"
                />
                <textarea
                    rows="10"
                    bind:value={noteContent}
                    class="w-full border rounded px-3 py-2 mb-2"
                ></textarea>
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded"
                    on:click={saveNote}>Guardar</button
                >
            {:else}
                <div class="text-gray-500">
                    Selecciona una nota o crea una nueva para comenzar.
                </div>
            {/if}
        </main>

        <!-- Panel derecho: Prompts y Resultado -->
        <aside class="w-1/3 border-l flex flex-col p-4 overflow-y-auto">
            <!-- Nuevo prompt -->
            <button
                class="bg-blue-500 text-white px-3 py-1 rounded mb-4 w-full text-center"
                on:click={() => openPromptModal()}>+ Nuevo Prompt</button
            >

            <!-- Lista de Prompts Guardados -->
            <section class="mb-4">
                <h2 class="font-bold mb-2">Prompts Guardados</h2>
                <ul>
                    {#each prompts as p}
                        <li class="mb-1 flex items-center justify-between">
                            <span
                                class="cursor-pointer hover:underline"
                                on:click={() => {
                                    selectedPrompt = p.id;
                                    promptText = p.text;
                                }}
                            >
                                {p.name}
                            </span>
                            <div class="flex items-center">
                                <button
                                    class="text-blue-500 text-sm ml-2"
                                    on:click={() => openPromptModal(p)}
                                >Editar</button>
                                <button
                                    class="text-blue-500 text-sm ml-2"
                                    on:click={() => deletePrompt(p.id)}
                                >Eliminar</button>
                            </div>
                        </li>
                    {/each}
                </ul>
            </section>

            <!-- Área de Prompt y Resultado LLM -->
            <section class="flex-1 flex flex-col">
                <h2 class="font-bold mb-2">Contexto adicional</h2>
                <select
                    multiple
                    bind:value={selectedContextNotes}
                    class="w-full border rounded px-3 py-2 mb-2 h-32"
                >
                    {#each notes as note}
                        <option value={note.id}>
                            {note.date} – {note.title}
                        </option>
                    {/each}
                </select>
                <div class="mb-4 p-2 border rounded h-24 overflow-auto">
                    {#each selectedContextNotes as id}
                        {#each notes.filter((n) => n.id === id) as n}
                            <p class="text-sm font-semibold">{n.title}</p>
                            <p class="text-xs mb-2">{n.content}</p>
                        {/each}
                    {/each}
                </div>
                <h2 class="font-bold mb-2">Área de Prompt</h2>
                <textarea
                    rows="4"
                    bind:value={promptText}
                    class="w-full border rounded px-3 py-2 mb-2"
                    placeholder="Escribe o elige un prompt..."
                ></textarea>
                <button
                    class="bg-blue-500 text-white px-3 py-1 rounded mb-2"
                    on:click={executePrompt}>Ejecutar</button
                >
                <div class="border-t pt-2 overflow-y-auto">
                    <h2 class="font-bold mb-2">Resultado LLM</h2>
                    <div class="whitespace-pre-wrap text-sm">{llmResult}</div>
                </div>
            </section>
        </aside>
    </div>
</div>
