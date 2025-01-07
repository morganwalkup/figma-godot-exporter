/** Show the `ui.html` page*/
figma.showUI(__html__);

/** Global variables */
let exportType = "page"; // "page" or "project"

/**
 * Calls to `parent.postMessage` inside `ui.html` will trigger this callback.
 * The callback will be passed the `pluginMessage` property of the posted message.
 * @param {Object} pluginMessage - The message from the HTML page, of the shape { type: string }
 */
figma.ui.onmessage = async (pluginMessage) => {
    // Load all pages to make them available to the plugin
    await figma.loadAllPagesAsync();

    // Handle the "export-type" message
    if (pluginMessage.type === "export-type") {
      exportType = pluginMessage.exportType;
    }

    // Handle the `request-json` message
    if (pluginMessage.type === "request-json") {
      const json = getObjectFromNode(exportType === "page" ? figma.currentPage : figma.root);
      const jsonString = JSON.stringify(json);
      figma.ui.postMessage({ type: "response-json", jsonString: jsonString || null });
    }

    // Handle the `request-images` message
    if (pluginMessage.type === "request-images") {
      const images = await getImages();
      figma.ui.postMessage({ type: "response-images", images: images || null });
    }

    // Handle the `request-fonts` message
    if (pluginMessage.type === "request-fonts") {
      const fonts = await getFontList();
      const batchScript = getFontDownloaderBatchScript(fonts);
      figma.ui.postMessage({ type: "response-fonts", batchScript: batchScript || null });
    }
  
    // Handle the `request-cancel` message
    if (pluginMessage.type === "request-cancel") {
      figma.closePlugin();
    }
};



/** BEGIN HELPER FUNCTIONS */



/**
 * Converts a Figma node to a JSON object.
 * @param {Object} node - The Figma node to convert.
 * @param {Boolean} withoutRelations - Whether to exclude parent, children, and masterComponent properties.
 * @returns {Object} The JSON object representation of the Figma node.
 */
const getObjectFromNode = (node, withoutRelations) => {
	const props = Object.entries(Object.getOwnPropertyDescriptors(node.__proto__))
	const blacklist = ['parent', 'children', 'removed', 'masterComponent']
	const obj = { id: node.id, type: node.type }
	for (const [name, prop] of props) {
		if (prop.get && !blacklist.includes(name)) {
			try {
				if (typeof obj[name] === 'symbol') {
					obj[name] = 'Mixed'
				} else {
					obj[name] = prop.get.call(node)
				}
			} catch (err) {
				obj[name] = undefined
			}
		}
	}
	if (node.parent && !withoutRelations) {
		obj.parent = { id: node.parent.id, type: node.parent.type }
	}
	if (node.children && !withoutRelations) {
		obj.children = node.children.map((child) => getObjectFromNode(child, withoutRelations))
	}
	if (node.masterComponent && !withoutRelations) {
		obj.masterComponent = getObjectFromNode(node.masterComponent, withoutRelations)
	}
	return obj
}

/**
 * Retrieves all images from the current Figma page.
 * @returns {Promise<Array<{ data: Blob, filename: string }>>} A promise that resolves to an array of image objects.
 */
async function getImages() {
  const imageHashes = new Set();

  // Find all nodes that contain image fills
  const startingNode = exportType === "page" ? figma.currentPage : figma.root;
  const nodes = startingNode.findAll(node => {
    if ('fills' in node) {
      return node.fills.some(fill => 
        fill.type === 'IMAGE' && 
        fill.visible !== false
      );
    }
    return false;
  });

  if (nodes.length === 0) {
    figma.notify('No image nodes found');
    return;
  }

  // Export all image nodes
  const images = [];
  for (const node of nodes) {
    if ('fills' in node) {
      const imageFills = node.fills.filter(fill => 
        fill.type === 'IMAGE' && 
        fill.visible !== false
      );

      for (const fill of imageFills) {
        if (imageHashes.has(fill.imageHash)) {
          continue;
        }
        imageHashes.add(fill.imageHash);
        const imageData = await node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 1 }
        });
        images.push({
          data: imageData,
          filename: `${fill.imageHash}.png`
        });
      }
    }
  }

  return images;
}

