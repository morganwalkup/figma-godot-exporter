# Figma to Godot

<img width="232" alt="image" src="https://github.com/user-attachments/assets/d10d72c2-548a-4dc2-863d-aabdac7591d7" />

This plugin exports a Figma project (or page) as a collection of Godot-ready assets.

These assets can be used alongside the [Godot Figma Importer](https://github.com/morganwalkup/godot-figma-importer) to create in-game UI.

Exported assets include:
- Project or page structure as a JSON file.
- All images in the project or page as PNG files.
- A batch script to download all fonts used in the project or page.

## Get started

This plugin is designed to be as simple as possible. Zero dependencies, zero build steps.

1. Clone this repository to your local machine.
1. Open the Figma desktop app.
1. Go to `Plugins > Development > Import plugin from manifest...`
1. Select the `manifest.json` file in this repository.
1. Click `Import`.
1. To run the plugin, go to `Plugins > Development > Figma to Godot`.

## Using the plugin

1. Choose an export type of "Current page" or "Entire project".
1. Click one of the export buttons - "Export all as ZIP", "JSON only", "Images only", or "Fonts only".
1. If you chose "Export all as ZIP", unzip the file and move the contents to your Godot project.
1. To get font files, run the batch script. It will scan your local machine for any already-installed fonts. If that fails, it will download available fonts from Google Fonts. If *that* fails, you'll have to find your own way to provide Godot with the font files.

## Notes

- Credit goes to [mightymochi](https://github.com/mightymochi) for the original [Godot to Figma plugin](https://github.com/mightymochi/figma-to-godot-experiment).
