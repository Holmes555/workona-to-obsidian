import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

const Handlebars = require("handlebars");


const WORKONA_USER= "User"
const WORKONA_WORKSPACES= "Workspaces"
const WORKONA_ARCHIVED_WORKSPACES= "Archived Workspaces"
const WORKONA_MY_TASKS= "My Tasks"

const WORKONA_TITLE= "title"
const WORKONA_TABS= "tabs"
const WORKONA_RESOURCES= "resources"
const WORKONA_NOTES= "notes"
const WORKONA_TASKS= "tasks"

const WORKONA_DESCRIPTION= "description"
const WORKONA_URL= "url"

const SET_FOLDER_NAME= "folderName";
const SET_OVERWRITE= "overwrite";

interface WorkonaToObsidianSettings {
	[SET_FOLDER_NAME]: string;
	[SET_OVERWRITE]: boolean;
}

const DEFAULT_SETTINGS: WorkonaToObsidianSettings = {
	[SET_FOLDER_NAME]: "Workona",
	[SET_OVERWRITE]: true
}


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

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	validFilename(name:string) {
		const regexp = /[`~|!@#$%^&*\=?;:'"<>\{\}\[\]\\\/]/gi;
		return name.replace(regexp,'_');
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
			await this.app.vault.createFolder(path).catch(err => console.log(`app.vault.checkPath: ${err}`));
		}
	}

	async getBaseTemplateText() {
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

	async generateNotes(objdata:Object, objdataOld:Object, templateFile:File, destFolder:string, overwrite:boolean) {
		console.log(`generateNotes('${destFolder}', ovewrite='${overwrite}')`);

		// Save current settings
		this.settings[SET_FOLDER_NAME] = destFolder;
		this.settings[SET_OVERWRITE] = overwrite;
		this.saveSettings();

		// Workspaces section
		const workspacesPath = destFolder + "/" + WORKONA_WORKSPACES;
		await this.createFolder(workspacesPath);

		let worspaceSectionOldBase = objdataOld[WORKONA_WORKSPACES as keyof Object] ?? {};
		for (let [key, worspaceSection] of Object.entries(objdata[WORKONA_WORKSPACES as keyof Object])) {
			let worspaceSectionOld = worspaceSectionOldBase[key as keyof Object] ?? {};
			const workspaceSectionTitle = worspaceSection[WORKONA_TITLE as keyof Object];
			const workspaceSectionPath = workspacesPath + "/" + workspaceSectionTitle;
			await this.createFolder(workspaceSectionPath);

			let worspaceSubSectionOldBase = worspaceSectionOld[WORKONA_WORKSPACES.toLowerCase() as keyof Object] ?? {};
			for (let [key, worspaceSubSection] of Object.entries(worspaceSection[WORKONA_WORKSPACES.toLowerCase() as keyof Object])) {
				let worspaceSubSectionOld = worspaceSubSectionOldBase[key as keyof Object] ?? {};
				const workspaceSubSectionTitle = worspaceSubSection[WORKONA_TITLE as keyof Object];
				const workspaceSubSectionPath = workspaceSectionPath + "/" + workspaceSubSectionTitle;
				await this.createFolder(workspaceSubSectionPath);

				let resourcesSectionOldBase = worspaceSubSectionOld[WORKONA_RESOURCES as keyof Object] ?? {};
				for (let [key, resourcesSection] of Object.entries(worspaceSubSection[WORKONA_RESOURCES as keyof Object])) {
					let resourcesSectionOld = resourcesSectionOldBase[key as keyof Object] ?? {};
					const resourceSectionTitle = resourcesSection[WORKONA_TITLE as keyof Object];

					let resourceOldBase = resourcesSectionOld[WORKONA_RESOURCES as keyof Object] ?? {}
					for (let [key, resource] of Object.entries(resourcesSection[WORKONA_RESOURCES as keyof Object])) {
						let resourceOld = resourceOldBase[key as keyof Object] ?? {};
						const title = resource[WORKONA_TITLE as keyof Object];
						const filename = workspaceSubSectionPath + "/" + this.validFilename(title) + ".md";

						const description = resource[WORKONA_DESCRIPTION as keyof Object];
						const url = resource[WORKONA_URL as keyof Object];
						const urlOld = resourceOld[WORKONA_URL as keyof Object] ?? null;

						if (url === urlOld) {
							console.log(`Url: ${url}.\n Old url: ${urlOld}`);
							continue;
						}

						let templateText = await this.getBaseTemplateText();
						if (templateFile) {
							templateText = await templateFile.text();
						}
						var template = Handlebars.compile(templateText);
						let body = template({title: title, date: new Date().toLocaleTimeString('en-us', { weekday:"long", year:"numeric", month:"short", day:"numeric", hour12: false}), 
											workspaceSectionTitleTag: workspaceSectionTitle.replace(' ', ''), workspaceSubSectionTitleTag: workspaceSubSectionTitle.replace(' ', ''), 
											resourceSectionTitleTag: resourceSectionTitle.replace(' ', ''), url: url, description: description ?? "Not provided"});


						// Delete the old version, if it exists
						let exist = this.app.vault.getAbstractFileByPath(filename);
						if (exist) {
							if (!overwrite) {
								new Notice(`Note already exists for '${filename}' - ignoring entry in data file`);
								continue;
							}
							await this.app.vault.delete(exist).catch(err => console.log(`app.vault.delete: ${err}`));
						}
						await this.app.vault.create(filename, body).catch(err => console.log(`Filename: ${filename}.\n app.vault.create: ${err}`));	
					}				
				}
			}
		}
	};
}


class WorkonaToObsidianSettingTab extends PluginSettingTab {
	caller: Object;
	handler: Function;
	default_foldername: string;
	default_overwrite: boolean;
	plugin: WorkonaToObsidian;

	constructor(app: App, plugin: WorkonaToObsidian) {
		super(app, plugin);
		this.plugin = plugin;
	}

	setHandler(caller:Object, handler:Function): void {
		this.caller  = caller;
		this.handler = handler;
	}

	setDefaults(foldername:string, overwrite:boolean) {
		this.default_foldername = foldername;
		this.default_overwrite = overwrite;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for WorkonaToObsidian plugin.'});

		const jsonSetting = new Setting(containerEl).setName('Choose generated Workona JSON file').setDesc('Choose generated Workona JSON file to import, or paste text into the text box');
		const inputJsonFile = jsonSetting.controlEl.createEl("input", {
      		attr: {
        		type: "file",
				multiple: true,
        		accept: ".json"
      		}
    	});
    	const inputJsonText = jsonSetting.controlEl.createEl("textarea", {
			attr: {
			  rows: "5",
			  columns: "20"
			}
	 	});

		const jsonOldSetting = new Setting(containerEl).setName('Choose previously generated Workona JSON file').setDesc(
			'Choose previously generated Workona JSON file to import, or paste text into the text box. Use it to not override or duplicate resources.');
		const inputOldJsonFile = jsonOldSetting.controlEl.createEl("input", {
			attr: {
				type: "file",
				multiple: false,
				accept: ".json"
			}
		});
		const inputOldJsonText = jsonOldSetting.controlEl.createEl("textarea", {
			attr: {
			rows: "5",
			columns: "20"
			}
		});

		const templateSetting = new Setting(containerEl).setName("Choose template Markdown file").setDesc("Choose template (Handlebars) Markdown file");
		const inputTemplateFile = templateSetting.controlEl.createEl("input", {
			attr: {
				type: "file",
				multiple: false,
				accept: ".md",
			}
		});
	
	    const overwriteSetting = new Setting(containerEl).setName("Overwrite existing Notes").setDesc("When ticked, existing Notes with a matching name will be overwritten by entries in the supplied JSON file. Otherwise will be ignored");
    	const inputOverwriteField = overwriteSetting.controlEl.createEl("input", {
      		attr: {
        		type: "checkbox"
      		}
    	});
		inputOverwriteField.checked = this.default_overwrite;
	
	    const folderSetting = new Setting(containerEl).setName("Name of Destination Folder in Vault").setDesc("The name of the folder in your Obsidian Vault, which will be created if required");
    	const inputFolderName = folderSetting.controlEl.createEl("input", {
      		attr: {
        		type: "string"
      		}
    	});
		inputFolderName.value = this.default_foldername;
	
	    new Setting(containerEl)
			.setName("Import")
			.setDesc("Press to start the Import Process")
			.addButton(button => button
				.setButtonText("IMPORT")
				.onClick(async (value) => {
					const templateFiles = inputTemplateFile.files;
					let templateFile = null;
					if (templateFiles) {
						templateFile = templateFiles[0];
					}

					let objdataOld:Object = {};
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
							new Notice("No JSON file selected");
							return;
						}
						for (let i=0; i<jsonFiles.length; i++)
						{
							console.log(`Processing input file ${jsonFiles[i].name}`);
							text = await jsonFiles[i].text();
							let objdata:Object = JSON.parse(text);
							await this.handler.call(this.caller, objdata, objdataOld, templateFile, inputFolderName.value, inputOverwriteField.checked);
						}
					} else {
						let objdata:Object = JSON.parse(text);
						await this.handler.call(this.caller, objdata, objdataOld, templateFile, inputFolderName.value, inputOverwriteField.checked);
					}
					new Notice("Import Finished");
				}));
	}
}