/**
 * Creates a list of all fonts used in the Figma file.
 * @returns {Promise<Array<{ family: string, style: string }>>} A promise that resolves to an array of font objects.
 */
const getFontList = async () => {
  const fonts = new Set();
  const fontNames = new Set();

  const traverse = (node) => {
    if (node.type === "TEXT") {
        // Get font names from text node
        node.getRangeAllFontNames(0, node.characters.length).forEach(font => {
          if (fontNames.has(`${font.family} ${font.style}`)) return;
          fontNames.add(`${font.family} ${font.style}`);
          fonts.add(font);
        });
    }

    // Traverse children if they exist
    if ("children" in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  await figma.loadAllPagesAsync();
  traverse(exportType === "page" ? figma.currentPage : figma.root);
  return Array.from(fonts);
};

/**
 * Converts a Figma font style to a Google Fonts font weight.
 * @param {string} style - The Figma font style.
 * @returns {string} The Google Fonts font weight.
 */
function getFontWeight(style) {
  // Convert common font styles to weights
  const weightMap = {
      'Thin': '100',
      'ExtraLight': '200',
      'Light': '300',
      'Regular': '400',
      'Medium': '500',
      'SemiBold': '600',
      'Bold': '700',
      'ExtraBold': '800',
      'Black': '900'
  };
  
  return weightMap[style] || '400'; // Default to 400 (Regular) if not found
}

/**
 * Generates a batch script to find fonts on the user's system or download them from Google Fonts.
 * @param {Array<Object>} fonts - The fonts to download.
 * @returns {string} The batch script.
 */
function getFontDownloaderBatchScript(fonts) {
return `@echo off
setlocal EnableDelayedExpansion

:: Set colors and title
color 0A
title Font Downloader for Godot

echo ================================
echo    Font Downloader for Godot
echo ================================
echo.
echo This script will:
echo  1. Check your Windows Fonts directory for required fonts
echo  2. Copy found fonts to a local 'fonts' directory
echo  3. Attempt to download missing fonts from Google Fonts
echo.
echo Required fonts:
${fonts.map(font => `echo  - ${font.family} ${font.style}`).join('\n')}
echo.
echo Press any key to begin...
pause > nul

:: Create fonts directory if it doesn't exist
if not exist "fonts" mkdir "fonts"

echo Checking for required fonts...
echo.

${fonts.map(font => {
const fontFamily = font.family.replace(/\s+/g, '+');
const fontWeight = getFontWeight(font.style);
const fileName = `${font.family.replace(/\s+/g, '_')}-${font.style}.ttf`;

return `
echo Checking for ${font.family} ${font.style}...

:: Check Windows Fonts directory
if exist "%WINDIR%\\Fonts\\${fileName}" (
    echo Found in system fonts - copying...
    copy "%WINDIR%\\Fonts\\${fileName}" "fonts\\${fileName}" > nul
    echo Copied successfully.
) else (
    echo Not found in system fonts - attempting download from Google Fonts...
    powershell -Command "&{$webClient=New-Object System.Net.WebClient; $webClient.Headers.Add('User-Agent', 'Mozilla/5.0'); $cssUrl='https://fonts.googleapis.com/css2?family=${fontFamily}:wght@${fontWeight}'; $css=$webClient.DownloadString($cssUrl); if($css -match 'src: url\\((.*?)\\)'){$fontUrl=$matches[1]; $webClient.DownloadFile($fontUrl, 'fonts\\${fileName}')}}"
    if exist "fonts\\${fileName}" (
        echo Downloaded successfully.
    ) else (
        echo Failed to download. Please download manually from: https://fonts.google.com/specimen/${fontFamily}
    )
)
echo.`;
}).join('\n')}

echo.
echo All operations completed!
echo Font files have been saved to the 'fonts' directory.
echo.
pause
`;
}