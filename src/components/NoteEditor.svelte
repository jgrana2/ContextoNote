<script lang="ts">
  import { marked } from 'marked';
  import { writable } from 'svelte/store';

  // Note state
  let noteText = '';
  let editing = true;

  // Files state
  interface AttachedFile {
    file: File;
    previewUrl: string | null;
    id: number;
  }
  let attachedFiles = writable<AttachedFile[]>([]);
  let fileIdCounter = 0;

  // Drag & drop state
  let dragActive = false;

  // Rendered Markdown HTML (updates as noteText changes)
  $: rendered = marked.parse(noteText);

  // Add files (drag-drop or file input)
  function addFiles(files: FileList | File[]) {
    const newFiles: AttachedFile[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      newFiles.push({
        file,
        previewUrl,
        id: fileIdCounter++,
      });
    }
    attachedFiles.update(curr => [...curr, ...newFiles]);
  }

  // Helper to insert markdown at the cursor (not used now, kept for future)
  let textareaEl: HTMLTextAreaElement;

  // Remove files and clean up
  function removeFile(id: number) {
    attachedFiles.update(files => {
      const fileToRemove = files.find(f => f.id === id);
      if (fileToRemove?.previewUrl) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return files.filter(f => f.id !== id);
    });
  }

  // Drag & Drop events
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragActive = true;
  }
  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragActive = false;
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragActive = false;
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  }
  function handleFileInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files?.length) addFiles(target.files);
    target.value = '';
  }
</script>

<style>
  .drag-active {
    background-color: #f0f9ff;
    border-color: #3b82f6;
  }
</style>

<div class="max-w-3xl mx-auto py-8">
  <!-- File Upload & Drag-drop -->
  <div
    class="relative border-2 border-dashed border-gray-300 rounded-md p-4 transition-all mb-4 cursor-pointer"
    class:drag-active={dragActive}
    on:dragover|preventDefault={handleDragOver}
    on:dragleave|preventDefault={handleDragLeave}
    on:drop={handleDrop}
    title="Arrastra y suelta archivos aquí o haz clic para adjuntar"
    on:click={() => document.getElementById('fileInput')?.click()}
    tabindex="0"
  >
    <div class="flex items-center justify-center space-x-3 text-gray-500 select-none">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V8m0 0V8a4 4 0 014-4h2a4 4 0 014 4v8m0 0a4 4 0 01-4 4H11a4 4 0 01-4-4z" /></svg>
      <span>
        <span class="text-blue-600 font-semibold underline cursor-pointer">Haz clic o arrastra archivos</span>
        &nbsp;para adjuntar imágenes o documentos.
      </span>
    </div>
    <input
      id="fileInput"
      type="file"
      multiple
      class="hidden"
      on:change={handleFileInputChange}
      accept="image/*,application/pdf,text/plain"
    />
  </div>

  <!-- Tabs: Editor / Preview -->
  <div class="flex mb-2 border-b border-gray-200">
    <button class="py-2 px-4 text-sm font-medium border-b-2 transition-all focus:outline-none"
      class:border-blue-500={editing}
      class:text-blue-600={editing}
      on:click={() => editing = true}>
      Editor
    </button>
    <button class="py-2 px-4 text-sm font-medium border-b-2 transition-all focus:outline-none"
      class:border-blue-500={!editing}
      class:text-blue-600={!editing}
      on:click={() => editing = false}>
      Vista previa
    </button>
  </div>

  <div class="bg-white rounded shadow p-4 min-h-[200px]">
    {#if editing}
      <textarea
        bind:this={textareaEl}
        bind:value={noteText}
        placeholder="Escribe tus notas en Markdown aquí…"
        rows="12"
        class="w-full p-3 border rounded resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        spellcheck="true"
        autofocus
      ></textarea>
    {:else}
      <div class="prose prose-sm max-w-none" tabindex="0" this={el => { if (el) el.scrollTop = 0; }}>
        {@html rendered}
      </div>
    {/if}
  </div>

  <!-- Adjuntos visuales (THUMBNAILS and links) -->
  {#if $attachedFiles.length > 0}
    <div class="mt-6">
      <h3 class="font-semibold mb-2 text-gray-700 text-sm">Archivos adjuntos</h3>
      <ul class="flex flex-wrap gap-3">
        {#each $attachedFiles as file (file.id)}
          <li class="relative group w-24 h-24 flex flex-col items-center justify-center border rounded hover:shadow transition-all bg-gray-50 overflow-hidden">
            {#if file.previewUrl && file.file.type.startsWith('image/')}
              <!-- Image thumbnail, open full image in new tab -->
              <a href={file.previewUrl} target="_blank" rel="noopener noreferrer" class="block w-full h-full">
                <img
                  src={file.previewUrl}
                  alt={file.file.name}
                  class="object-cover w-full h-full rounded pointer-events-none"
                  loading="lazy"
                />
              </a>
            {:else}
              <!-- File icon + download link -->
              <a
                href={URL.createObjectURL(file.file)}
                download={file.file.name}
                class="flex flex-col items-center justify-center text-gray-400 text-xs text-center w-full h-full p-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 4v16m8-8H4" />
                </svg>
                <span class="break-words truncate w-20">{file.file.name}</span>
              </a>
            {/if}
            <button
              type="button"
              aria-label="Eliminar archivo"
              on:click={() => removeFile(file.id)}
              class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
            >
              &times;
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>