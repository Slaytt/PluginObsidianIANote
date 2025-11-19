# Project Structure

```
obsidian-gemini-assistant/
│
├── src/                           # Source files
│   ├── core/                      # Plugin core
│   │   └── main.ts               # Plugin entry point
│   ├── services/                  # Service layer
│   │   └── GeminiService.ts      # Gemini API wrapper
│   ├── views/                     # UI Views
│   │   └── GeminiView.ts         # Chat interface
│   ├── modals/                    # Modal dialogs
│   │   ├── LinkSuggestionModal.ts
│   │   └── AtomicNotesModal.ts
│   ├── extensions/                # Editor extensions
│   │   └── AutocompleteExtension.ts  # CodeMirror 6 extension
│   └── settings/                  # Settings
│       └── Settings.ts            # Settings UI
│
├── manifest.json                  # Plugin metadata
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript configuration
├── esbuild.config.mjs            # Build configuration
├── styles.css                     # Plugin styles
│
├── main.js                        # Compiled output (generated)
│
├── README.md                      # Documentation
├── ARCHITECTURE.md                # Architecture documentation
│
└── node_modules/                  # Dependencies (ignored)
```

## Directory Structure Explanation

### `/src/core/`
Contains the plugin's main entry point and lifecycle management.
- **main.ts**: Plugin registration, command setup, view registration

### `/src/services/`
Business logic and external API communication.
- **GeminiService.ts**: Wrapper around Google Generative AI SDK

### `/src/views/`
UI components that extend Obsidian's view system.
- **GeminiView.ts**: Chat interface with Smart Retrieval and context targeting

### `/src/modals/`
Interactive dialogs for user input and selection.
- **LinkSuggestionModal.ts**: Link suggestion preview
- **AtomicNotesModal.ts**: Atomic notes preview

### `/src/extensions/`
CodeMirror 6 extensions for editor enhancement.
- **AutocompleteExtension.ts**: Ghost text autocomplete system

### `/src/settings/`
Settings UI and configuration management.
- **Settings.ts**: Settings tab implementation

## Build Process

1. **TypeScript Compilation**: `src/**/*.ts` → Type checking
2. **esbuild Bundling**: `src/core/main.ts` (entry) → `main.js` (output)
3. **Output**: Single `main.js` file in root directory

## Import Paths

All imports use relative paths from their location:

```typescript
// From src/core/main.ts
import { GeminiService } from '../services/GeminiService';
import { GeminiView } from '../views/GeminiView';

// From src/views/GeminiView.ts
import { GeminiService } from '../services/GeminiService';
import GeminiPlugin from '../core/main';
```

## Version

**Current Version**: 2.1.0
- Restructured codebase with clean directory organization
- Improved maintainability and scalability
- All features remain fully functional
