# ContextoNote

A modern note-taking application that combines the simplicity of traditional notes with the power of AI and semantic search. Built with SvelteKit, ContextoNote transforms your notes into an intelligent knowledge base where information finds you.

<img width="664" height="337" alt="screenshot" src="https://github.com/user-attachments/assets/554a9586-40e5-4691-a154-ff2090c975ea" />

## ✨ Features

- **Local AI Embeddings**: Client-side semantic search with configurable models
- **Smart Conversations**: Multi-turn conversations with LLM integration
- **Semantic Search**: Find notes by meaning, not just keywords
- **Real-time Editing**: Responsive markdown editor with live preview
- **SQLite Database**: Persistent storage for notes, conversations, and messages
- **Offline-First**: Local embeddings work without internet connection
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 🧠 How It Works

ContextoNote revolutionizes note-taking by understanding the *meaning* behind your content:

1. **Write** - Create notes with rich markdown support
2. **Embed** - Automatic generation of semantic embeddings using local AI
3. **Search** - Find related notes through intelligent similarity matching
4. **Chat** - Have conversations with AI about your notes and ideas
aa
## 💡 Use Cases

- **Research Notes**: Automatically discover connections between different topics
- **Meeting Notes**: Find relevant past discussions and decisions
- **Personal Knowledge Base**: Build a searchable repository of your thoughts
- **Project Documentation**: Link related concepts across different projects
- **Learning**: Connect new information with existing knowledge

## 🛠️ Tech Stack

- **Frontend**: SvelteKit 2.0 with TypeScript
- **AI**: Transformers.js for local embeddings with configurable models
- **LLM**: Flexible LLM provider integration for conversations
- **Database**: SQLite with better-sqlite3
- **Styling**: Tailwind CSS 4.0
- **Markdown**: Markdown-it for rendering

## 🔧 Configuration

Configure your preferred LLM provider in your environment:

```bash
# .env.local
OPENAI_API_KEY=your_api_key_here
# Or configure other providers as needed
```

## 🎯 Roadmap

- [ ] Export/Import functionality
- [ ] Tag system with auto-suggestions
- [ ] Multiple embedding models support
- [ ] Collaborative editing
- [ ] Mobile app

## 📄 License

MIT License - feel free to use this for your own projects!

---

*Built with ❤️ for the future of intelligent note-taking*
