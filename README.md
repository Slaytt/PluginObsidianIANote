# Obsidian Gemini Assistant

> Transform your Obsidian vault into an AI-augmented knowledge management system with real-time autocomplete, smart linking, and advanced RAG capabilities.

[![Version](https://img.shields.io/badge/version-2.0.6-blue.svg)](https://github.com/Slaytt/PluginObsidianIANote)

## ✨ Features

### 🤖 Ghost Text Autocomplete
**Real-time AI-powered text completion as you write.**
- **Copilot-like experience**: Suggestions appear as ghost text after your cursor
- **Fill-in-the-Middle (FIM)**: Context-aware completion using text before AND after cursor
- **Smart controls**:
  - `Tab` → Accept suggestion
  - `Escape` → Dismiss suggestion
  - Move cursor → Auto-dismiss
  - Keep typing → Auto-dismiss + new suggestion
- **Configurable delay**: Adjust trigger time (300ms - 2000ms)
- **Powered by Gemini 1.5 Flash**: Ultra-fast responses

### 📚 Smart Retrieval (2-Pass RAG)
**Intelligent context retrieval for accurate AI responses.**
- **Two-stage process**:
  1. AI identifies semantically relevant notes from titles
  2. Reads actual note content for context
- **MOC-aware**: Prioritizes specific content notes over meta/index notes
- **Validation**: Filters hallucinated note names
- **Fallback**: Keyword scoring if AI returns no results

### 🎯 Context Targeting (@Mentions)
**Control the scope of AI search with simple mentions.**
- `@CurrentNote` or `@NoteActuelle` → Search only in active note
- `@Folder/Projects` or `@Dossier/Projects` → Search in specific folder
- `@Tag:#important` → Search notes with specific tag
- Visual feedback: "🎯 Searching in: folder Projects"

### 🕸️ Graph Synthesis
**Generate comprehensive summaries of note networks.**
- Analyzes a central note + all connected notes (backlinks + outgoing links)
- Identifies central themes, relationships, and emergent patterns
- Creates a synthesis document with:
  - Global concept explanation
  - How notes relate to each other
  - Key insights from the knowledge cluster
  - List of all connected notes

### ⚛️ Atomic Notes (Zettelkasten Refactor)
**Decompose long notes into atomic concepts.**
- AI identifies distinct concepts in your note
- Preview modal with toggles for each concept
- Each atomic note contains:
  - **Original text** (extracted verbatim)
  - **AI enrichment** (context, connections, ideas)
- Optional: Transform source note into MOC (Map of Content)

### 🔗 Link Suggestions
**Automatic wikilink suggestions for better note connectivity.**
- Analyzes current paragraph
- Suggests relevant existing notes to link
- Preview modal with toggles
- Inserts links using `[[Note Title|alias]]` format
- Clickable links in chat messages

### 💬 Modern Chat Interface
**Beautiful, functional chat UI with Obsidian integration.**
- Bubble-style messages (user/bot/system)
- Full Markdown rendering (headings, lists, code blocks, tables)
- **Clickable internal links**: `[[Note]]` opens the note
- "Save as Note" button with customizable template
- Scrollable history

## 🚀 Installation

### Prerequisites
- Obsidian v0.15.0 or higher
- [Google Gemini API Key](https://makersuite.google.com/app/apikey)

### Steps

1. **Download the plugin**:
   - Clone or download this repository
   - Or install via Obsidian Community Plugins (when published)

2. **Build the plugin**:
   ```bash
   npm install
   npm run build
   ```

3. **Install in Obsidian**:
   - Copy `main.js`, `manifest.json`, and `styles.css` to:
     ```
     <your-vault>/.obsidian/plugins/obsidian-gemini-assistant/
     ```
   - Restart Obsidian or reload plugins

4. **Enable the plugin**:
   - Settings → Community Plugins → Enable "Gemini Assistant"

## ⚙️ Configuration

### Required Settings

**Gemini API Key**
- Get your free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Paste it in Settings → Gemini Assistant → API Key

### Optional Settings

**System Prompt** (default: helpful AI assistant)
- Customize the AI's persona and behavior
- Example: "You are a philosophy expert. Always cite sources."

**Note Template** (default: metadata + definition structure)
- Customize the template for "Save as Note"
- Placeholders:
  - `{{CONTENT}}` → AI response
  - `{{DATE}}` → Current date/time

**Enable Autocomplete** (default: ON)
- Toggle ghost text autocompletion on/off

**Autocomplete Delay** (default: 600ms)
- Time to wait before requesting suggestion
- Range: 300ms - 2000ms
- Lower = faster but more API calls
- Higher = slower but fewer API calls

## 📖 Usage

### Chat with AI

1. Click the robot icon in the left ribbon
2. Type your question
3. Optional: Check "Include active note context" for context-aware answers
4. Press Enter or click Send

**Examples**:
```
Find me the popcorn recipe
```
```
@Folder/Projects what are my current priorities?
```
```
@Tag:#urgent summarize my urgent tasks
```

### Ghost Text Autocomplete

1. Start writing in any note
2. Pause for 600ms
3. Ghost text appears in gray
4. Press `Tab` to accept or `Escape` to dismiss

**Example**:
```
I'm writing about "The recipe for popcorn requires..."
(pause)
Ghost text: "corn kernels, oil, and salt in a large pot."
[Tab] → Accepted!
```

### Link Suggestions

1. Place cursor on a line of text
2. Open Command Palette (`Cmd/Ctrl + P`)
3. Run: **Gemini: Suggest links for current paragraph**
4. Review suggestions in modal
5. Toggle desired links and confirm

### Atomic Notes

1. Open a long note you want to decompose
2. Open Command Palette
3. Run: **Gemini: Refactor into Atomic Notes**
4. Review proposed concepts
5. Toggle concepts to create
6. Optional: Check "Transform into MOC"
7. Confirm

### Graph Synthesis

1. Open any note
2. Open Command Palette
3. Run: **Gemini: Generate Graph Summary**
4. Wait for analysis (reads central note + connected notes)
5. New synthesis note is created and opened

### Generate from Selection

1. Select text in a note
2. Open Command Palette
3. Run: **Gemini: Generate from selection**
4. AI generates content based on selection

## 🏗️ Architecture

### Tech Stack
- **Language**: TypeScript
- **Framework**: Obsidian Plugin API
- **Editor**: CodeMirror 6 (for autocomplete extension)
- **AI**: Google Generative AI SDK (Gemini 1.5 Flash)
- **Build**: esbuild

### Core Components

```
obsidian-gemini-assistant/
├── main.ts                    # Plugin entry point, command registration
├── GeminiService.ts           # Gemini API wrapper
├── GeminiView.ts              # Chat UI and message rendering
├── AutocompleteExtension.ts   # CodeMirror 6 extension for ghost text
├── Settings.ts                # Settings UI
├── LinkSuggestionModal.ts     # Link suggestions modal
├── AtomicNotesModal.ts        # Atomic notes modal
└── styles.css                 # Custom styling
```

### Key Design Patterns

**State Management** (CodeMirror)
- `StateField` for suggestion storage
- `StateEffect` for suggestion updates
- `Decoration` for ghost text rendering

**Component-based UI** (Obsidian)
- `ItemView` for chat sidebar
- `Modal` for interactive dialogs
- `MarkdownRenderer` for rich text + clickable links

**Async/Await** (API calls)
- Debounced autocomplete requests
- AbortController for request cancellation
- Error handling with fallbacks

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Build in development mode (watch)
npm run dev

# Build for production
npm run build
```

### Project Structure

```bash
.
├── main.ts              # Plugin lifecycle
├── *.ts                 # Source files
├── manifest.json        # Plugin metadata
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript config
├── esbuild.config.mjs   # Build config
└── styles.css           # Styles
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

### v2.0.6 (Current)
- ✨ Ghost text autocomplete with Tab/Escape controls
- ✨ Auto-dismiss on cursor movement
- ✨ Clickable wiki links in chat
- 🐛 Fixed EditorView.update conflict
- 🐛 Fixed Tab priority with Prec.high()

### v1.13.0
- ✨ Graph synthesis feature
- ✨ Context targeting with @Mentions

### v1.11.1
- ✨ Atomic notes refactoring
- ✨ Original text preservation + AI enrichment

### v1.10.0
- ✨ Automatic link suggestions

### v1.9.1
- 🎨 Smart retrieval precision improvements
- 🎨 Response style configuration

### v1.9.0
- ✨ Configurable system prompt
- ✨ Configurable note template

## 🐛 Troubleshooting

### Autocomplete not working
1. Check Settings → Gemini Assistant → Enable Autocomplete is ON
2. Reload plugin (toggle OFF then ON in settings)
3. Check browser console (F12) for errors
4. Verify API key is valid

### Links not clickable
1. Reload plugin
2. Check that messages use `[[Note Title]]` format
3. Verify notes exist in vault

### "Too Many Requests" error
1. Increase Autocomplete Delay (Settings)
2. Disable autocomplete temporarily
3. Check Google API quota limits

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Obsidian](https://obsidian.md) - The amazing knowledge base platform
- [Google Generative AI](https://ai.google.dev) - Gemini models
- [CodeMirror 6](https://codemirror.net/) - Editor framework

## 📬 Contact

- GitHub Issues: [Report a bug](https://github.com/yourusername/obsidian-gemini-assistant/issues)
- Discussions: [Join the discussion](https://github.com/yourusername/obsidian-gemini-assistant/discussions)

---

**Made with ❤️ for the Obsidian community**
