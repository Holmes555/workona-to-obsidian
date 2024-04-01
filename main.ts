import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const Handlebars = require('handlebars');

const WORKONA_USER = 'User';
const WORKONA_WORKSPACES = 'Workspaces';
const WORKONA_ARCHIVED_WORKSPACES = 'Archived Workspaces';
const WORKONA_MY_TASKS = 'My Tasks';

const WORKONA_TITLE = 'title';
const WORKONA_TABS = 'tabs';
const WORKONA_RESOURCES = 'resources';
const WORKONA_NOTES = 'notes';
const WORKONA_TASKS = 'tasks';

const WORKONA_DESCRIPTION = 'description';
const WORKONA_URL = 'url';

const SET_FOLDER_NAME = 'folderName';
const SET_OVERWRITE = 'overwrite';

interface WorkonaToObsidianSettings {
	[SET_FOLDER_NAME]: string;
	[SET_OVERWRITE]: boolean;
}

const DEFAULT_SETTINGS: WorkonaToObsidianSettings = {
	[SET_FOLDER_NAME]: 'Workona',
	[SET_OVERWRITE]: true,
};

export default class WorkonaToObsidian extends Plugin {
	settings: WorkonaToObsidianSettings;

	async onload() {
		await this.loadSettings();
		// This adds a settings tab so the user can configure various aspects of the plugin
		const settingTab = new WorkonaToObsidianSettingTab(this.app, this);
		settingTab.setHandler(this, this.generateNotes);
		settingTab.setDefaults(this.settings[SET_FOLDER_NAME], this.settings[SET_OVERWRITE]);
		settingTab.display();
		this.addSettingTab(settingTab);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	validFilename(name: string) {
		const regexp = /[`~|!@#$%^&*\=?;:'"<>\{\}\[\]\\\/]/gi;
		return name.replace(regexp, '_');
	}

	/**
	 * Check if the path for filename exists, if it doesn't then create it
	 * @param filename
	 */
	async createFolder(path: string) {
		// Vault::exists() does exist, it just isn't defined in obsidian.d.ts
		let exists = await this.app.vault.exists(path);
		// createFolder will create intervening paths too
		if (!exists) {
			console.log(`Creating folder for ${path}`);
			await this.app.vault.createFolder(path).catch((err) => console.log(`app.vault.checkPath: ${err}`));
		}
	}

	async getResourceTemplateText() {
		return `---
date created: {{date}}
date modified: {{date}}
tags: Workona, {{workspaceSectionTitleTag}}, {{workspaceSubSectionTitleTag}}, {{resourceSectionTitleTag}}
---

# {{title}}

Source url: {{url}}

Description: {{description}}
`;
	}

	async getTabTemplateText() {
		return `---
date created: {{date}}
date modified: {{date}}
tags: Workona, {{workspaceSectionTitleTag}}, {{workspaceSubSectionTitleTag}}
---

# {{title}}

Source url: {{url}}
`;
	}

	async generateNotes(
		objdata: Object,
		objdataOld: Object,
		isResource: boolean,
		templateResourceFile: File,
		isTab: boolean,
		templateTabFile: File,
		destFolder: string,
		overwrite: boolean,
	) {
		console.log(`generateNotes('${destFolder}', ovewrite='${overwrite}')`);

		// Save current settings
		this.settings[SET_FOLDER_NAME] = destFolder;
		this.settings[SET_OVERWRITE] = overwrite;
		this.saveSettings();

		// Workspaces section
		const workspacesPath = destFolder + '/' + WORKONA_WORKSPACES;
		await this.createFolder(workspacesPath);

		let templateResourceText = await this.getResourceTemplateText();
		if (templateResourceFile) {
			templateResourceText = await templateResourceFile.text();
		}
		var templateResource = Handlebars.compile(templateResourceText);

		let templateTabText = await this.getTabTemplateText();
		if (templateTabFile) {
			templateTabText = await templateTabFile.text();
		}
		var templateTab = Handlebars.compile(templateTabText);

		let workspaceSectionOldBase = objdataOld[WORKONA_WORKSPACES as keyof Object] ?? {};
		for (let [key, workspaceSection] of Object.entries(objdata[WORKONA_WORKSPACES as keyof Object])) {
			let workspaceSectionOld = workspaceSectionOldBase[key as keyof Object] ?? {};
			const workspaceSectionTitle = workspaceSection[WORKONA_TITLE as keyof Object];
			const workspaceSectionPath = workspacesPath + '/' + workspaceSectionTitle;
			await this.createFolder(workspaceSectionPath);

			let workspaceSubSectionOldBase = workspaceSectionOld[WORKONA_WORKSPACES.toLowerCase() as keyof Object] ?? {};
			for (let [key, workspaceSubSection] of Object.entries(
				workspaceSection[WORKONA_WORKSPACES.toLowerCase() as keyof Object],
			)) {
				let workspaceSubSectionOld = workspaceSubSectionOldBase[key as keyof Object] ?? {};
				const workspaceSubSectionTitle = workspaceSubSection[WORKONA_TITLE as keyof Object];
				const workspaceSubSectionPath = workspaceSectionPath + '/' + workspaceSubSectionTitle;
				await this.createFolder(workspaceSubSectionPath);

				if (isResource) {
					const resourcesFolder = WORKONA_RESOURCES.charAt(0).toUpperCase() + WORKONA_RESOURCES.slice(1);
					const resourcesPath = workspaceSubSectionPath + '/' + resourcesFolder;
					await this.createFolder(resourcesPath);
					let resourcesSectionOldBase = workspaceSubSectionOld[WORKONA_RESOURCES as keyof Object] ?? {};
					for (let [key, resourcesSection] of Object.entries(workspaceSubSection[WORKONA_RESOURCES as keyof Object])) {
						let resourcesSectionOld = resourcesSectionOldBase[key as keyof Object] ?? {};
						const resourceSectionTitle = resourcesSection[WORKONA_TITLE as keyof Object];

						let resourceOldBase = resourcesSectionOld[WORKONA_RESOURCES as keyof Object] ?? {};
						for (let [key, resource] of Object.entries(resourcesSection[WORKONA_RESOURCES as keyof Object])) {
							let resourceOld = resourceOldBase[key as keyof Object] ?? {};
							const title = resource[WORKONA_TITLE as keyof Object];
							const filename = resourcesPath + '/' + this.validFilename(title) + '.md';

							const description = resource[WORKONA_DESCRIPTION as keyof Object];
							const url = resource[WORKONA_URL as keyof Object];
							const urlOld = resourceOld[WORKONA_URL as keyof Object] ?? null;

							if (url === urlOld) {
								console.log(`Url: ${url}.\n Old url: ${urlOld}`);
								continue;
							}

							let body = templateResource({
								title: title,
								date: new Date().toLocaleTimeString('en-us', {
									weekday: 'long',
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									hour12: false,
								}),
								workspaceSectionTitleTag: workspaceSectionTitle.replace(' ', ''),
								workspaceSubSectionTitleTag: workspaceSubSectionTitle.replace(' ', ''),
								resourceSectionTitleTag: resourceSectionTitle.replace(' ', ''),
								url: url,
								description: description ?? 'Not provided',
							});

							await this.writeFile(body, filename, overwrite);
						}
					}
				}

				if (isTab) {
					const tabFolder = WORKONA_TABS.charAt(0).toUpperCase() + WORKONA_TABS.slice(1);
					const tabPath = workspaceSubSectionPath + '/' + tabFolder;
					await this.createFolder(tabPath);
					let tabOldBase = workspaceSubSectionOld[WORKONA_TABS as keyof Object] ?? {};
					for (let [key, tab] of Object.entries(workspaceSubSection[WORKONA_TABS as keyof Object])) {
						let tabOld = tabOldBase[key as keyof Object] ?? {};
						const title = tab[WORKONA_TITLE as keyof Object];
						const filename = tabPath + '/' + this.validFilename(title) + '.md';

						const url = tab[WORKONA_URL as keyof Object];
						const urlOld = tabOld[WORKONA_URL as keyof Object] ?? null;

						if (url === urlOld) {
							console.log(`Url: ${url}.\n Old url: ${urlOld}`);
							continue;
						}

						let body = templateTab({
							title: title,
							date: new Date().toLocaleTimeString('en-us', {
								weekday: 'long',
								year: 'numeric',
								month: 'short',
								day: 'numeric',
								hour12: false,
							}),
							workspaceSectionTitleTag: workspaceSectionTitle.replace(' ', ''),
							workspaceSubSectionTitleTag: workspaceSubSectionTitle.replace(' ', ''),
							url: url,
						});

						await this.writeFile(body, filename, overwrite);
					}
				}
			}
		}
	}

	async writeFile(body: string, filename: string, overwrite: boolean) {
		// Delete the old version, if it exists
		let exist = this.app.vault.getAbstractFileByPath(filename);
		if (exist) {
			if (!overwrite) {
				new Notice(`Note already exists for '${filename}' - ignoring entry in data file`);
				return;
			}
			await this.app.vault.delete(exist).catch((err) => console.log(`app.vault.delete: ${err}`));
		}
		await this.app.vault
			.create(filename, body)
			.catch((err) => console.log(`Filename: ${filename}.\n app.vault.create: ${err}`));
	}
}

class WorkonaToObsidianSettingTab extends PluginSettingTab {
	caller: Object;
	handler: Function;
	default_foldername: string;
	default_resources: boolean = true;
	default_tabs: boolean = false;
	default_overwrite: boolean = true;
	plugin: WorkonaToObsidian;

	constructor(app: App, plugin: WorkonaToObsidian) {
		super(app, plugin);
		this.plugin = plugin;
	}

	setHandler(caller: Object, handler: Function): void {
		this.caller = caller;
		this.handler = handler;
	}

	setDefaults(foldername: string, overwrite: boolean) {
		this.default_foldername = foldername;
		this.default_overwrite = overwrite;
	}

	setCheckboxTemplate(containerEl: HTMLElement, item: string, isChecked: boolean = false) {
		const checkboxSetting = new Setting(containerEl)
			.setName(`Import ${item}`)
			.setDesc(`When ticked, will import ${item} section`);
		const inputField = checkboxSetting.controlEl.createEl('input', {attr: { type: 'checkbox'}});
		inputField.checked = isChecked;
		return inputField;
	}

	setTemplateFile(containerEl: HTMLElement, item: string, isChecked: boolean = false) {
		const templateSetting = new Setting(containerEl)
			.setName(`Choose template ${item} Markdown file`)
			.setDesc(`Choose template (Handlebars) Markdown file for ${item} section`);
		const inputTemplateFile = templateSetting.controlEl.createEl('input', {
			attr: {
				type: 'file',
				multiple: false,
				accept: '.md',
			},
		});
		if (!isChecked){
			templateSetting.settingEl.style.display = 'none';
		}
		return [templateSetting, inputTemplateFile];
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for WorkonaToObsidian plugin.' });

		const jsonSetting = new Setting(containerEl)
			.setName('Choose generated Workona JSON file')
			.setDesc('Choose generated Workona JSON file to import, or paste text into the text box');
		const inputJsonFile = jsonSetting.controlEl.createEl('input', {
			attr: {
				type: 'file',
				multiple: true,
				accept: '.json',
			},
		});
		const inputJsonText = jsonSetting.controlEl.createEl('textarea', {
			attr: {
				rows: '5',
				columns: '20',
			},
		});

		const jsonOldSetting = new Setting(containerEl)
			.setName('Choose previously generated Workona JSON file')
			.setDesc(
				'Choose previously generated Workona JSON file to import, or paste text into the text box. Use it to not override or duplicate resources.',
			);
		const inputOldJsonFile = jsonOldSetting.controlEl.createEl('input', {
			attr: {
				type: 'file',
				multiple: false,
				accept: '.json',
			},
		});
		const inputOldJsonText = jsonOldSetting.controlEl.createEl('textarea', {
			attr: {
				rows: '5',
				columns: '20',
			},
		});

		const inputResourceField = this.setCheckboxTemplate(containerEl, 'Resources', this.default_resources);
		const [ templateResourceSettings, inputTemplateResourceFile ] = this.setTemplateFile(containerEl, 'Resources', this.default_resources);

		// Event listener for when the checkbox changes
		inputResourceField.addEventListener('change', (e) => {
			// If the checkbox is checked, show upload elements
			if (e.target.checked) {
				templateResourceSettings.settingEl.style.display = '';
			} else {
				templateResourceSettings.settingEl.style.display = 'none';
			}
		});

		const inputTabField = this.setCheckboxTemplate(containerEl, 'Tabs', this.default_tabs);
		const [ templateTabSettings, inputTemplateTabFile ] = this.setTemplateFile(containerEl, 'Tabs', this.default_tabs);

		// Event listener for when the checkbox changes
		inputTabField.addEventListener('change', (e) => {
			// If the checkbox is checked, show upload elements
			if (e.target.checked) {
				templateTabSettings.settingEl.style.display = '';
			} else {
				templateTabSettings.settingEl.style.display = 'none';
			}
		});

		const overwriteSetting = new Setting(containerEl)
			.setName('Overwrite existing Notes')
			.setDesc(
				'When ticked, existing Notes with a matching name will be overwritten by entries in the supplied JSON file. Otherwise will be ignored',
			);
		const inputOverwriteField = overwriteSetting.controlEl.createEl('input', {
			attr: {
				type: 'checkbox',
			},
		});
		inputOverwriteField.checked = this.default_overwrite;

		const folderSetting = new Setting(containerEl)
			.setName('Name of Destination Folder in Vault')
			.setDesc('The name of the folder in your Obsidian Vault, which will be created if required');
		const inputFolderName = folderSetting.controlEl.createEl('input', {
			attr: {
				type: 'string',
			},
		});
		inputFolderName.value = this.default_foldername;

		new Setting(containerEl)
			.setName('Import')
			.setDesc('Press to start the Import Process')
			.addButton((button) =>
				button.setButtonText('IMPORT').onClick(async (value) => {
					const templateResourceFiles = inputTemplateResourceFile.files;
					let templateResourceFile = null;
					if (templateResourceFiles) {
						templateResourceFile = templateResourceFiles[0];
					}

					const templateTabFiles = inputTemplateTabFile.files;
					let templateTabFile = null;
					if (templateTabFiles) {
						templateTabFile = templateTabFiles[0];
					}

					let objdataOld: Object = {};
					let textOld = inputOldJsonText.value;
					if (textOld.length == 0) {
						const oldJsonFiles = inputOldJsonFile.files;
						if (oldJsonFiles) {
							let oldJsonFile = oldJsonFiles[0];
							console.log(`Processing input old file ${oldJsonFile.name}`);
							textOld = await oldJsonFile.text();
							objdataOld = JSON.parse(textOld);
						}
					} else {
						objdataOld = JSON.parse(textOld);
					}

					let text = inputJsonText.value;
					if (text.length == 0) {
						const jsonFiles = inputJsonFile.files;
						if (!jsonFiles) {
							new Notice('No JSON file selected');
							return;
						}
						for (let i = 0; i < jsonFiles.length; i++) {
							console.log(`Processing input file ${jsonFiles[i].name}`);
							text = await jsonFiles[i].text();
							let objdata: Object = JSON.parse(text);
							await this.handler.call(
								this.caller,
								objdata,
								objdataOld,
								inputResourceField.checked,
								templateResourceFile,
								inputTabField.checked,
								templateTabFile,
								inputFolderName.value,
								inputOverwriteField.checked,
							);
						}
					} else {
						let objdata: Object = JSON.parse(text);
						await this.handler.call(
							this.caller,
							objdata,
							objdataOld,
							inputResourceField.checked,
							templateResourceFile,
							inputTabField.checked,
							templateTabFile,
							inputFolderName.value,
							inputOverwriteField.checked,
						);
					}
					new Notice('Import Finished');
				}),
			);
	}
}
