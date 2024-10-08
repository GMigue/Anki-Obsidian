import {MarkdownRenderer, Component, App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface AnkiObsidianSetting {
	ankiConnectUrl: string;  //URL Anki-Connect
	basico: string;  //Notas basicas
	inverso: string;  //Notas basicas
}

const DEFAULT_SETTINGS: AnkiObsidianSetting = {
	ankiConnectUrl: 'http://localhost:8765', //URL Aki-Connect
	basico: 'CAnki',
	inverso: 'CIAnki'
}

export default class AnkiObsidian extends Plugin {
	settings: AnkiObsidianSetting;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('wallet-cards', 'Enviar', async(evt: MouseEvent) => {
			// Obtiene View
		   const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		   if (!activeView) {
			   console.error('No hay un editor markdown activo.');
			   new Notice('No hay una pagina abierta');
			   return;
		   }
		   
		   //Extrae propiedades
		   const fields = this.extraerPropiedades(activeView);

		   //Basico
		   const basico = this.variasLineas('Basico', activeView);

		   //Invertido
		   const Invertido =this.variasLineas('Invertido', activeView);

		   //Basico
		    const basicoInline = this.unaLineas('Basico', activeView);

		   //Invertido
		   const InvertidoInline =this.unaLineas('Invertido', activeView);
		
		   //Oclusion {{}}
		   const oclusion = this.oclusion(activeView);

		   await this.escribirResultadosEnEditor(activeView, oclusion);
			
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Funcion para probar la conexión a AnkiConnect
    async testAnkiConnect() {
        try {
            // Aquí realizarías la solicitud a AnkiConnect
            const response = await fetch(this.settings.ankiConnectUrl);
            if (response.ok) {
                new Notice('Conexión a AnkiConnect exitosa!');
            } else {
                new Notice('Error al conectar con AnkiConnect. Verifica que este abierto Anki.');
            }
        } catch (error) {
            new Notice('Error al conectar con AnkiConnect: ' + error.message);
        }
    }

	//Envio de informacion a Anki Connect
	async invoke(action: string, version: number, params: Record<string, any> = {}): Promise<any> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
    
            xhr.addEventListener('error', () => reject('failed to issue request'));
    
            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    
                    // Verificación de que el objeto tenga exactamente 2 campos
                    if (Object.getOwnPropertyNames(response).length !== 2) {
                        throw new Error('response has an unexpected number of fields');
                    }
    
                    // Verificación de los campos requeridos
                    if (!response.hasOwnProperty('error')) {
                        throw new Error('response is missing required error field');
                    }
                    if (!response.hasOwnProperty('result')) {
                        throw new Error('response is missing required result field');
                    }
    
                    // Manejo de errores en la respuesta
                    if (response.error) {
                        throw new Error(response.error);
                    }
    
                    // Resolución de la promesa con el resultado
                    resolve(response.result);
                } catch (e) {
                    reject(e);
                }
            });
    
            // Configuración y envío de la solicitud
            xhr.open('POST', 'http://127.0.0.1:8765');
            xhr.send(JSON.stringify({ action, version, params }));
        });
    }

	variasLineas(tipo: string, activeView: MarkdownView): Array<Record<string, string>> {
		let keyword = '';

		switch (tipo) {
			case 'Basico':
				keyword = this.settings.basico;	
				break;
			case 'Invertido':
				keyword = this.settings.inverso;
				break;
			default:
				new Notice('Tipo no encontrado');
				return [];
		}

        // Obtener el contenido del editor activo
        const content = activeView.editor.getValue();

        // Expresión regular para buscar el bloque antes de #card y después
		const regex = new RegExp(`\\n\\s*\\n([\\s\\S]+?)#${keyword}([\\s\\S]+?)\\n\\s*\\n`, 'g');


        const coincidencias: Array<Record<string, string>> = [];
        let match;

        // Ejecutar la búsqueda de coincidencias
		while ((match = regex.exec(content)) !== null) {
            let antes = match[1].trim().split(/\n\s*\n/).pop();  // Capturar el texto inmediatamente antes de #card
            let despues = match[2].trim(); // Capturar el texto después de #card

            // Extraer el texto entre || antes de #card
            const textoEntrePipes = antes.match(/\|\|([\s\S]+?)\|\|/)?.[1] || 'No encontrado';
            // Eliminar el texto entre || del bloque antes
            antes = antes.replace(/\|\|([\s\S]+?)\|\|/g, '').trim();

            // Extraer las palabras que comienzan con # después de #card
            const palabrasConHash = despues.match(/#\w+/g) || [];
            // Eliminar las palabras que empiezan con # del bloque después
            despues = despues.replace(/#\w+/g, '').trim();

            coincidencias.push({ antes, despues, textoEntrePipes, palabrasConHash });
        }

		return coincidencias;
    }

	unaLineas(tipo: string, activeView: MarkdownView): Array<Record<string, string>> {
		let keyword = '';

		switch (tipo) {
			case 'Basico':
				keyword = this.settings.basico;	
				break;
			case 'Invertido':
				keyword = this.settings.inverso;
				break;
			default:
				new Notice('Tipo no encontrado');
				return [];
		}

        // Obtener el contenido del editor activo
        const content = activeView.editor.getValue();

        // Expresión regular para buscar el bloque antes de #card y después
		const regex = new RegExp(`\\n([\\s\\S]+?):::([\\s\\S]+?)\\n`, 'g');


        const coincidencias: Array<Record<string, string>> = [];
        let match;

        // Ejecutar la búsqueda de coincidencias
		while ((match = regex.exec(content)) !== null) {
            let antes = match[1].trim().split(/\n\s*\n/).pop();    // Capturar el texto inmediatamente antes de #card
            let despues = match[2].trim(); // Capturar el texto después de #card

            // Extraer el texto entre || antes de #card
            const textoEntrePipes = despues.match(/\|\|([\s\S]+?)\|\|/)?.[1] || 'No encontrado';
            // Eliminar el texto entre || del bloque antes
            despues = despues.replace(/\|\|([\s\S]+?)\|\|/g, '').trim();

            // Extraer las palabras que comienzan con # después de #card
            const palabrasConHash = despues.match(/#\w+/g) || [];
            // Eliminar las palabras que empiezan con # del bloque después
            despues = despues.replace(/#\w+/g, '').trim();

            coincidencias.push({ antes, despues, textoEntrePipes, palabrasConHash });
        }

		return coincidencias;
    }

    // Método para extraer las propiedades 'nombre-deck', 'nivel', 'modulo'
    extraerPropiedades(activeView: MarkdownView): Record<string, string> {
        // Obtener el contenido del editor activo
        const content = activeView.editor.getValue();

        // Expresiones regulares para buscar las propiedades
        const nombreDeckMatch = content.match(/Deck-Anki:\s*(.+)/) || '';
        const nivelMatch = content.match(/Origen-Anki:\s*(.+)/) || '';
        const moduloMatch = content.match(/Nivel-Anki:\s*(.+)/) || '';

		new Notice(nombreDeckMatch[1].trim());

        // Retornar las propiedades encontradas
        return {
            nombreDeck: nombreDeckMatch[1].trim(),
            nivel: nivelMatch[1].trim(),
            modulo: moduloMatch[1].trim(),
        };
    }

	oclusion(activeView: MarkdownView): Array<{ lineaProcesada: string, palabrasEntrePipes: string | null, palabrasConHash: string[] }> {
		// Obtener el contenido del editor activo
		const content = activeView.editor.getValue();
		const lineas = content.split('\n');
		const resultados: Array<{ lineaProcesada: string, palabrasEntrePipes: string | null, palabrasConHash: string[] }> = [];
	
		// Expresiones regulares para identificar los patrones
		const regexSimple = /\{\{(.+?)\}\}/g;  // {{palabra1}
		const regexConC1 = /\{\{(.+) +:: +(.+)\}\}/g;  // {{c1 :: palabra1}}
	
		for (let linea of lineas) {
			let match;
			let palabrasEntrePipes: string | null = null;
			let palabrasConHash: string[] = [];
			let band: boolean = false;
	
			// 1. Patrón -{palabra1}
			if ((match = linea.match(regexSimple))) {
				match.forEach(element => {
					if(!element.match(/::/)){
						const palabra = element.replace('{{', '').replace('}}','');
						linea = linea.replace(`{{${palabra}}}`, `{{c1::${palabra}}}`);// Agregar c1:: si no está presente
					}
				});
				band = true;
			}
	
			// 2. Patrón -{c1 :: palabra1}
			if ((match = linea.match(regexConC1))) {
				band = true;
			}

	
			// 5. Buscar palabras entre || al final de la línea si no fueron capturadas
			const pipesMatch = linea.match(/\|\|(.+?)\|\|/);
			if (pipesMatch) {
				palabrasEntrePipes = pipesMatch[1].trim();  // Capturar el texto entre los pipes
				linea = linea.replace(/\|\|(.+?)\|\|/g, '');  // Eliminar las palabras entre pipes de la línea
			}
	
			// 6. Buscar palabras que comienzan con #
			palabrasConHash = [...linea.matchAll(/#(\w+)/g)].map(match => match[1]);
	
			// Eliminar las palabras con # del texto procesado
			linea = linea.replace(/#\w+/g, '').trim();
	
			// Almacenar los resultados procesados de la línea
			if (band) {
				resultados.push({
					lineaProcesada: linea,
					palabrasEntrePipes: palabrasEntrePipes,
					palabrasConHash: palabrasConHash,
				});
			}
			
		}
	
		// Retornar las líneas procesadas junto con palabras entre pipes y palabras con hash
		return resultados;
	}
	
	async renderMarkdownToHtml(markdown: string): Promise<string> {
		// Crear un contenedor temporal para el HTML
		const containerEl = document.createElement('div');
		
		// Crear un componente temporal
		const component = new Component();
	
		// Renderizar el Markdown en el contenedor
		await MarkdownRenderer.render(this.app, markdown, containerEl, '', component);
	
		// Obtener el HTML generado
		const htmlContent = containerEl.innerHTML;
	
		// Descargar (unload) el componente una vez que ya no lo necesites
		component.unload();
	
		return htmlContent;
	}

	async escribirResultadosEnEditor(activeView:MarkdownView, resultados: Array<{ lineaProcesada: string, palabrasEntrePipes: string | null, palabrasConHash: string[] }>): void {

	
		// Obtener el editor
		const editor = activeView.editor;
		const contenidoAInsertar: string[] = [];
	
		// Formatear los resultados
		resultados.forEach(resultado => {
			let texto = 'Linea procesada:' + resultado.lineaProcesada;
	
			// Si hay palabras entre pipes, las añadimos al final
			if (resultado.palabrasEntrePipes) {
				texto += `\nDeck: ${resultado.palabrasEntrePipes}`;
			}
	
			// Si hay palabras que comienzan con #, las añadimos al final
			texto += '\nTags: ';
			if (resultado.palabrasConHash.length > 0) {
				texto += `${resultado.palabrasConHash.join(' ')}`;
			}
	
			// Añadimos la línea formateada al contenido a insertar
			contenidoAInsertar.push(texto);
		});
	
		// Concatenamos todas las líneas con saltos de línea
		const contenidoFinal = contenidoAInsertar.join('\n\n');

		const htmlContent =  await this.renderMarkdownToHtml(contenidoFinal);
	
		// Obtener el contenido del editor activo
        const content = activeView.editor.getValue();


        // Agregar el texto al final del contenido del editor
        activeView.editor.setValue(content + contenidoFinal);
	}	
	imprimirCoincidencias(coincidencias:Array<Record<string, string>>, activeView: MarkdownView) : void{
		// Generar el texto que se agregará al final del editor
        let resultado = '\n\n## Coincidencias encontradas:\n';

		coincidencias.forEach((coincidencia, index)  => {
			const { antes, despues, textoEntrePipes, palabrasConHash } = coincidencias[index]; // Obtener la última coincidencia
			resultado += `\n### Coincidencia ${index}:\n`;
			resultado += `**Antes:**\n${antes}\n`;
			resultado += `**Después:**\n${despues}\n`;
			resultado += `**Texto entre || antes de #card:**\n${textoEntrePipes}\n`;
			resultado += `**Palabras que empiezan con # después de #card:**\n${palabrasConHash.join(', ')}\n`;

		});
		

		// Obtener el contenido del editor activo
        const content = activeView.editor.getValue();


        // Agregar el texto al final del contenido del editor
        activeView.editor.setValue(content + resultado);
	}
	

}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}


class SettingTab extends PluginSettingTab {
    plugin: AnkiObsidian;

    constructor(app: App, plugin: AnkiObsidian) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();
		
		containerEl.createEl('h2', { text: 'Configuración de AnkiObsidian' });

        // Botón para probar AnkiConnect
        new Setting(containerEl)
            .setName('Test AnkiConnect')
            .addButton(button => {
                button
                    .setButtonText('Test Conección')
                    .onClick(async () => {
                        await this.plugin.testAnkiConnect();
                    });
            });

		new Setting(containerEl)
            .setName('Tarjetas Basicas')
            .setDesc('Ingresa la palabra que se utilizará para hacer coincidencias en tajetas basicas.')
            .addText(text => text
                .setPlaceholder('Ingresa una palabra')
                .setValue(this.plugin.settings.basico)
                .onChange(async (value) => {
                    this.plugin.settings.basico = value;
                    await this.plugin.saveSettings();
                }));
		
		new Setting(containerEl)
            .setName('Tarjetas Invertidas')
            .setDesc('Ingresa la palabra que se utilizará para hacer coincidencias en tajetas invertidas.')
            .addText(text => text
                .setPlaceholder('Ingresa una palabra')
                .setValue(this.plugin.settings.inverso)
                .onChange(async (value) => {
                    this.plugin.settings.inverso = value;
                    await this.plugin.saveSettings();
                }));
    }
}