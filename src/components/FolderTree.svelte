<script lang="ts">
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
        folderId: number | null;
        date: string;
        dateRaw: string;
    }

    export let folders: Folder[] = [];
    export let notes: Note[] = [];
    export let selectedNoteId: number | null = null;
    export let selectedFolderId: number | null = null;
    export let onNoteClick: (note: Note) => void;
    export let onNoteDelete: (noteId: number) => void;
    export let onNoteEdit: (note: Note) => void;
    export let onFolderCreate: (parentId: number | null) => void;
    export let onFolderRename: (folderId: number, newName: string) => void;
    export let onFolderDelete: (folderId: number) => void;
    export let onNoteDrop: (noteId: number, targetFolderId: number | null) => void;

    let expandedFolders: Set<number> = new Set();
    let hoveredFolderId: number | null = null;
    let editingFolderId: number | null = null;
    let editingFolderName: string = "";
    let draggedNoteId: number | null = null;
    let dropTargetFolderId: number | null = null;

    // Build folder hierarchy
    function buildFolderTree(parentId: number | null = null): Folder[] {
        return folders
            .filter(f => f.parentFolderId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Get notes for a folder
    function getNotesForFolder(folderId: number | null): Note[] {
        return notes
            .filter(n => n.folderId === folderId)
            .sort((a, b) => b.id - a.id); // Most recent first
    }

    // Count notes in folder and subfolders
    function countNotesInFolder(folderId: number): number {
        const directNotes = notes.filter(n => n.folderId === folderId).length;
        const childFolders = folders.filter(f => f.parentFolderId === folderId);
        const childNotes = childFolders.reduce((sum, f) => sum + countNotesInFolder(f.id), 0);
        return directNotes + childNotes;
    }

    function toggleFolder(folderId: number) {
        if (expandedFolders.has(folderId)) {
            expandedFolders.delete(folderId);
        } else {
            expandedFolders.add(folderId);
        }
        expandedFolders = expandedFolders;
    }

    function selectFolder(folderId: number | null) {
        selectedFolderId = folderId;
    }

    function startEditFolder(folder: Folder) {
        editingFolderId = folder.id;
        editingFolderName = folder.name;
    }

    function saveEditFolder() {
        if (editingFolderId !== null && editingFolderName.trim()) {
            onFolderRename(editingFolderId, editingFolderName.trim());
            editingFolderId = null;
            editingFolderName = "";
        }
    }

    function cancelEditFolder() {
        editingFolderId = null;
        editingFolderName = "";
    }

    // Drag and drop handlers
    function handleNoteOnDragStart(event: DragEvent, noteId: number) {
        draggedNoteId = noteId;
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(noteId));
        }
    }

    function handleFolderDragOver(event: DragEvent, folderId: number | null) {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
        dropTargetFolderId = folderId;
    }

    function handleFolderDragLeave() {
        dropTargetFolderId = null;
    }

    function handleFolderDrop(event: DragEvent, targetFolderId: number | null) {
        event.preventDefault();
        dropTargetFolderId = null;

        if (draggedNoteId !== null) {
            onNoteDrop(draggedNoteId, targetFolderId);
            draggedNoteId = null;
        }
    }

    function renderFolderTree(parentId: number | null = null, depth: number = 0) {
        const childFolders = buildFolderTree(parentId);
        return { childFolders, depth };
    }
</script>

