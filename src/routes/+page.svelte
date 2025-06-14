<script lang="ts">
    import { onMount } from "svelte";
    import { marked } from "marked";
    import { fade } from "svelte/transition";
    import { embeddingService } from "$lib/embeddings";

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
    let manuallySelectedNotes = []; // Track manually selected notes
    let showContextDropdown = false;
    let contextSearchQuery = "";
    let isAutoSelecting = false;
    let embeddingModelStatus = "not_loaded";
    let similarityThreshold = 0.25; // Configurable threshold (0.0 to 1.0)
    let searchDebounceTimer = null;
    let isSearching = false;
    
    // Toast notification system
    let toastMessage = "";
    let showToast = false;
    // Computar el texto concatenado de notas seleccionadas
    $: contextText = selectedContextNotes
        .map((id) => notes.find((n) => n.id === id)?.content || "")
        .filter((text) => text)
        .join("\n\n");
    
    // Filtrar notas para el dropdown de contexto
    $: filteredContextNotes = notes.filter(note => 
        note.title.toLowerCase().includes(contextSearchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(contextSearchQuery.toLowerCase())
    );

    // Chat interface - Multiple conversations
    let userMessage = "";
    let chatHistory = [];
    let chats = []; // Array of all chat conversations
    let currentChatId = null;
    let showChatHistory = false;
    
    // Chat structure: { id, title, messages, createdAt, updatedAt, contextNotes }

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
    onMount(async () => {
        const savedNotes = JSON.parse(localStorage.getItem("notes")) || [];
        notes = savedNotes;
        const savedPrompts = JSON.parse(localStorage.getItem("prompts")) || [];
        prompts = savedPrompts;
        // Aplicar altura fija tras montar
        notes.forEach(n => establecerAlturaNota(n, '30px'));
        
        // Load saved chats
        const savedChats = JSON.parse(localStorage.getItem("chats")) || [];
        chats = savedChats;
        
        // Create default chat if none exist
        if (chats.length === 0) {
            createNewChat();
        } else {
            // Load the most recent chat
            currentChatId = chats[0].id;
            loadCurrentChat();
        }

        // Initialize embedding model in the background
        try {
            embeddingModelStatus = "loading";
            await embeddingService.initialize();
            embeddingModelStatus = "loaded";
            console.log('Embedding model ready for local semantic search');
            
            // Process existing notes in background
            if (notes.length > 0) {
                console.log(`Starting background processing of ${notes.length} existing notes...`);
                embeddingService.processNotes(notes).catch(error => {
                    console.warn('Error processing existing notes:', error);
                });
            }
        } catch (error) {
            embeddingModelStatus = "error";
            console.warn('Failed to load embedding model, falling back to keyword search');
        }
    });

    // Sincroniza localStorage
    function persistNotes() {
        localStorage.setItem("notes", JSON.stringify(notes));
    }

    function persistPrompts() {
        localStorage.setItem("prompts", JSON.stringify(prompts));
    }

    function persistChats() {
        localStorage.setItem("chats", JSON.stringify(chats));
    }

    // Chat Management Functions
    function createNewChat() {
        const id = chats.length ? Math.max(...chats.map(c => c.id)) + 1 : 1;
        const now = new Date();
        const newChat = {
            id,
            title: "Nueva conversación",
            messages: [],
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            contextNotes: [...selectedContextNotes] // Snapshot current context
        };
        
        chats = [newChat, ...chats]; // Add to beginning
        currentChatId = id;
        chatHistory = [];
        userMessage = "";
        persistChats();
        console.log(`📝 Created new chat: ${id}`);
    }

    function loadCurrentChat() {
        const chat = chats.find(c => c.id === currentChatId);
        if (chat) {
            chatHistory = chat.messages;
            selectedContextNotes = chat.contextNotes || [];
            manuallySelectedNotes = chat.contextNotes || []; // Treat loaded notes as manually selected
            console.log(`💬 Loaded chat: ${chat.title} (${chat.messages.length} messages)`);
        }
    }

    function switchToChat(chatId) {
        // Save current chat state first
        saveCurrentChatState();
        
        // Switch to new chat
        currentChatId = chatId;
        loadCurrentChat();
        showChatHistory = false;
    }

    function saveCurrentChatState() {
        if (currentChatId) {
            const chatIndex = chats.findIndex(c => c.id === currentChatId);
            if (chatIndex !== -1) {
                chats[chatIndex].messages = chatHistory;
                chats[chatIndex].contextNotes = [...selectedContextNotes];
                chats[chatIndex].updatedAt = new Date().toISOString();
                
                // Update title based on first message if still default
                if (chats[chatIndex].title === "Nueva conversación" && chatHistory.length > 0) {
                    const firstUserMessage = chatHistory.find(m => m.role === "user");
                    if (firstUserMessage) {
                        chats[chatIndex].title = firstUserMessage.content.substring(0, 50) + 
                            (firstUserMessage.content.length > 50 ? "..." : "");
                    }
                }
                
                persistChats();
            }
        }
    }

    function deleteChat(chatId) {
        if (chats.length <= 1) {
            alert("No puedes eliminar la última conversación");
            return;
        }
        
        const confirmDelete = confirm("¿Seguro que deseas eliminar esta conversación?");
        if (confirmDelete) {
            chats = chats.filter(c => c.id !== chatId);
            
            // If deleting current chat, switch to first remaining
            if (currentChatId === chatId) {
                currentChatId = chats[0].id;
                loadCurrentChat();
            }
            
            persistChats();
        }
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
                
                // Reprocess embedding for edited note
                if (embeddingModelStatus === "loaded") {
                    embeddingService.processNote(notes[idx]).catch(error => {
                        console.warn('Error reprocessing edited note embedding:', error);
                    });
                }
            }
        }
    }

    function deleteNote(noteId) {
        const confirmDelete = confirm("¿Seguro que deseas eliminar esta nota?");
        if (confirmDelete) {
            notes = notes.filter((n) => n.id !== noteId);
            persistNotes();
            
            // Remove embedding for deleted note
            if (embeddingModelStatus === "loaded") {
                embeddingService.removeNoteEmbedding(noteId);
            }
            
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
          
          // Reprocess embedding for edited note
          if (embeddingModelStatus === "loaded") {
            embeddingService.processNote(notes[idx]).catch(error => {
              console.warn('Error reprocessing edited note embedding:', error);
            });
          }
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
        
        // Process embedding for new note
        if (embeddingModelStatus === "loaded") {
            embeddingService.processNote(note).catch(error => {
                console.warn('Error processing new note embedding:', error);
            });
        }
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

    // Enviar mensaje de chat
    async function sendChatMessage() {
        if (!userMessage.trim()) return;
        
        // Agregar mensaje del usuario al historial
        chatHistory = [...chatHistory, { role: "user", content: userMessage }];
        const currentMessage = userMessage;
        userMessage = "";
        
        // Save chat state after adding user message
        saveCurrentChatState();

        // Construir prompt con contexto
        let structuredPrompt = "Por favor, utiliza la siguiente información de contexto y responde de forma clara:\n\n";
        
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
        structuredPrompt += `${currentMessage.trim()}\n`;

        try {
            // Agregar mensaje "cargando" del asistente
            chatHistory = [...chatHistory, { role: "assistant", content: "Cargando respuesta..." }];
            
            const response = await sendToAI(structuredPrompt, true);
            
            // Save chat state after AI response
            saveCurrentChatState();
        } catch (error) {
            chatHistory[chatHistory.length - 1].content = `Error al obtener respuesta del LLM: ${error.message}`;
            saveCurrentChatState();
        }
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

    async function sendToAI(prompt: string, updateChat: boolean = false): Promise<string> {
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
            
            if (updateChat) {
                // Actualizar el último mensaje del chat en tiempo real
                chatHistory[chatHistory.length - 1].content = accumulated;
            } else {
                llmResult = accumulated;
            }
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
                    showToastNotification("Resultado copiado al portapapeles");
                })
                .catch((err) => {
                    console.error("Error copiando al portapapeles:", err);
                });
        }
    }

    // Toast notification system
    function showToastNotification(message) {
        toastMessage = message;
        showToast = true;
        
        // Auto-hide after 2 seconds
        setTimeout(() => {
            showToast = false;
        }, 2000);
    }

    // Copy message content to clipboard
    async function copyMessageContent(content) {
        try {
            // Remove HTML tags for copying plain text
            const plainText = content.replace(/<[^>]*>/g, '');
            await navigator.clipboard.writeText(plainText);
            showToastNotification("Copiado!");
        } catch (error) {
            console.error("Error copying message:", error);
            showToastNotification("Error al copiar");
        }
    }

    // Funciones para contexto de notas
    function toggleContextNote(noteId) {
        if (selectedContextNotes.includes(noteId)) {
            selectedContextNotes = selectedContextNotes.filter(id => id !== noteId);
            manuallySelectedNotes = manuallySelectedNotes.filter(id => id !== noteId);
        } else {
            selectedContextNotes = [...selectedContextNotes, noteId];
            manuallySelectedNotes = [...manuallySelectedNotes, noteId];
        }
    }

    function removeContextNote(noteId) {
        selectedContextNotes = selectedContextNotes.filter(id => id !== noteId);
        manuallySelectedNotes = manuallySelectedNotes.filter(id => id !== noteId);
    }

    function clearContextSelection() {
        selectedContextNotes = [];
        manuallySelectedNotes = [];
    }

    function toggleContextDropdown() {
        showContextDropdown = !showContextDropdown;
        if (showContextDropdown) {
            contextSearchQuery = "";
        }
    }

    function handleClickOutside(event) {
        if (showContextDropdown && !event.target.closest('.context-dropdown')) {
            showContextDropdown = false;
        }
    }

    // Debounced real-time search function
    function debounceSearch(query, delay = 500) {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        searchDebounceTimer = setTimeout(() => {
            performRealtimeSearch(query);
        }, delay);
    }

    // Perform real-time context search
    async function performRealtimeSearch(query) {
        if (!query.trim() || query.length < 3) {
            // Only keep manually selected notes
            selectedContextNotes = [...manuallySelectedNotes];
            isSearching = false;
            return;
        }

        if (embeddingModelStatus !== "loaded") {
            isSearching = false;
            return;
        }

        isSearching = true;
        try {
            console.log(`🔍 Real-time search: "${query}" (threshold: ${similarityThreshold})`);
            const relevantNotes = await embeddingService.findSimilarNotesOptimized(query, notes, similarityThreshold);
            
            if (relevantNotes.length > 0) {
                // Combine manually selected notes with automatically found notes
                const autoSelectedNotes = relevantNotes.map(note => note.id);
                const combinedNotes = [...new Set([...manuallySelectedNotes, ...autoSelectedNotes])];
                selectedContextNotes = combinedNotes;
                
                console.log(`📝 Found ${relevantNotes.length} relevant notes:`, relevantNotes.map(n => ({ 
                    title: n.title, 
                    similarity: (n.similarity * 100).toFixed(1) + '%'
                })));
            } else {
                // Only keep manually selected notes when no automatic matches found
                selectedContextNotes = [...manuallySelectedNotes];
                console.log('📝 No relevant notes found for current query');
            }
        } catch (error) {
            console.warn('Error in real-time search:', error);
        } finally {
            isSearching = false;
        }
    }

    // Watch for changes in user message, threshold, and model status - trigger search
    $: {
        if (userMessage && embeddingModelStatus === "loaded") {
            debounceSearch(userMessage);
        } else if (!userMessage) {
            // Only keep manually selected notes when no message
            selectedContextNotes = [...manuallySelectedNotes];
            isSearching = false;
        }
    }

    // Watch threshold changes separately to re-search with current message
    $: if (similarityThreshold && userMessage && userMessage.length >= 3 && embeddingModelStatus === "loaded") {
        debounceSearch(userMessage, 200); // Quick response for threshold changes
    }

    // AI-powered automatic context selection
    async function autoSelectRelevantNotes() {
        if (!userMessage.trim() || isAutoSelecting) return;
        
        isAutoSelecting = true;
        try {
            // Try local embeddings first if available
            if (embeddingModelStatus === "loaded") {
                console.log(`Using local embeddings for semantic search (threshold: ${similarityThreshold})...`);
                const relevantNotes = await embeddingService.findSimilarNotesOptimized(userMessage, notes, similarityThreshold);
                
                if (relevantNotes.length > 0) {
                    selectedContextNotes = relevantNotes.map(note => note.id);
                    console.log(`🎯 Auto-selected ${relevantNotes.length} relevant notes (embeddings):`, relevantNotes.map(n => ({ 
                        title: n.title, 
                        similarity: (n.similarity * 100).toFixed(1) + '%'
                    })));
                    return;
                }
            }
            
            // Fallback to API-based semantic search
            const response = await fetch('/api/semantic-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: userMessage,
                    notes: notes,
                    maxResults: 20 // Higher limit for API fallback
                })
            });
            
            if (response.ok) {
                const { relevantNotes } = await response.json();
                selectedContextNotes = relevantNotes.map(note => note.id);
                
                console.log('Auto-selected notes (API):', relevantNotes.map(n => ({ 
                    title: n.title, 
                    score: n.relevanceScore?.toFixed(2),
                    explanation: n.explanation 
                })));
            } else {
                // Final fallback to simple keyword matching
                const relevantNotes = findRelevantNotesByKeywords(userMessage);
                selectedContextNotes = relevantNotes.slice(0, 10).map(note => note.id);
                console.log('Auto-selected notes (keyword fallback)');
            }
        } catch (error) {
            console.error('Error auto-selecting notes:', error);
            // Final fallback to simple keyword matching
            const relevantNotes = findRelevantNotesByKeywords(userMessage);
            selectedContextNotes = relevantNotes.slice(0, 10).map(note => note.id);
        } finally {
            isAutoSelecting = false;
        }
    }

    function findRelevantNotesByKeywords(query) {
        const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        
        return notes.map(note => {
            const noteText = `${note.title} ${note.content}`.toLowerCase();
            let score = 0;
            
            // Calculate relevance score based on keyword matches
            queryWords.forEach(word => {
                const titleMatches = (note.title.toLowerCase().match(new RegExp(word, 'g')) || []).length;
                const contentMatches = (note.content.toLowerCase().match(new RegExp(word, 'g')) || []).length;
                
                // Weight title matches higher than content matches
                score += titleMatches * 3 + contentMatches;
            });
            
            // Boost score for recent notes
            const daysSinceCreation = (Date.now() - new Date(note.date).getTime()) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 1 - daysSinceCreation / 30); // Boost notes from last 30 days
            score += recencyBoost * 2;
            
            return { ...note, relevanceScore: score };
        })
        .filter(note => note.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
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

<div class="h-screen flex flex-col bg-gray-50" on:click={handleClickOutside}>
    <!-- Header simplificado -->
    <header
        class="flex items-center justify-between px-4 py-2 bg-gray-100 rounded-b-lg shadow"
    >
        <div class="text-2xl font-bold text-gray-900">🗒️ ContextoNote</div>
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

        <!-- Panel derecho: Chat Interface -->
        <aside class="w-1/3 border-l border-gray-200 flex flex-col bg-gray-50">
            <!-- Chat Header -->
            <div class="p-3 border-b border-gray-200 bg-white">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h2 class="text-lg font-bold text-gray-900">Chat</h2>
                        {#if currentChatId}
                            {@const currentChat = chats.find(c => c.id === currentChatId)}
                            {#if currentChat}
                                <span class="text-sm text-gray-500 truncate max-w-32" title={currentChat.title}>
                                    {currentChat.title}
                                </span>
                            {/if}
                        {/if}
                    </div>
                    <div class="flex items-center gap-1">
                        <!-- New Chat Button -->
                        <button
                            on:click={createNewChat}
                            class="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Nueva conversación"
                        >
                            <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                        </button>
                        
                        <!-- Chat History Toggle -->
                        <button
                            on:click={() => showChatHistory = !showChatHistory}
                            class="p-1 hover:bg-gray-100 rounded transition-colors {showChatHistory ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}"
                            title="Historial de conversaciones"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Chat History Panel -->
            {#if showChatHistory}
                <div class="border-b border-gray-200 bg-white max-h-64 overflow-y-auto">
                    <div class="p-2">
                        <h3 class="text-sm font-medium text-gray-700 mb-2">Conversaciones ({chats.length})</h3>
                        <div class="space-y-1">
                            {#each chats as chat}
                                <div class="group flex items-center justify-between p-2 rounded hover:bg-gray-50 {chat.id === currentChatId ? 'bg-blue-50 border border-blue-200' : ''}">
                                    <button
                                        on:click={() => switchToChat(chat.id)}
                                        class="flex-1 text-left"
                                    >
                                        <div class="text-sm font-medium text-gray-900 truncate">
                                            {chat.title}
                                        </div>
                                        <div class="text-xs text-gray-500">
                                            {chat.messages.length} mensajes • {new Date(chat.updatedAt).toLocaleDateString()}
                                        </div>
                                    </button>
                                    <button
                                        on:click={() => deleteChat(chat.id)}
                                        class="p-1 hover:bg-red-100 rounded text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Eliminar conversación"
                                    >
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            {/if}
            
            <!-- Context Notes Selection -->
            <div class="border-b border-gray-200 p-2">
                <!-- Selected Notes Display -->
                {#if selectedContextNotes.length > 0}
                    <div class="flex flex-wrap gap-1 mb-2">
                        {#each selectedContextNotes as noteId}
                            {@const note = notes.find(n => n.id === noteId)}
                            {#if note}
                                <span class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    {note.title}
                                    <button
                                        on:click={() => removeContextNote(noteId)}
                                        class="ml-1 text-blue-600 hover:text-blue-800"
                                    >
                                        ×
                                    </button>
                                </span>
                            {/if}
                        {/each}
                    </div>
                {/if}
                <div class="flex items-center justify-between gap-2">
                    <!-- Dropdown Button -->
                <div class="relative context-dropdown flex-1">
                    <button
                        on:click={toggleContextDropdown}
                        class="w-full flex items-center justify-between px-3 py-2 text-left border border-gray-300 bg-white rounded hover:bg-gray-50 text-gray-700"
                    >
                        <span class="text-sm">
                            {selectedContextNotes.length > 0 
                                ? `${selectedContextNotes.length} nota${selectedContextNotes.length > 1 ? 's' : ''} relevante${selectedContextNotes.length > 1 ? 's' : ''}`
                                : 'Contexto automático'
                            }
                            {#if isSearching}
                                <span class="text-blue-600">...</span>
                            {/if}
                        </span>
                        <svg class="w-4 h-4 {showContextDropdown ? 'rotate-180' : ''} transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>

                    <!-- Dropdown Menu -->
                    {#if showContextDropdown}
                        <div class="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-hidden">
                            <!-- Search Input -->
                            <div class="p-2 border-b border-gray-100">
                                <input
                                    type="text"
                                    placeholder="Buscar notas..."
                                    bind:value={contextSearchQuery}
                                    class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            
                            <!-- Notes List -->
                            <div class="max-h-40 overflow-y-auto">
                                {#each filteredContextNotes as note}
                                    <button
                                        on:click={() => toggleContextNote(note.id)}
                                        class="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between text-sm border-b border-gray-50 last:border-b-0"
                                    >
                                        <div class="flex-1 min-w-0">
                                            <div class="font-medium text-gray-900 truncate">{note.title}</div>
                                            <div class="text-xs text-gray-500">{note.dateRaw}</div>
                                        </div>
                                        {#if selectedContextNotes.includes(note.id)}
                                            <svg class="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        {/if}
                                    </button>
                                {:else}
                                    <div class="px-3 py-2 text-sm text-gray-500">No se encontraron notas</div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
                    <!-- Real-time Search Status -->
                    <div class="flex items-center px-2 py-1 text-xs bg-gray-50 rounded">
                        {#if embeddingModelStatus === "loading"}
                            <div class="w-2 h-2 rounded-full bg-yellow-400 animate-pulse mr-1"></div>
                            <span class="text-gray-600">Cargando modelo...</span>
                        {:else if embeddingModelStatus === "loaded"}
                            {#if isSearching}
                                <div class="w-2 h-2 rounded-full bg-blue-400 animate-pulse mr-1"></div>
                                <span class="text-gray-600">Buscando...</span>
                            {:else if userMessage && userMessage.length >= 3}
                                <div class="w-2 h-2 rounded-full bg-green-400 mr-1"></div>
                                <span class="text-gray-600">Auto-activo</span>
                            {:else}
                                <div class="w-2 h-2 rounded-full bg-gray-400 mr-1"></div>
                                <span class="text-gray-600">Escribe para buscar</span>
                            {/if}
                        {:else}
                            <div class="w-2 h-2 rounded-full bg-red-400 mr-1"></div>
                            <span class="text-gray-600">Búsqueda básica</span>
                        {/if}
                    </div>
                    
                    {#if selectedContextNotes.length > 0}
                        <button
                            on:click={clearContextSelection}
                            class="px-2 py-2 text-xs text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                            title="Limpiar selección"
                        >
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    {/if}
                </div>
                
                <!-- Similarity Threshold Setting -->
                {#if embeddingModelStatus === "loaded"}
                    <div class="mt-2 px-2 py-1 bg-gray-50 rounded text-xs">
                        <label class="flex items-center justify-between">
                            <span class="text-gray-600">Sensibilidad: {Math.round(similarityThreshold * 100)}%</span>
                            <input 
                                type="range" 
                                min="0.1" 
                                max="0.7" 
                                step="0.05" 
                                bind:value={similarityThreshold}
                                class="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                title="Ajusta cuán similares deben ser las notas para ser seleccionadas automáticamente"
                            />
                        </label>
                        <div class="text-xs text-gray-500 mt-1">
                            Busca en tiempo real mientras escribes
                        </div>
                    </div>
                {/if}
                

                
            </div>

            <!-- Chat Messages -->
            <div class="flex-1 overflow-y-auto p-4 space-y-4">
                {#each chatHistory as message}
                    <div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
                        <div class="group relative max-w-[80%] {message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'} rounded-lg p-3">
                            {#if message.role === 'user'}
                                <div class="text-sm pr-6">{message.content}</div>
                            {:else}
                                <div class="text-gray-800 text-sm markdown-result pr-6">
                                    {@html renderMarkdown(message.content)}
                                </div>
                            {/if}
                            
                            <!-- Copy Button -->
                            <button
                                on:click={() => copyMessageContent(message.content)}
                                class="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 {message.role === 'user' ? 'bg-blue-700 hover:bg-blue-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}"
                                title="Copiar mensaje"
                            >
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Chat Input -->
            <div class="p-4 border-t border-gray-200">
                <div class="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Escribe tu mensaje..."
                        bind:value={userMessage}
                        on:keydown={(e) => e.key === 'Enter' && sendChatMessage()}
                        class="flex-1 border border-gray-300 bg-white rounded px-3 py-2 text-gray-800"
                    />
                    <button
                        class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center"
                        on:click={sendChatMessage}
                    >
                        <!-- Heroicon Paper Airplane -->
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1.5"
                            stroke="currentColor"
                            class="w-5 h-5"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    </div>
</div>

<!-- Toast Notification -->
{#if showToast}
    <div 
        class="fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-all duration-300"
        in:fade={{ duration: 200 }}
        out:fade={{ duration: 200 }}
    >
        <div class="flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            {toastMessage}
        </div>
    </div>
{/if}
