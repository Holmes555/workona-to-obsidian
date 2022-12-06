# Workona To Obsidian Plugin

[![ko-fi](https://img.shields.io/badge/Ko--Fi-holmes555-success)](https://ko-fi.com/holmes555)
![Latest Release Download Count](https://img.shields.io/github/downloads/Holmes555/workona-to-obsidian/latest/main.js)
![GitHub License](https://img.shields.io/github/license/Holmes555/workona-to-obsidian)

## Instructions

This plugin allow you to import all the resources from you Workona generated JSON file. It will create the same folder structure as in your workspaces and resource sections. For each resource it will create a new .md note which implements next template:

```
# ${title}

---
Tags: #Workona, #${workspaceSectionTitle.replace(' ', '')}, #${workspaceSubSectionTitle.replace(' ', '')}, #${resourceSectionTitle.replace(' ', '')}

---

Source url: ${url}

Description: ${description ?? "Not provided"} 
```

## How to use

- Install it through community plugins
- Go to Workona to generate JSON file with all your data
- In Workona To Obsidian plugin settings choose JSON file or copy/paste the file data into text area
- Choose if you want to override old files with the same name
- Specify the root folder for imported files
- Run the import
- You are breathtaking!

## Note

Workona To Obsidian is still in early stage as I'm doing it on my free time for my use. 
On this stage it will only import resources, I'm planing to add tabs, notes and tasks transfer as well.
If you want to support me: [ko-fi](https://ko-fi.com/holmes555)
Feel free to open an issue or contribute.
