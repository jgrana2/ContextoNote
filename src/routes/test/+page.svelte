<script lang="ts">
  import { marked } from 'marked';
  import { writable } from 'svelte/store';

  let noteText = '';
  let editing = true;

  interface AttachedFile {
    file: File;
    previewUrl: string | null;
    id: number;
  }
  let attachedFiles = writable<AttachedFile[]>([]);
  let fileIdCounter = 0;
  let dragActive = false;
  let textareaEl: HTMLTextAreaElement;

  $: rendered = marked.parse(noteText);

  function addFiles(files: FileList | File[]) {
    const newFiles: AttachedFile[] = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const previewUrl = isImage ? URL.createObjectURL(file) : null;
      newFiles.push({ file, previewUrl, id: fileIdCounter++ });
    }
    attachedFiles.update(curr => [...curr, ...newFiles]);
  }
  function removeFile(id: number) {
    attachedFiles.update(files => {
      const fileToRemove = files.find(f => f.id === id);
      if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
      return files.filter(f => f.id !== id);
    });
  }
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
    box-shadow: 0 0 0 3px #38bdf8aa, 0 2px 8px 0 #0001;
    border-color: #38bdf8 !important;
    background: #f0f9ff !important;
    transition: box-shadow 0.2s, background 0.2s, border-color 0.2s;
  }
  .prose {
    scrollbar-width: none;
  }
  .prose::-webkit-scrollbar {
    display: none;
  }
</style>

<div class="max-w-2xl mx-auto pt-12 pb-20 px-2 sm:px-0 font-sans">
  <!-- Tabs/Attach Button -->
  <div class="flex mb-5 border-b border-gray-100 items-center gap-1">
    <button
      class="py-2 px-4 text-base font-semibold border-b-2 transition-all flex items-center gap-2 rounded-t-md
             hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-200
             bg-white"
      class:border-sky-400={editing}
      class:text-sky-600={editing}
      class:border-transparent={!editing}
      class:text-gray-400={!editing}
      on:click={() => editing = true}
      aria-current={editing ? "page" : undefined}
      tabindex="0"
      style="outline: none;"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 01-8 0" />
      </svg>
      Editor
    </button>
    <button
      class="py-2 px-4 text-base font-semibold border-b-2 transition-all flex items-center gap-2 rounded-t-md
             hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-200
             bg-white"
      class:border-sky-400={!editing}
      class:text-sky-600={!editing}
      class:border-transparent={editing}
      class:text-gray-400={editing}
      on:click={() => editing = false}
      aria-current={!editing ? "page" : undefined}
      tabindex="0"
      style="outline: none;"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-6a2 2 0 012-2h2a2 2 0 012 2v6" />
      </svg>
      Vista previa
    </button>
    <div class="flex-1"></div>
    <button
      type="button"
      class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 hover:border-sky-300 hover:bg-sky-50 text-sky-500 rounded-md text-xs font-medium shadow-sm transition select-none focus-visible:ring-2 focus-visible:ring-sky-200"
      on:click={() => document.getElementById('fileInput')?.click()}
      title="Adjuntar archivos"
      tabindex="0"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 002.828 2.828l6.586-6.586a4 4 0 10-5.656-5.656l-6.586 6.586" />
      </svg>
      <span>Adjuntar</span>
    </button>
    <input
      id="fileInput"
      type="file"
      multiple
      class="hidden"
      on:change={handleFileInputChange}
      accept="image/*,application/pdf,text/plain"
    />
  </div>

  <!-- Editor/Preview Panel (Drop area) -->
  <div
    class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 min-h-[200px] mb-10 relative transition-all"
    class:drag-active={dragActive}
    on:dragover|preventDefault={handleDragOver}
    on:dragleave|preventDefault={handleDragLeave}
    on:drop={handleDrop}
    tabindex="0"
  >
    {#if editing}
      <div class="relative">
        {#if dragActive}
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-sky-50/90 border-2 border-sky-400 rounded-xl pointer-events-none transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-sky-400 mb-2 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0L6 10m6-6l6 6M6 18h12" />
            </svg>
            <span class="text-xl font-semibold text-sky-700">Suelta para adjuntar archivos</span>
          </div>
        {/if}
        <textarea
          bind:this={textareaEl}
          bind:value={noteText}
          placeholder="Escribe tus notas en Markdown aquí…"
          rows="10"
          class="w-full p-4 bg-slate-50 border border-gray-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-sky-300 focus:bg-white transition placeholder-gray-300 italic shadow-none text-base"
          spellcheck="true"
          autofocus
        ></textarea>
      </div>
    {:else}
      <div class="prose prose-sm max-w-none text-slate-600" tabindex="0" style="max-height: 35vh; overflow-y: auto;">
        {@html rendered}
      </div>
    {/if}
  </div>

  <!-- Attachments Section -->
  {#if $attachedFiles.length > 0}
    <div class="mt-8">
      <h3 class="text-lg font-semibold mb-3 text-gray-700 tracking-tight pl-1">Archivos adjuntos</h3>
      <ul class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
        {#each $attachedFiles as file (file.id)}
          <li class="relative group w-full aspect-square flex flex-col items-center justify-center border border-gray-100 rounded-lg bg-slate-50 hover:bg-sky-50 shadow-sm hover:shadow-md transition-all transform hover:scale-[1.025] overflow-hidden">
            {#if file.previewUrl && file.file.type.startsWith('image/')}
              <a href={file.previewUrl} target="_blank" rel="noopener noreferrer" class="block w-full h-full">
                <img
                  src={file.previewUrl}
                  alt={file.file.name}
                  class="object-cover w-full h-full rounded pointer-events-none transition-opacity"
                  loading="lazy"
                />
                <span class="absolute bottom-1 left-1 text-[11px] bg-white/70 rounded px-2 font-mono text-gray-500 shadow">{file.file.type.replace('image/', '')} · {Math.round(file.file.size/1024)}KB</span>
              </a>
            {:else}
              <a
                href={URL.createObjectURL(file.file)}
                download={file.file.name}
                class="flex flex-col items-center justify-center text-gray-400 text-xs text-center w-full h-full p-3"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 4v16m8-8H4" />
                </svg>
                <span class="break-words truncate w-16">{file.file.name}</span>
                <span class="text-[10px] text-gray-400">{file.file.type} · {Math.round(file.file.size/1024)}KB</span>
              </a>
            {/if}
            <button
              type="button"
              aria-label="Eliminar archivo"
              on:click={() => removeFile(file.id)}
              class="absolute top-1.5 right-1.5 bg-gray-200 hover:bg-red-400 text-gray-500 hover:text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 shadow"
              title="Eliminar archivo"
            >✕</button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>