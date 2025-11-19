import { App, Modal, Setting, Notice } from 'obsidian';

export interface LinkSuggestion {
    originalText: string; // The text in the paragraph to replace (e.g., "popcorn")
    noteTitle: string;    // The note to link to (e.g., "Popcorn Recipe")
    context: string;      // Brief context or reason (optional)
}

export class LinkSuggestionModal extends Modal {
    suggestions: LinkSuggestion[];
    selectedSuggestions: Set<number>; // Indices of selected suggestions
    onSubmit: (selected: LinkSuggestion[]) => void;

    constructor(app: App, suggestions: LinkSuggestion[], onSubmit: (selected: LinkSuggestion[]) => void) {
        super(app);
        this.suggestions = suggestions;
        this.onSubmit = onSubmit;
        this.selectedSuggestions = new Set(suggestions.map((_, i) => i)); // Select all by default
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Gemini Link Suggestions' });

        if (this.suggestions.length === 0) {
            contentEl.createEl('p', { text: 'No relevant links found.' });
            return;
        }

        contentEl.createEl('p', { text: 'Select the links you want to apply:' });

        this.suggestions.forEach((suggestion, index) => {
            new Setting(contentEl)
                .setName(`Link "${suggestion.originalText}" to [[${suggestion.noteTitle}]]`)
                .setDesc(suggestion.context || '')
                .addToggle(toggle => toggle
                    .setValue(true)
                    .onChange(value => {
                        if (value) {
                            this.selectedSuggestions.add(index);
                        } else {
                            this.selectedSuggestions.delete(index);
                        }
                    }));
        });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Apply Selected Links')
                .setCta()
                .onClick(() => {
                    const selected = this.suggestions.filter((_, i) => this.selectedSuggestions.has(i));
                    this.close();
                    this.onSubmit(selected);
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
