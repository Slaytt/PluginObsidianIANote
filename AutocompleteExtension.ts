import { Extension, StateField, StateEffect, EditorState } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin, WidgetType, keymap } from '@codemirror/view';
import { GeminiService } from './GeminiService';

// State effect to set a suggestion
const setSuggestionEffect = StateEffect.define<{ text: string; from: number } | null>();

// Widget to display ghost text
class GhostTextWidget extends WidgetType {
    constructor(readonly text: string) {
        super();
    }

    toDOM() {
        const span = document.createElement('span');
        span.textContent = this.text;
        span.style.color = 'var(--text-faint)';
        span.style.opacity = '0.5';
        span.style.pointerEvents = 'none';
        return span;
    }
}

// State field to store the current suggestion TEXT (for Tab acceptance)
const suggestionTextField = StateField.define<{ text: string; from: number } | null>({
    create() {
        return null;
    },
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(setSuggestionEffect)) {
                return effect.value;
            }
        }
        return value;
    }
});

// State field to store the decoration
const suggestionField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(decorations, tr) {
        decorations = decorations.map(tr.changes);

        for (let effect of tr.effects) {
            if (effect.is(setSuggestionEffect)) {
                if (effect.value === null) {
                    decorations = Decoration.none;
                } else {
                    const widget = Decoration.widget({
                        widget: new GhostTextWidget(effect.value.text),
                        side: 1
                    });
                    decorations = Decoration.set([widget.range(effect.value.from)]);
                }
            }
        }

        return decorations;
    },
    provide: f => EditorView.decorations.from(f)
});

// Debounce utility
function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout | null = null;
    return function (...args: any[]) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// View plugin to handle autocomplete logic
export function createAutocompleteExtension(
    service: GeminiService,
    enabled: () => boolean,
    delay: () => number
): Extension {

    let abortController: AbortController | null = null;
    let lastRequestPos: number = -1;

    const autocompletePlugin = ViewPlugin.fromClass(class {
        view: EditorView;
        scheduleRequest: Function;

        constructor(view: EditorView) {
            this.view = view;
            this.scheduleRequest = debounce(this.requestCompletion.bind(this), delay());
        }

        update(update: ViewUpdate) {
            if (!enabled()) return;

            // Only trigger on document changes
            if (update.docChanged) {
                // Cancel any pending request
                if (abortController) {
                    abortController.abort();
                    abortController = null;
                }

                // The suggestion will be cleared automatically by the state field's map()
                // when the document changes, so we don't need to dispatch here

                // Schedule new request
                const cursorPos = update.state.selection.main.head;
                this.scheduleRequest(cursorPos);
            }
        }

        async requestCompletion(cursorPos: number) {
            if (!enabled()) return;

            const state = this.view.state;
            const doc = state.doc;

            // Get text before and after cursor
            const textBefore = doc.sliceString(0, cursorPos);
            const textAfter = doc.sliceString(cursorPos);

            // Limit context to avoid token overflow
            const maxBefore = 2000;
            const maxAfter = 500;
            const limitedBefore = textBefore.slice(-maxBefore);
            const limitedAfter = textAfter.slice(0, maxAfter);

            // Don't request if text is too short
            if (limitedBefore.trim().length < 10) return;

            const prompt = `You are an autocomplete assistant for note-taking.
Complete the text at the cursor position <CURSOR>.

RULES:
1. Return ONLY the completion text (what comes after the cursor).
2. Do NOT repeat existing text.
3. Be concise and contextually relevant (max 1-2 sentences).
4. Match the language and tone of the surrounding text.
5. If the text after cursor already continues the thought, return nothing.

TEXT BEFORE CURSOR:
${limitedBefore}

<CURSOR>

TEXT AFTER CURSOR:
${limitedAfter}

COMPLETION:`;

            try {
                abortController = new AbortController();
                lastRequestPos = cursorPos;

                const suggestion = await service.generateContent(prompt);

                // Check if cursor has moved since request
                const currentPos = this.view.state.selection.main.head;
                if (currentPos !== lastRequestPos) {
                    return; // Ignore stale response
                }

                // Clean up suggestion
                const cleanSuggestion = suggestion
                    .trim()
                    .split('\n')[0] // Take only first line
                    .slice(0, 200); // Limit length

                if (cleanSuggestion.length > 0) {
                    this.view.dispatch({
                        effects: setSuggestionEffect.of({
                            text: cleanSuggestion,
                            from: cursorPos
                        })
                    });
                }

            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Autocomplete error:', error);
                }
            }
        }

        destroy() {
            if (abortController) {
                abortController.abort();
            }
        }
    });

    // Keymap to accept suggestion with Tab
    const acceptKeybinding = keymap.of([
        {
            key: 'Tab',
            run: (view: EditorView) => {
                const suggestion = view.state.field(suggestionTextField);
                if (!suggestion) return false;

                const cursorPos = view.state.selection.main.head;

                // Insert the suggestion
                view.dispatch({
                    changes: { from: cursorPos, insert: suggestion.text },
                    effects: setSuggestionEffect.of(null)
                });

                return true; // Prevent default Tab behavior
            }
        }
    ]);

    return [suggestionTextField, suggestionField, autocompletePlugin, acceptKeybinding];
}
