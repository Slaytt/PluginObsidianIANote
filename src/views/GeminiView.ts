import { ItemView, WorkspaceLeaf, Notice, MarkdownView, MarkdownRenderer, Component } from 'obsidian';
import GeminiPlugin from '../core/main';
import { GeminiService } from '../services/GeminiService';

export const VIEW_TYPE_GEMINI = 'gemini-view';

export class GeminiView extends ItemView {
    private service: GeminiService;
    private plugin: GeminiPlugin;

    constructor(leaf: WorkspaceLeaf, service: GeminiService, plugin: GeminiPlugin) {
        super(leaf);
        this.service = service;
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_GEMINI;
    }

    getDisplayText() {
        return 'Gemini Assistant';
    }

    getIcon() {
        return 'bot';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('gemini-view-container');

        const messageContainer = container.createDiv({ cls: 'gemini-messages' });

        const inputContainer = container.createDiv({ cls: 'gemini-input-area' });

        // Options container
        const optionsContainer = container.createDiv({ cls: 'gemini-options' });
        optionsContainer.style.marginBottom = '5px';
        optionsContainer.style.fontSize = '0.8em';
        optionsContainer.style.color = 'var(--text-muted)';

        const contextLabel = optionsContainer.createEl('label');
        contextLabel.style.display = 'flex';
        contextLabel.style.alignItems = 'center';
        contextLabel.style.gap = '5px';

        const contextCheckbox = contextLabel.createEl('input', { type: 'checkbox' });
        contextLabel.appendText('Include active note context');

        const inputEl = inputContainer.createEl('textarea', {
            attr: { placeholder: 'Ask Gemini...', rows: '1' }
        });

        // Auto-resize textarea
        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto';
            inputEl.style.height = inputEl.scrollHeight + 'px';
        });

        const sendBtn = inputContainer.createEl('button', { text: 'Send' });

        const sendMessage = async () => {
            const prompt = inputEl.value;
            if (!prompt.trim()) return;

            // Add user message
            this.addMessage(messageContainer, 'User', prompt);
            inputEl.value = '';

            let finalPrompt = prompt;

            // === CONTEXT TARGETING (@Mentions) ===
            // Parse mentions: @NoteActuelle, @Dossier/Path, @Tag:#tagname
            const mentionRegex = /@(\w+)(?:\/([^\s]+)|:(#\w+))?/g;
            const mentions: { type: string; path?: string; tag?: string }[] = [];
            let match;
            let cleanedPrompt = prompt;

            while ((match = mentionRegex.exec(prompt)) !== null) {
                const type = match[1]; // NoteActuelle, Dossier, Tag
                const path = match[2]; // For @Dossier/Path
                const tag = match[3]; // For @Tag:#tagname
                mentions.push({ type, path, tag });
                // Remove mention from prompt for cleaner AI query
                cleanedPrompt = cleanedPrompt.replace(match[0], '').trim();
            }

            // Filter files based on mentions
            let allFiles = this.app.vault.getMarkdownFiles();
            let scopeDescription = "entire vault";

            if (mentions.length > 0) {
                const mention = mentions[0]; // Handle first mention for now

                if (mention.type === 'NoteActuelle' || mention.type === 'CurrentNote') {
                    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (activeView && activeView.file) {
                        allFiles = [activeView.file];
                        scopeDescription = `current note (${activeView.file.basename})`;
                    }
                } else if (mention.type === 'Dossier' || mention.type === 'Folder') {
                    if (mention.path) {
                        allFiles = allFiles.filter(file => file.path.startsWith(mention.path));
                        scopeDescription = `folder "${mention.path}"`;
                    }
                } else if (mention.type === 'Tag') {
                    if (mention.tag) {
                        // Filter by tag using metadata cache
                        allFiles = allFiles.filter(file => {
                            const cache = this.app.metadataCache.getFileCache(file);
                            if (!cache || !cache.tags) return false;
                            return cache.tags.some(t => t.tag === mention.tag);
                        });
                        scopeDescription = `notes with tag ${mention.tag}`;
                    }
                }

                new Notice(`🎯 Searching in: ${scopeDescription}`);
            }

            const noteTitles = allFiles.map(file => file.basename);

            // MOC Detection
            const mocTitles = noteTitles.filter(title => title.startsWith("MOC_"));
            console.log(`Smart Linking: Found ${noteTitles.length} notes and ${mocTitles.length} MOCs in scope: ${scopeDescription}.`);

            // Smart Retrieval (2-Pass RAG)
            let relevantNotesContext = "";

            // Use cleaned prompt (without @mentions) for retrieval
            const retrievalQuery = cleanedPrompt || prompt;

            // Only perform retrieval if prompt is long enough (> 5 chars) to avoid noise on "hi", "test"
            if (prompt.length > 5) {
                // Step 1: Ask Gemini to identify relevant notes based on semantics
                const retrievalPrompt = `
You are a retrieval assistant for a personal knowledge base.
USER QUERY: "${retrievalQuery}"

LIST OF ALL NOTE TITLES:
${JSON.stringify(noteTitles)}

TASK:
1. Analyze the user's query.
2. Scan the list of titles to find notes that are SEMANTICALLY RELEVANT to the query.
3. Select up to 3 titles that might contain the answer.
4. **PRIORITY**: Look for SPECIFIC notes that likely contain the content (e.g., "Popcorn Recipe") rather than broad categories or MOCs (e.g., "MOC_Cuisine") unless the specific note is missing.
5. CRITICAL: You MUST return ONLY titles that EXACTLY match entries in the provided list. Do not invent titles.
6. Return ONLY a JSON array of strings. Example: ["Note A", "Note B"]
7. If no notes are relevant, return [].
`;

                let targetNotes: string[] = [];
                try {
                    // Show a temporary status
                    const loadingDiv = messageContainer.createDiv({ cls: 'gemini-loading' });
                    loadingDiv.createSpan({ text: '🔍 Searching your vault...' });
                    messageContainer.scrollTop = messageContainer.scrollHeight;

                    const retrievalResponse = await this.service.generateContent(retrievalPrompt);
                    loadingDiv.remove();

                    // Clean up response to ensure valid JSON
                    const jsonMatch = retrievalResponse.match(/\[.*\]/s);
                    if (jsonMatch) {
                        const rawNotes = JSON.parse(jsonMatch[0]);
                        // STRICT VALIDATION: Filter out hallucinations
                        targetNotes = rawNotes.filter((t: string) => noteTitles.includes(t));
                        console.log("Smart Retrieval (Raw):", rawNotes);
                        console.log("Smart Retrieval (Validated):", targetNotes);
                    }
                } catch (err) {
                    console.error("Smart Retrieval failed:", err);
                }

                // Fallback: Keyword Scoring if AI returns nothing
                if (targetNotes.length === 0) {
                    console.log("Smart Retrieval yielded no results. Trying Keyword Scoring...");
                    const keywords = prompt.split(' ').filter(w => w.length > 3).map(w => w.toLowerCase());

                    if (keywords.length > 0) {
                        // Score each note based on keyword matches in title
                        const scoredNotes = noteTitles.map(title => {
                            const titleLower = title.toLowerCase();
                            let score = 0;
                            keywords.forEach(k => {
                                if (titleLower.includes(k)) score++;
                                if (titleLower === k) score += 2; // Exact match bonus
                            });
                            return { title, score };
                        });

                        // Keep top 3 notes with score > 0
                        targetNotes = scoredNotes
                            .filter(n => n.score > 0)
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3)
                            .map(n => n.title);
                    }
                }

                // Step 2: Read content of identified notes
                if (targetNotes.length > 0) {
                    const relevantFiles = allFiles.filter(file => targetNotes.includes(file.basename));
                    if (relevantFiles.length > 0) {
                        relevantNotesContext = "\nRELEVANT NOTES CONTENT (Found by Smart Retrieval):\n";
                        for (const file of relevantFiles) {
                            try {
                                const content = await this.app.vault.cachedRead(file);
                                const truncatedContent = content.slice(0, 1500);
                                relevantNotesContext += `--- Note: ${file.basename} ---\n${truncatedContent}\n...\n`;
                            } catch (err) {
                                console.error(`Failed to read note ${file.basename}`, err);
                            }
                        }
                        new Notice(`🧠 Read ${relevantFiles.length} notes for context.`);
                        // Inform user about the context found
                        this.addMessage(messageContainer, 'System', `📚 Context found in: **[[${relevantFiles.map(f => f.basename).join(']], [[')}]]**`);
                    }
                }
            }

            // Debug notice for user
            new Notice(`Smart Linking: ${noteTitles.length} notes indexed.`);

            let activeContext = "";
            if (contextCheckbox.checked) {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    const noteContent = activeView.getViewData();
                    const noteTitle = activeView.file?.basename || 'Current Note';
                    activeContext = `\nCONTEXT FROM ACTIVE NOTE "${noteTitle}":\n${noteContent}\n`;
                    new Notice(`Included context from "${noteTitle}"`);
                }
            }

            finalPrompt = `
${this.plugin.settings.systemPrompt}

USER REQUEST:
"${prompt}"

${activeContext}

${relevantNotesContext}

---
TASK:
1. Answer the user's request above clearly and concisely.
2. **SMART LINKING (CRITICAL)**:
   - I have provided a list of ALL existing notes in this vault below (JSON).
   - **GOAL**: Connect this new note to EXISTING knowledge.
   - **INLINE LINKS**: Only create inline links [[Title]] if a term in your text EXACTLY matches a note title. DO NOT link common words (like "fait", "le", "test") even if they exist as notes.
   - **RELATED NOTES SECTION**: At the very end of your response, add a section called "### Notes Liées :" and list **UP TO 5** existing notes from the provided list.
     - **QUALITY OVER QUANTITY**: Only include notes that have a **STRONG** semantic connection (Relevance Score > 8/10).
     - If only 1 or 2 notes are relevant, ONLY list those. Do NOT force 5 links if they are not relevant.
     - **MOC PRIORITY**: You MUST check the "LIST OF MOCs" below. Identify the ONE most relevant Map of Content (MOC) for this note and link it first.
     - **CRITICAL**: Look for PARENT CONCEPTS or CATEGORIES.
     - Example: If you write about "Popcorn" and the list contains "Cuisine" or "Corn", YOU MUST LINK THEM in this section: [[Cuisine]], [[Corn]].

LIST OF MOCs (Map of Content):
${JSON.stringify(mocTitles)}

LIST OF ALL EXISTING NOTES (JSON):
${JSON.stringify(noteTitles)}
`;

            console.log("Final Prompt sent to Gemini:", finalPrompt);

            // Show loading indicator
            const loadingDiv = messageContainer.createDiv({ cls: 'gemini-loading' });
            const spinner = loadingDiv.createDiv({ cls: 'gemini-spinner' });
            loadingDiv.createSpan({ text: 'Gemini is thinking...' });
            messageContainer.scrollTop = messageContainer.scrollHeight;

            try {
                const response = await this.service.generateContent(finalPrompt);
                loadingDiv.remove(); // Remove loading
                this.addMessage(messageContainer, 'Gemini', response);
            } catch (error) {
                loadingDiv.remove(); // Remove loading
                new Notice('Error communicating with Gemini. Check console/settings.');
                this.addMessage(messageContainer, 'System', 'Error: ' + error.message);
            }
        };

        sendBtn.addEventListener('click', sendMessage);

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    private async addMessage(container: HTMLElement, sender: string, text: string) {
        const msgDiv = container.createDiv({ cls: 'gemini-message' });

        // Add specific class based on sender
        if (sender === 'User') {
            msgDiv.addClass('is-user');
        } else if (sender === 'Gemini') {
            msgDiv.addClass('is-bot');
        } else {
            msgDiv.addClass('is-system');
        }

        const header = msgDiv.createDiv({ cls: 'message-header' });
        header.createEl('strong', { text: sender });

        const content = msgDiv.createDiv({ cls: 'message-content' });

        // Create a Component for markdown rendering to handle internal link clicks
        const component = new Component();
        component.load();

        // Use MarkdownRenderer with the component to enable clickable links
        const sourcePath = '/';
        if (sender !== 'System') {
            await MarkdownRenderer.render(this.app, text, content, sourcePath, component);
        } else {
            await MarkdownRenderer.render(this.app, text, content, sourcePath, component);
        }

        // Add component as a child so it gets cleaned up when the view closes
        this.addChild(component);

        if (sender === 'Gemini') {
            const actions = msgDiv.createDiv({ cls: 'message-actions' });
            const saveBtn = actions.createEl('button', { text: 'Save as Note', cls: 'mod-cta' });
            saveBtn.addEventListener('click', async () => {
                try {
                    const fileName = `Gemini Note ${Date.now()}.md`;
                    const dateStr = new Date().toLocaleString();

                    // User Template
                    let template = this.plugin.settings.noteTemplate;
                    template = template.replace('{{DATE}}', dateStr);
                    template = template.replace('{{CONTENT}}', text);

                    await this.app.vault.create(fileName, template);
                    new Notice(`Saved as ${fileName}`);
                    // Open the new file
                    const file = this.app.vault.getAbstractFileByPath(fileName);
                    if (file) {
                        this.app.workspace.getLeaf().openFile(file as any);
                    }
                } catch (err) {
                    new Notice('Error saving note: ' + err.message);
                    console.error(err);
                }
            });
        }

        msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    async onClose() {
        // Nothing to clean up.
    }
}
