<script lang="ts">
    import { onMount } from "svelte";
    import FolderTree from "./FolderTree.svelte";
    import { fade } from "svelte/transition";

    interface Folder {
        id: number;
        name: string;
        parentFolderId: number | null;
        createdAt: string;
        updatedAt: string;
    }

    interface Note {
        id: number;
        title: string;
        content: string;
        date: string;
        dateRaw: string;
        folderId: number | null;
        favorite: boolean;
    }

    export let notes: Note[] = [];
    export let folders: Folder[] = [];
    export let selectedNoteId: number | null = null;
    export let selectedFolderId: number | null = null;
    export let searchQuery: string = "";
    export let onNoteClick: (note: Note) => void;
    export let onNoteDelete: (noteId: number) => void;
    export let onNoteEdit: (note: Note) => void;
    export let onCreateNote: () => void;
    export let onSearch: (query: string) => void;
    export let showToastNotification: (message: string) => void;

    type ViewMode = 'folders' | 'recent';
    let viewMode: ViewMode = 'folders';

    // Group notes by time periods for recent view
    function groupNotesByTime(notes: Note[]) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const groups = {
            today: [] as Note[],
            yesterday: [] as Note[],
            thisWeek: [] as Note[],
            lastWeek: [] as Note[],
            thisMonth: [] as Note[],
            lastMonth: [] as Note[],
            thisYear: [] as Note[],
            older: [] as Note[]
        };

        notes.forEach(note => {
            // Parse the note date - handle different formats
            let noteDate: Date;

            // Try to parse the dateRaw field first (e.g., "07/10")
            if (note.dateRaw) {
                const [day, month] = note.dateRaw.split('/').map(Number);
                noteDate = new Date(now.getFullYear(), month - 1, day);
                // If the date is in the future, assume it's from last year
                if (noteDate > now) {
                    noteDate.setFullYear(now.getFullYear() - 1);
                }
            } else {
                // Fallback to parsing the full date string
                noteDate = new Date(note.date);
            }

            const daysDiff = Math.floor((today.getTime() - noteDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff === 0) {
                groups.today.push(note);
            } else if (daysDiff === 1) {
                groups.yesterday.push(note);
            } else if (daysDiff <= 7) {
                groups.thisWeek.push(note);
            } else if (daysDiff <= 14) {
                groups.lastWeek.push(note);
            } else if (daysDiff <= 30) {
                groups.thisMonth.push(note);
            } else if (daysDiff <= 60) {
                groups.lastMonth.push(note);
            } else if (daysDiff <= 365) {
                groups.thisYear.push(note);
            } else {
                groups.older.push(note);
            }
        });

        // Sort each group: favorites first, then by most recent
        Object.keys(groups).forEach(key => {
            groups[key as keyof typeof groups].sort((a, b) => {
                if (a.favorite && !b.favorite) return -1;
                if (!a.favorite && b.favorite) return 1;
                return b.id - a.id;
            });
        });

        return groups;
    }

    $: timeGroups = groupNotesByTime(notes);

    let collapsedGroups: Set<string> = new Set();

    function toggleGroup(groupName: string) {
        if (collapsedGroups.has(groupName)) {
            collapsedGroups.delete(groupName);
        } else {
            collapsedGroups.add(groupName);
        }
        collapsedGroups = collapsedGroups;
    }

    // Folder management functions
    async function handleFolderCreate(parentId: number | null) {
        const folderName = prompt("Nombre de la nueva carpeta:");
        if (!folderName || !folderName.trim()) return;

        try {
            const res = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: folderName.trim(),
                    parentFolderId: parentId
                })
            });

            if (res.ok) {
                const newFolder = await res.json();
                folders = [...folders, newFolder];
                showToastNotification("Carpeta creada");
            } else {
                showToastNotification("Error al crear carpeta");
            }
        } catch (e) {
            showToastNotification("Error al crear carpeta");
        }
    }

    async function handleFolderRename(folderId: number, newName: string) {
        try {
            const res = await fetch('/api/folders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: folderId,
                    name: newName
                })
            });

            if (res.ok) {
                const updatedFolder = await res.json();
                folders = folders.map(f => f.id === folderId ? updatedFolder : f);
                showToastNotification("Carpeta renombrada");
            } else {
                showToastNotification("Error al renombrar carpeta");
            }
        } catch (e) {
            showToastNotification("Error al renombrar carpeta");
        }
    }

    async function handleFolderDelete(folderId: number) {
        const confirmDelete = confirm("¿Seguro que deseas eliminar esta carpeta? Las notas se moverán a la raíz.");
        if (!confirmDelete) return;

        try {
            const res = await fetch(`/api/folders?id=${folderId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                folders = folders.filter(f => f.id !== folderId && f.parentFolderId !== folderId);
                // Update notes that were in this folder
                notes = notes.map(n => n.folderId === folderId ? { ...n, folderId: null } : n);
                if (selectedFolderId === folderId) {
                    selectedFolderId = null;
                }
                showToastNotification("Carpeta eliminada");
            } else {
                showToastNotification("Error al eliminar carpeta");
            }
        } catch (e) {
            showToastNotification("Error al eliminar carpeta");
        }
    }

    async function handleNoteDrop(noteId: number, targetFolderId: number | null) {
        try {
            const res = await fetch('/api/notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: noteId,
                    folderId: targetFolderId
                })
            });

            if (res.ok) {
                const updatedNote = await res.json();
                notes = notes.map(n => n.id === noteId ? updatedNote : n);
                showToastNotification("Nota movida");
            } else {
                showToastNotification("Error al mover nota");
            }
        } catch (e) {
            showToastNotification("Error al mover nota");
        }
    }

    let isOrganizing = false;

    async function organizeNotesByMonth() {
        if (isOrganizing) return;

        const confirm = window.confirm("¿Deseas organizar todas las notas 'Daily' sin carpeta en carpetas mensuales automáticamente?");
        if (!confirm) return;

        isOrganizing = true;
        try {
            const res = await fetch('/api/organize-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (res.ok) {
                const result = await res.json();

                // Refresh folders and notes
                const foldersRes = await fetch('/api/folders');
                if (foldersRes.ok) {
                    folders = await foldersRes.json();
                }

                const notesRes = await fetch('/api/notes');
                if (notesRes.ok) {
                    notes = await notesRes.json();
                }

                showToastNotification(result.message || "Notas organizadas exitosamente");
            } else {
                const error = await res.json();
                showToastNotification(error.error || "Error al organizar notas");
            }
        } catch (e) {
            showToastNotification("Error al organizar notas");
        } finally {
            isOrganizing = false;
        }
    }

    async function toggleFavorite(noteId: number) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;

        try {
            const res = await fetch('/api/notes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: noteId,
                    favorite: !note.favorite
                })
            });

            if (res.ok) {
                const updatedNote = await res.json();
                notes = notes.map(n => n.id === noteId ? updatedNote : n);
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }

    // Get all favorite notes
    function getFavoriteNotes(): Note[] {
        return notes
            .filter(n => n.favorite)
            .sort((a, b) => b.id - a.id); // Most recent first
    }

    function getGroupTitle(groupName: string): string {
        const titles: Record<string, string> = {
            today: 'Hoy',
            yesterday: 'Ayer',
            thisWeek: 'Esta semana',
            lastWeek: 'Semana pasada',
            thisMonth: 'Este mes',
            lastMonth: 'Mes pasado',
            thisYear: 'Este año',
            older: 'Más antiguo'
        };
        return titles[groupName] || groupName;
    }
</script>

<aside class="note-sidebar">
    <!-- Search Bar -->
    <div class="search-container">
        <input
            type="text"
            placeholder="Buscar notas..."
            bind:value={searchQuery}
            on:input={() => onSearch(searchQuery)}
            class="search-input"
        />
    </div>

    <!-- New Note Button -->
    <div class="new-note-container">
        <button class="new-note-btn" on:click={onCreateNote}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="icon"
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
            <span class="btn-text">Nueva Nota</span>
        </button>
    </div>

    <!-- Organize Notes Button -->
    <div class="organize-container">
        <button
            class="organize-btn"
            on:click={organizeNotesByMonth}
            disabled={isOrganizing}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                class="icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
            </svg>
            <span class="btn-text">{isOrganizing ? 'Organizando...' : 'Organizar por mes'}</span>
        </button>
    </div>

    <!-- View Mode Tabs -->
    <div class="tabs-container">
        <button
            class="tab"
            class:active={viewMode === 'folders'}
            on:click={() => viewMode = 'folders'}
        >
            📁 Carpetas
        </button>
        <button
            class="tab"
            class:active={viewMode === 'recent'}
            on:click={() => viewMode = 'recent'}
        >
            🕒 Recientes
        </button>
    </div>

    <!-- Content Area -->
    <div class="content-area">
        {#if viewMode === 'folders'}
            <!-- Folder Tree View -->
            <FolderTree
                {folders}
                {notes}
                {selectedNoteId}
                bind:selectedFolderId
                {onNoteClick}
                {onNoteDelete}
                {onNoteEdit}
                onFolderCreate={handleFolderCreate}
                onFolderRename={handleFolderRename}
                onFolderDelete={handleFolderDelete}
                onNoteDrop={handleNoteDrop}
            />
        {:else if viewMode === 'recent'}
            <!-- Recent Notes View - Grouped by Time -->
            <div class="recent-view">
                <!-- Favorites Section -->
                {#if getFavoriteNotes().length > 0}
                    <div class="favorites-section">
                        <div class="favorites-header">
                            <div class="favorites-icon">⭐</div>
                            <div class="favorites-title">Favoritos</div>
                            <div class="note-count">{getFavoriteNotes().length}</div>
                        </div>
                        <div class="favorites-notes">
                            {#each getFavoriteNotes() as note}
                                <div
                                    class="note-item"
                                    class:selected={selectedNoteId === note.id}
                                    on:click={() => onNoteClick(note)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="note-content">
                                        <div class="note-title">{note.title}</div>
                                        <div class="note-date">{note.dateRaw || note.date}</div>
                                    </div>
                                    <button
                                        class="favorite-btn favorited"
                                        on:click|stopPropagation={() => toggleFavorite(note.id)}
                                        title="Quitar de favoritos"
                                    >
                                        ★
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#each Object.entries(timeGroups) as [groupName, groupNotes]}
                    {#if groupNotes.length > 0}
                        <div class="time-group" transition:fade={{ duration: 200 }}>
                            <div
                                class="group-header"
                                on:click={() => toggleGroup(groupName)}
                                role="button"
                                tabindex="0"
                            >
                                <svg
                                    class="expand-icon"
                                    class:expanded={!collapsedGroups.has(groupName)}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                                <span class="group-title">{getGroupTitle(groupName)}</span>
                                <span class="group-count">{groupNotes.length}</span>
                            </div>

                            {#if !collapsedGroups.has(groupName)}
                                <div class="group-notes" transition:fade={{ duration: 150 }}>
                                    {#each groupNotes as note}
                                        <div
                                            class="note-item"
                                            class:selected={selectedNoteId === note.id}
                                            on:click={() => onNoteClick(note)}
                                            role="button"
                                            tabindex="0"
                                        >
                                            <div class="note-content">
                                                <div class="note-title">{note.title}</div>
                                                <div class="note-date">{note.dateRaw || note.date}</div>
                                            </div>
                                            <button
                                                class="favorite-btn {note.favorite ? 'favorited' : ''}"
                                                on:click|stopPropagation={() => toggleFavorite(note.id)}
                                                title={note.favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                                            >
                                                {note.favorite ? '★' : '☆'}
                                            </button>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}

                {#if notes.length === 0}
                    <div class="empty-state">
                        <p>No hay notas aún. ¡Crea tu primera nota!</p>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</aside>

<style>
    .note-sidebar {
        width: 20rem;
        background-color: #f9fafb;
        border-right: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .search-container {
        padding: 1rem;
    }

    .search-input {
        width: 100%;
        border: 1px solid #d1d5db;
        background-color: white;
        border-radius: 0.375rem;
        padding: 0.5rem 0.75rem;
        color: #1f2937;
        font-size: 0.875rem;
    }

    .search-input:focus {
        outline: none;
        border-color: #3b82f6;
        ring: 2px;
        ring-color: #93c5fd;
    }

    .new-note-container {
        padding: 0 1rem 0.5rem 1rem;
    }

    .new-note-btn {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0.5rem;
        background-color: transparent;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }

    .new-note-btn:hover {
        background-color: #e5e7eb;
    }

    .new-note-btn .icon {
        height: 1.5rem;
        width: 1.5rem;
        color: #1f2937;
    }

    .organize-container {
        padding: 0 1rem 1rem 1rem;
    }

    .organize-btn {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 0.5rem;
        background-color: #3b82f6;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background-color 0.15s;
    }

    .organize-btn:hover:not(:disabled) {
        background-color: #2563eb;
    }

    .organize-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .organize-btn .icon {
        height: 1.5rem;
        width: 1.5rem;
        color: white;
    }

    .organize-btn .btn-text {
        color: white;
    }

    .btn-text {
        margin-left: 0.75rem;
        font-weight: 500;
        color: #1f2937;
    }

    .tabs-container {
        display: flex;
        border-bottom: 1px solid #e5e7eb;
        padding: 0 1rem;
    }

    .tab {
        flex: 1;
        padding: 0.75rem 1rem;
        background-color: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        color: #6b7280;
        transition: all 0.15s;
    }

    .tab:hover {
        color: #1f2937;
        background-color: #f3f4f6;
    }

    .tab.active {
        color: #3b82f6;
        border-bottom-color: #3b82f6;
    }

    .content-area {
        flex: 1;
        overflow-y: auto;
    }

    .recent-view {
        padding: 0.5rem;
    }

    .time-group {
        margin-bottom: 1rem;
    }

    .group-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        border-radius: 0.375rem;
        transition: background-color 0.15s;
    }

    .group-header:hover {
        background-color: #f3f4f6;
    }

    .expand-icon {
        width: 1rem;
        height: 1rem;
        color: #6b7280;
        transition: transform 0.15s;
    }

    .expand-icon.expanded {
        transform: rotate(90deg);
    }

    .group-title {
        flex: 1;
        font-size: 0.875rem;
        font-weight: 600;
        color: #374151;
    }

    .group-count {
        font-size: 0.75rem;
        color: #9ca3af;
        background: #f3f4f6;
        padding: 0.125rem 0.5rem;
        border-radius: 0.75rem;
    }

    .group-notes {
        margin-left: 1.5rem;
        margin-top: 0.25rem;
    }

    .note-item {
        position: relative;
        padding: 0.75rem;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
    }

    .note-item:hover {
        background-color: #f3f4f6;
    }

    .note-item.selected {
        background-color: #dbeafe;
        border: 1px solid #93c5fd;
    }

    .note-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: #111827;
        margin-bottom: 0.25rem;
    }

    .note-date {
        font-size: 0.75rem;
        color: #9ca3af;
    }

    .empty-state {
        padding: 2rem 1rem;
        text-align: center;
        color: #9ca3af;
        font-size: 0.875rem;
    }

    .favorite-btn {
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0.125rem;
        margin-left: 0.5rem;
        font-size: 1rem;
        color: #d1d5db;
        transition: color 0.15s;
    }

    .favorite-btn:hover {
        color: #fbbf24;
    }

    .favorite-btn.favorited {
        color: #fbbf24;
    }

    .favorite-btn.favorited:hover {
        color: #f59e0b;
    }

    .note-content {
        flex: 1;
    }

    .favorites-section {
        margin-bottom: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        background-color: #fef3c7;
    }

    .favorites-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        background-color: #fde68a;
        border-radius: 0.5rem 0.5rem 0 0;
        font-weight: 600;
        color: #92400e;
    }

    .favorites-icon {
        font-size: 1.25rem;
    }

    .favorites-title {
        flex: 1;
        font-size: 0.875rem;
        color: #92400e;
    }

    .favorites-notes {
        padding: 0.25rem;
    }
</style>
