import { App, PluginSettingTab, Setting } from 'obsidian';
import GeminiPlugin from '../core/main';

export class GeminiSettingsTab extends PluginSettingTab {
    plugin: GeminiPlugin;

    constructor(app: App, plugin: GeminiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Settings for Gemini Assistant' });

        new Setting(containerEl)
            .setName('Gemini API Key')
            .setDesc('Enter your Google Gemini API Key')
            .addText(text => text
                .setPlaceholder('Enter your secret')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    console.log('Secret: ' + value);
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('System Prompt')
            .setDesc('Customize the behavior and persona of the AI.')
            .addTextArea(text => text
                .setPlaceholder('Enter system prompt...')
                .setValue(this.plugin.settings.systemPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.systemPrompt = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Note Template')
            .setDesc('Template for "Save as Note". Use {{CONTENT}} for the AI response and {{DATE}} for current date.')
            .addTextArea(text => text
                .setPlaceholder('Enter note template...')
                .setValue(this.plugin.settings.noteTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.noteTemplate = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Autocomplete (Ghost Text)' });

        new Setting(containerEl)
            .setName('Enable Autocomplete')
            .setDesc('Show AI-powered suggestions as you type (like Copilot).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableAutocomplete)
                .onChange(async (value) => {
                    this.plugin.settings.enableAutocomplete = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Autocomplete Delay (ms)')
            .setDesc('Wait time before requesting suggestion (default: 600ms).')
            .addSlider(slider => slider
                .setLimits(300, 2000, 100)
                .setValue(this.plugin.settings.autocompleteDelay)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.autocompleteDelay = value;
                    await this.plugin.saveSettings();
                }));
    }
}
