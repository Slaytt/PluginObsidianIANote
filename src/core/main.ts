import { Plugin, Editor, MarkdownView, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { GeminiView, VIEW_TYPE_GEMINI } from '../views/GeminiView';
import { GeminiSettingsTab } from '../settings/Settings';
import { GeminiService } from '../services/GeminiService';
import { LinkSuggestionModal, LinkSuggestion } from '../modals/LinkSuggestionModal';
import { AtomicNotesModal, AtomicNote } from '../modals/AtomicNotesModal';
import { createAutocompleteExtension } from '../extensions/AutocompleteExtension';

interface GeminiPluginSettings {
    apiKey: string;
    noteTemplate: string;
    systemPrompt: string;
    enableAutocomplete: boolean;
    autocompleteDelay: number;
}

const DEFAULT_SETTINGS: GeminiPluginSettings = {
    apiKey: 'default',
    noteTemplate: `### metadata :
- Date : {{DATE}}
- Statue : #encours #perma 
- Topic :
- Links : [[...]]


## Définition :
{{CONTENT}}


## Tips : 
-####`,
    systemPrompt: `You are a helpful AI assistant integrated into Obsidian.
Your goal is to help the user manage their personal knowledge base.
Provide detailed, comprehensive, and precise responses. Use Markdown formatting.`,
    enableAutocomplete: true,
    autocompleteDelay: 600
}

export default class GeminiPlugin extends Plugin {
    settings: GeminiPluginSettings;
    service: GeminiService;

    async onload() {
        await this.loadSettings();

        this.service = new GeminiService(this.settings.apiKey);

        this.registerView(
            VIEW_TYPE_GEMINI,
            (leaf) => new GeminiView(leaf, this.service, this)
        );

        // Register CodeMirror autocomplete extension
        this.registerEditorExtension(
            createAutocompleteExtension(
                this.service,
                () => this.settings.enableAutocomplete,
                () => this.settings.autocompleteDelay
            )
        );

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('bot', 'Gemini Assistant', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            this.activateView();
        });

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Gemini Ready');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-gemini-assistant',
            name: 'Open Gemini Assistant',
            callback: () => {
                this.activateView();
            }
        });

        this.addCommand({
            id: 'gemini-generate-selection',
            name: 'Generate from selection',
            editorCallback: async (editor, view) => {
                const selection = editor.getSelection();
                if (!selection) {
                    new Notice('Please select some text first.');
                    return;
                }
                new Notice('Asking Gemini...');
                try {
                    const response = await this.service.generateContent(selection);
                    editor.replaceSelection(response);
                } catch (error) {
                    new Notice('Error generating content.');
                    console.error(error);
                }
            }
        });

        this.addCommand({
            id: 'debug-gemini-models',
            name: 'Debug: List Available Models',
            callback: async () => {
                const key = this.settings.apiKey;
                if (!key || key === 'default') {
                    new Notice('No API Key set.');
                    return;
                }
                try {
                    new Notice('Fetching models...');
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                    const data = await response.json();
                    if (data.error) {
                        console.error('API Error:', data.error);
                        new Notice(`API Error: ${data.error.message}`);
                    } else if (data.models) {
                        console.log('Available Models:', data.models);
                        const modelNames = data.models.map((m: any) => m.name).join('\n');
                        new Notice(`Found ${data.models.length} models. Check console.`);
                        console.log(modelNames);
                    } else {
                        new Notice('No models found or unexpected response.');
                        console.log(data);
                    }
                } catch (e) {
                    console.error(e);
                    new Notice('Network error checking models.');
                }
            }
        });

        this.addCommand({
            id: 'gemini-suggest-links',
            name: 'Suggest links for current paragraph',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line);

                if (!lineText.trim()) {
                    new Notice('Current line is empty.');
                    return;
                }

                new Notice('Analyzing for links...');

                // Get all note titles
                const allFiles = this.app.vault.getMarkdownFiles();
                const noteTitles = allFiles.map(file => file.basename);

                const prompt = `
You are a linking assistant for Obsidian.
TEXT TO ANALYZE: "${lineText}"

LIST OF ALL NOTE TITLES:
${JSON.stringify(noteTitles)}

TASK:
1. Identify phrases in the text that correspond to existing note titles.
2. Return a JSON array of objects: { "originalText": "text in paragraph", "noteTitle": "Exact Note Title" }.
3. Only suggest links where the connection is clear.
4. Do not suggest linking common words like "the", "a", "is".
5. Example: If text is "I love popcorn" and note is "Popcorn Recipe", return [{ "originalText": "popcorn", "noteTitle": "Popcorn Recipe" }].
`;

                try {
                    const response = await this.service.generateContent(prompt);
                    const jsonMatch = response.match(/\[.*\]/s);
                    if (jsonMatch) {
                        const suggestions: LinkSuggestion[] = JSON.parse(jsonMatch[0]);

                        // Filter valid suggestions
                        const validSuggestions = suggestions.filter(s => noteTitles.includes(s.noteTitle));

                        if (validSuggestions.length === 0) {
                            new Notice('No relevant links found.');
                            return;
                        }

                        new LinkSuggestionModal(this.app, validSuggestions, (selected) => {
                            let newLineText = lineText;
                            // Sort by length of originalText descending to avoid partial replacements
                            selected.sort((a, b) => b.originalText.length - a.originalText.length);

                            selected.forEach(s => {
                                // Escaping special regex chars in originalText
                                const escapedText = s.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const regex = new RegExp(escapedText, 'gi');
                                newLineText = newLineText.replace(regex, `[[${s.noteTitle}|${s.originalText}]]`);
                            });

                            editor.setLine(cursor.line, newLineText);
                            new Notice(`Applied ${selected.length} links.`);
                        }).open();

                    } else {
                        new Notice('No structured suggestions found.');
                    }
                } catch (error) {
                    console.error(error);
                    new Notice('Error suggesting links.');
                }
            }
        });

        this.addCommand({
            id: 'gemini-atomic-notes',
            name: 'Refactor into Atomic Notes',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                const currentFile = view.file;
                if (!currentFile) {
                    new Notice('No active file.');
                    return;
                }

                const content = editor.getValue();
                if (!content.trim()) {
                    new Notice('Current note is empty.');
                    return;
                }

                new Notice('⚙️ Analyzing note structure...');

                const prompt = `
You are a Zettelkasten expert. Your task is to decompose a long note into atomic notes.

CURRENT NOTE CONTENT:
"${content}"

TASK:
1. Identify distinct atomic concepts in this text (each concept should be self-contained).
2. For each concept, extract the relevant paragraph(s) from the original text.
3. For each atomic note, create:
   - A clear, descriptive title (filename-friendly, no special chars except underscore and dash)
   - The content structured as follows:
     **First**: The original paragraph(s) extracted verbatim from the text (keep the exact wording)
     **Then**: Add a separator "---" 
     **Finally**: Add your enrichment - additional ideas, context, explanations, or related concepts in the SAME LANGUAGE as the original text
   - A brief summary (1-2 sentences)
4. Return a JSON array: [{ "title": "Note Title", "content": "## Original Text\n[original paragraph]\n\n---\n\n## Enrichment\n[your additions]", "summary": "Brief summary" }]
5. Aim for 2-5 atomic notes. Do not create more than 7.
6. Each atomic note should be focused on ONE concept or idea.
7. CRITICAL: Write your enrichment in the same language as the original text.
`;

                try {
                    const response = await this.service.generateContent(prompt);
                    const jsonMatch = response.match(/\[.*\]/s);

                    if (!jsonMatch) {
                        new Notice('Could not parse atomic notes from response.');
                        return;
                    }

                    const atomicNotes: AtomicNote[] = JSON.parse(jsonMatch[0]);

                    if (atomicNotes.length === 0) {
                        new Notice('No atomic concepts identified.');
                        return;
                    }

                    new AtomicNotesModal(this.app, atomicNotes, async (selected, createMOC) => {
                        try {
                            const createdFiles: string[] = [];

                            // Create each atomic note
                            for (const note of selected) {
                                const fileName = `${note.title}.md`;
                                const filePath = fileName;

                                // Check if file already exists
                                const existingFile = this.app.vault.getAbstractFileByPath(filePath);
                                if (existingFile) {
                                    new Notice(`File "${fileName}" already exists. Skipping.`);
                                    continue;
                                }

                                await this.app.vault.create(filePath, note.content);
                                createdFiles.push(note.title);
                            }

                            new Notice(`✅ Created ${createdFiles.length} atomic note(s).`);

                            // If MOC option is enabled, replace current note with MOC
                            if (createMOC && createdFiles.length > 0) {
                                const originalTitle = currentFile.basename;
                                const mocContent = `# MOC: ${originalTitle}

This note has been refactored into atomic concepts:

${createdFiles.map(title => `- [[${title}]]`).join('\n')}

---
*Generated by Gemini Assistant*
`;
                                await this.app.vault.modify(currentFile, mocContent);
                                new Notice('📋 Current note transformed into MOC.');
                            }

                        } catch (err) {
                            console.error(err);
                            new Notice('Error creating atomic notes: ' + err.message);
                        }
                    }).open();

                } catch (error) {
                    console.error(error);
                    new Notice('Error generating atomic notes.');
                }
            }
        });

        this.addCommand({
            id: 'gemini-graph-synthesis',
            name: 'Generate Graph Summary',
            editorCallback: async (editor: Editor, view: MarkdownView) => {
                const currentFile = view.file;
                if (!currentFile) {
                    new Notice('No active file.');
                    return;
                }

                new Notice('🕸️ Analyzing graph connections...');

                try {
                    // Read central note
                    const centralContent = await this.app.vault.cachedRead(currentFile);

                    // Get backlinks (notes pointing to this one)
                    // @ts-ignore - getBacklinksForFile is undocumented but functional
                    const backlinks = this.app.metadataCache.getBacklinksForFile?.(currentFile);
                    const backlinkFiles: TFile[] = [];
                    if (backlinks && backlinks.data) {
                        backlinks.data.forEach((_: any, key: string) => {
                            const file = this.app.vault.getAbstractFileByPath(key);
                            if (file instanceof TFile) {
                                backlinkFiles.push(file);
                            }
                        });
                    }

                    // Get outgoing links (notes this one points to)
                    const cache = this.app.metadataCache.getFileCache(currentFile);
                    const outgoingFiles: TFile[] = [];
                    if (cache && cache.links) {
                        cache.links.forEach(link => {
                            const linkedFile = this.app.metadataCache.getFirstLinkpathDest(link.link, currentFile.path);
                            if (linkedFile) {
                                outgoingFiles.push(linkedFile);
                            }
                        });
                    }

                    // Combine all connected notes
                    const allConnectedFiles = [...new Set([...backlinkFiles, ...outgoingFiles])];

                    if (allConnectedFiles.length === 0) {
                        new Notice('No connected notes found.');
                        return;
                    }

                    new Notice(`Found ${allConnectedFiles.length} connected note(s). Reading...`);

                    // Read content of connected notes (limit to avoid token overflow)
                    const maxNotes = 10;
                    const notesToRead = allConnectedFiles.slice(0, maxNotes);
                    let connectedContext = '';

                    for (const file of notesToRead) {
                        try {
                            const content = await this.app.vault.cachedRead(file);
                            const truncated = content.slice(0, 1000); // Limit per note
                            connectedContext += `\n--- Connected Note: ${file.basename} ---\n${truncated}\n`;
                        } catch (err) {
                            console.error(`Failed to read ${file.basename}`, err);
                        }
                    }

                    // Generate synthesis
                    const prompt = `
You are a knowledge synthesis expert.

CENTRAL NOTE: "${currentFile.basename}"
Content:
${centralContent}

CONNECTED NOTES (${notesToRead.length} notes linked to/from this central note):
${connectedContext}

TASK:
Generate a comprehensive synthesis that explains the global concept represented by this note and its network.
1. What is the central theme?
2. How do the connected notes relate to it?
3. What are the key insights from this knowledge cluster?
4. Are there any patterns or emergent ideas?

Write your synthesis in a clear, structured format using Markdown.
`;

                    const synthesis = await this.service.generateContent(prompt);

                    // Create synthesis note
                    const synthesisFileName = `Graph Synthesis - ${currentFile.basename}.md`;
                    const synthesisContent = `# Graph Synthesis: ${currentFile.basename}

**Generated:** ${new Date().toLocaleString()}
**Central Note:** [[${currentFile.basename}]]
**Connected Notes:** ${allConnectedFiles.length}

---

${synthesis}

---

## Connected Notes
${allConnectedFiles.map(f => `- [[${f.basename}]]`).join('\n')}
`;

                    await this.app.vault.create(synthesisFileName, synthesisContent);
                    new Notice(`✅ Graph synthesis created: ${synthesisFileName}`);

                    // Open the synthesis
                    const synthesisFile = this.app.vault.getAbstractFileByPath(synthesisFileName);
                    if (synthesisFile instanceof TFile) {
                        this.app.workspace.getLeaf().openFile(synthesisFile);
                    }

                } catch (error) {
                    console.error(error);
                    new Notice('Error generating graph synthesis.');
                }
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new GeminiSettingsTab(this.app, this));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        // Update service with new key
        if (this.service) {
            this.service.updateApiKey(this.settings.apiKey);
        }
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_GEMINI);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_GEMINI, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }
}