<div class="folder-tree">
    <!-- Root folder (All Notes) -->
    <div
        class="folder-item root-folder"
        class:selected={selectedFolderId === null}
        class:drop-target={dropTargetFolderId === null && draggedNoteId !== null}
        on:click={() => selectFolder(null)}
        on:dragover={(e) => handleFolderDragOver(e, null)}
        on:dragleave={handleFolderDragLeave}
        on:drop={(e) => handleFolderDrop(e, null)}
        role="button"
        tabindex="0"
    >
        <div class="folder-header">
            <div class="folder-icon">📁</div>
            <div class="folder-name">Todas las Notas</div>
            <div class="note-count">{getNotesForFolder(null).length}</div>
            <button
                class="folder-action-btn"
                on:click|stopPropagation={() => onFolderCreate(null)}
                title="Crear carpeta"
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
            </button>
        </div>
    </div>

    <!-- Root level notes -->
    {#if selectedFolderId === null}
        <div class="notes-list">
            {#each getNotesForFolder(null) as note}
                <div
                    class="note-item"
                    class:selected={selectedNoteId === note.id}
                    draggable="true"
                    on:dragstart={(e) => handleNoteOnDragStart(e, note.id)}
                    on:click={() => onNoteClick(note)}
                    role="button"
                    tabindex="0"
                >
                    <div class="note-title">{note.title}</div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- Recursive folder rendering -->
    {#each buildFolderTree(null) as folder}
        {@const isExpanded = expandedFolders.has(folder.id)}
        {@const noteCount = countNotesInFolder(folder.id)}

        <div class="folder-container">
            <div
                class="folder-item"
                class:selected={selectedFolderId === folder.id}
                class:drop-target={dropTargetFolderId === folder.id && draggedNoteId !== null}
                on:mouseenter={() => hoveredFolderId = folder.id}
                on:mouseleave={() => hoveredFolderId = null}
                on:dragover={(e) => handleFolderDragOver(e, folder.id)}
                on:dragleave={handleFolderDragLeave}
                on:drop={(e) => handleFolderDrop(e, folder.id)}
                role="button"
                tabindex="0"
            >
                <div class="folder-header">
                    <button
                        class="expand-btn"
                        on:click|stopPropagation={() => toggleFolder(folder.id)}
                    >
                        <svg class="w-3 h-3 transition-transform {isExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>

                    {#if editingFolderId === folder.id}
                        <input
                            type="text"
                            bind:value={editingFolderName}
                            on:blur={saveEditFolder}
                            on:keydown={(e) => {
                                if (e.key === 'Enter') saveEditFolder();
                                if (e.key === 'Escape') cancelEditFolder();
                            }}
                            class="folder-name-input"
                            autofocus
                        />
                    {:else}
                        <div class="folder-icon" on:click={() => selectFolder(folder.id)}>📁</div>
                        <div class="folder-name" on:click={() => selectFolder(folder.id)}>{folder.name}</div>
                        <div class="note-count">{noteCount}</div>

                        {#if hoveredFolderId === folder.id}
                            <div class="folder-actions" transition:fade={{ duration: 150 }}>
                                <button
                                    class="folder-action-btn"
                                    on:click|stopPropagation={() => onFolderCreate(folder.id)}
                                    title="Crear subcarpeta"
                                >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                    </svg>
                                </button>
                                <button
                                    class="folder-action-btn"
                                    on:click|stopPropagation={() => startEditFolder(folder)}
                                    title="Renombrar"
                                >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.862 4.487a1.875 1.875 0 112.651 2.651L7.5 19.151 3 20.25l1.099-4.5L16.862 4.487z" />
                                    </svg>
                                </button>
                                <button
                                    class="folder-action-btn"
                                    on:click|stopPropagation={() => onFolderDelete(folder.id)}
                                    title="Eliminar"
                                >
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.74 9L14.394 18.0m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084A2.25 2.25 0 015.84 19.673L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                    </svg>
                                </button>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>

            <!-- Show folder contents when expanded or selected -->
            {#if isExpanded || selectedFolderId === folder.id}
                <div class="folder-contents" transition:fade={{ duration: 200 }}>
                    <!-- Notes in this folder -->
                    {#if selectedFolderId === folder.id}
                        <div class="notes-list">
                            {#each getNotesForFolder(folder.id) as note}
                                <div
                                    class="note-item"
                                    class:selected={selectedNoteId === note.id}
                                    draggable="true"
                                    on:dragstart={(e) => handleNoteOnDragStart(e, note.id)}
                                    on:click={() => onNoteClick(note)}
                                    role="button"
                                    tabindex="0"
                                >
                                    <div class="note-title">{note.title}</div>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <!-- Render subfolders recursively -->
                    {#each buildFolderTree(folder.id) as subfolder}
                        <svelte:self
                            {folders}
                            {notes}
                            {selectedNoteId}
                            {selectedFolderId}
                            {onNoteClick}
                            {onNoteDelete}
                            {onNoteEdit}
                            {onFolderCreate}
                            {onFolderRename}
                            {onFolderDelete}
                            {onNoteDrop}
                            rootFolderId={subfolder.id}
                            depth={1}
                        />
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>

<style>
    .folder-tree {
        padding: 0.5rem;
    }

    .folder-container {
        margin-left: 0.75rem;
    }

    .folder-item,
    .note-item {
        padding: 0.5rem;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: background-color 0.15s;
        margin-bottom: 0.125rem;
    }

    .folder-item:hover,
    .note-item:hover {
        background-color: #f3f4f6;
    }

    .folder-item.selected,
    .note-item.selected {
        background-color: #dbeafe;
        border: 1px solid #93c5fd;
    }

    .folder-item.drop-target {
        background-color: #bfdbfe;
        border: 2px dashed #3b82f6;
    }

    .folder-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .expand-btn {
        padding: 0.125rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: #6b7280;
    }

    .folder-icon {
        font-size: 1rem;
    }

    .folder-name,
    .note-title {
        flex: 1;
        font-size: 0.875rem;
        color: #111827;
        font-weight: 500;
    }

    .note-count {
        font-size: 0.75rem;
        color: #9ca3af;
        background: #f3f4f6;
        padding: 0.125rem 0.375rem;
        border-radius: 0.75rem;
    }

    .folder-actions {
        display: flex;
        gap: 0.25rem;
    }

    .folder-action-btn {
        padding: 0.25rem;
        background: transparent;
        border: none;
        cursor: pointer;
        color: #6b7280;
        border-radius: 0.25rem;
    }

    .folder-action-btn:hover {
        background-color: #e5e7eb;
        color: #111827;
    }

    .folder-name-input {
        flex: 1;
        padding: 0.25rem 0.5rem;
        border: 1px solid #3b82f6;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        outline: none;
    }

    .folder-contents {
        margin-left: 0.5rem;
    }

    .notes-list {
        margin-left: 1.5rem;
        margin-top: 0.25rem;
    }

    .root-folder {
        font-weight: 600;
        margin-bottom: 0.5rem;
    }
</style>