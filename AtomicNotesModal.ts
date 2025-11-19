import { App, Modal, Setting, Notice } from 'obsidian';

export interface AtomicNote {
    title: string;
    content: string;
    summary: string;
}

export class AtomicNotesModal extends Modal {
    notes: AtomicNote[];
    selectedNotes: Set<number>;
    onSubmit: (selected: AtomicNote[], createMOC: boolean) => void;
    createMOC: boolean;

    constructor(app: App, notes: AtomicNote[], onSubmit: (selected: AtomicNote[], createMOC: boolean) => void) {
        super(app);
        this.notes = notes;
        this.onSubmit = onSubmit;
        this.selectedNotes = new Set(notes.map((_, i) => i)); // Select all by default
        this.createMOC = true; // MOC creation enabled by default
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Atomic Notes Preview' });

        if (this.notes.length === 0) {
            contentEl.createEl('p', { text: 'No atomic notes could be generated.' });
            return;
        }

        contentEl.createEl('p', {
            text: `Gemini has identified ${this.notes.length} atomic concept(s). Select the notes you want to create:`
        });

        // Display each note with a preview
        this.notes.forEach((note, index) => {
            const notePreview = contentEl.createDiv({ cls: 'atomic-note-preview' });
            notePreview.style.marginBottom = '15px';
            notePreview.style.padding = '10px';
            notePreview.style.border = '1px solid var(--background-modifier-border)';
            notePreview.style.borderRadius = '5px';

            new Setting(notePreview)
                .setName(`📄 ${note.title}`)
                .setDesc(note.summary)
                .addToggle(toggle => toggle
                    .setValue(true)
                    .onChange(value => {
                        if (value) {
                            this.selectedNotes.add(index);
                        } else {
                            this.selectedNotes.delete(index);
                        }
                    }));

            // Show content preview (first 200 chars)
            const contentPreview = notePreview.createDiv({ cls: 'content-preview' });
            contentPreview.style.fontSize = '0.85em';
            contentPreview.style.color = 'var(--text-muted)';
            contentPreview.style.marginTop = '5px';
            contentPreview.style.fontStyle = 'italic';
            const truncatedContent = note.content.slice(0, 200) + (note.content.length > 200 ? '...' : '');
            contentPreview.setText(truncatedContent);
        });

        // Option to create MOC
        new Setting(contentEl)
            .setName('Create MOC (Map of Content)')
            .setDesc('Replace the current note with a MOC linking to all created atomic notes.')
            .addToggle(toggle => toggle
                .setValue(true)
                .onChange(value => {
                    this.createMOC = value;
                }));

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Create Selected Notes')
                .setCta()
                .onClick(() => {
                    const selected = this.notes.filter((_, i) => this.selectedNotes.has(i));
                    if (selected.length === 0) {
                        new Notice('No notes selected.');
                        return;
                    }
                    this.close();
                    this.onSubmit(selected, this.createMOC);
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
