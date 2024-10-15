import {MarkdownRenderer, Component, App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { json } from 'stream/consumers';

// Remember to rename these classes and interfaces!

interface AnkiObsidianSetting {
	ankiConnectUrl: string;  //URL Anki-Connect
	basico: string;  //Notas basicas
	inverso: string;  //Notas basicas
	deckDefault: string;
}

const DEFAULT_SETTINGS: AnkiObsidianSetting = {
	ankiConnectUrl: 'http://localhost:8765', //URL Aki-Connect
	basico: 'CAnki',
	inverso: 'CIAnki',
	deckDefault: 'Predeterminado'
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

		   const postCards = await this.searchCards(activeView);

		   new Notice(`Se crearon ${postCards.add} tarjetas`);
		   new Notice(`Se actualizaron ${postCards.update} tarjetas`);
		   new Notice(`Se eliminaron ${postCards.delete} tarjetas`);

		});

		const ribbonIconEl2 = this.addRibbonIcon('info', 'Enviar2', async(evt: MouseEvent) => {
			// Obtiene View
		   const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		   if (!activeView) {
			   console.error('No hay un editor markdown activo.');
			   new Notice('No hay una pagina abierta');
			   return;
		   }

		   const postCards = await this.prueba(activeView);

		   new Notice(`Se crearon ${postCards.add} tarjetas`);
		   new Notice(`Se actualizaron ${postCards.update} tarjetas`);
		   new Notice(`Se eliminaron ${postCards.delete} tarjetas`);

		});
		
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		ribbonIconEl2.addClass('my-plugin-ribbon-class');


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'run-enviar-anki',
			name: 'Enviar tarjetas a Anki',
			callback: async () => {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!activeView) {
					console.error('No hay un editor markdown activo.');
					new Notice('No hay una pagina abierta');
					return;
				}

				const postCards = await this.searchCards(activeView);

				new Notice(`Se crearon ${postCards.add} tarjetas`);
				new Notice(`Se actualizaron ${postCards.update} tarjetas`);
				new Notice(`Se eliminaron ${postCards.delete} tarjetas`);

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


	async sendAnkiRequest(action: string, params: any) {
		const data = {
			action: action,
			version: 6,
			params: params
		};
	
		try {
			// Realizar la solicitud a Anki Connect usando fetch
			const response = await fetch('http://localhost:8765', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(data),
			});
	
			// Analizar la respuesta de Anki Connect
			if (!response.ok) {
				throw new Error(`Error HTTP: ${response.status}`);
			}
	
			const result = await response.json();
	
			// Verificar si la solicitud a Anki fue exitosa
			if (result.error) {
				throw new Error(result.error);
			}
	
			return result;  // Retorna el resultado de la API
		} catch (error) {
			// Mostrar un Notice con el mensaje de error
			//new Notice(`Error en Anki: ${error.message}`);
			throw new Error(`No se pudo conectar con Anki: ${error.message}`);
		}
	}

	async addNote(anv:string, rev:string, origen:string, nivel:string, leccion:string, deck:string, model:string, tags:Array<string>, decksAnki:Array<string>){
		try {

			let newDeck = true;
			let createDeck = '';
			let reverso = await this.renderMarkdownToHtml(rev);
			let anverso = await this.renderMarkdownToHtml(anv);

			//Verificar si el deck existe
			if (!decksAnki.includes(deck)) {
				// Crea Deck
				newDeck = await this.addDeck(deck);

				createDeck = deck;
			} 

			if (newDeck) {
				const action = "addNote";
				let fieldsTemp = {}
				switch (model) {
					case "Ingles oclusion":
						fieldsTemp = {
							Texto: anverso,
							Origen: origen,
							Nivel: nivel,
							Leccion: leccion
						}
						break;
				
					default:
						fieldsTemp = {
							Anverso: anverso,
							Reverso: reverso,
							Origen: origen,
							Nivel: nivel,
							Leccion: leccion
						}
						break;
				}
				const params = {
					note: {
						deckName: deck,
						modelName: model,
						fields: fieldsTemp,
						options: {
							allowDuplicate: false
						},
						tags: tags
					}
				};

		
				const result = await this.sendAnkiRequest(action, params);

				return {id:result['result'], newDeck:createDeck};	
						
			
			}

			return {id:-1, newDeck:''};
	
		} catch (error) {
			new Notice(`Error al crear tarjeta: ${error.message}`);
			return {id:-1, newDeck:''};
		}
	}
	async addDeck(deck:string){
		try {
			const action = "createDeck";
			const params = {
				deck: deck
			};
	
			const result = await this.sendAnkiRequest(action, params);
			return true;
	
		} catch (error) {
			new Notice(`Error al crear Deck (${deck}): ${error.message}`);
			return false;
		}
	}
	async deleteNote(id:number){
		try {
			const action = "deleteNotes";
			const params = {
				notes: [id]
			}
	
			const result = await this.sendAnkiRequest(action, params);
			return true;
	
		} catch (error) {
			new Notice(`Error al eliminar nota (${id}): ${error.message}`);
			return false
		}
	}
	async updateDeck(anv:string, rev:string, origen:string, nivel:string, leccion:string, model:string, tags:Array<string>, id:number){
		try {
			let reverso = await this.renderMarkdownToHtml(rev);
			let anverso = await this.renderMarkdownToHtml(anv);
			let bandUpdate = false;
			const action = "notesInfo";
			const params = {
					notes: [id]
			};
	
			const result = await this.sendAnkiRequest(action, params);
			
			const fileds = result['result'][0]['fields'];
			const tagsNote : Array<string> = result['result'][0]['tags'] || [];
			const newTags =  tagsNote.filter(item => !tags.includes(item));

			if (model !== result['result'][0]['modelName']) {
				bandUpdate = true;
			}
			else{
				if (result['result'][0]['modelName'] == 'Ingles oclusion') {
					if (anverso !== fileds['Texto']['value'] || origen !== fileds['Origen']['value']
						|| nivel !== fileds['Nivel']['value'] || leccion !== fileds['Leccion']['value'] || newTags.length > 0 
					) {
						bandUpdate = true;
					}
				}
				else{
					if (anverso !== fileds['Anverso']['value'] || reverso !== fileds['Reverso']['value'] || origen !== fileds['Origen']['value']
						|| nivel !== fileds['Nivel']['value'] || leccion !== fileds['Leccion']['value'] || newTags.length > 0 
					) {
						bandUpdate = true;
					}
				}
			}

			if (bandUpdate) {
				const action = "updateNoteModel";
				let fieldsTemp = {};
				switch (model) {
					case 'Ingles oclusion':
						fieldsTemp = {
							Texto: anverso,
							Origen: origen,
							Nivel: nivel,
							Leccion: leccion
						}
						break;
				
					default:
						fieldsTemp = {
							Anverso: anverso,
							Reverso: reverso,
							Origen: origen,
							Nivel: nivel,
							Leccion: leccion
						}
						break;
				}
				const params = {
						note: {
							id: id,
							modelName: model,
							fields: fieldsTemp,
							tags: newTags
						}
					};
		
				const result = await this.sendAnkiRequest(action, params);
				return true;
			}
			return false;
	
		} catch (error) {
			new Notice(`Error al actualizar la tarjeta (${id})): ${error.message}`);
			return false;
		}
	}
	async getDeck(){
		try {
			const action = "deckNames";
			const params = {
			}
	
			const result = await this.sendAnkiRequest(action, params);
			return result['result'];
	
		} catch (error) {
			new Notice(`Error al buscar Decks: ${error.message}`);
			return []
		}
	}

	async searchCards(activeView: MarkdownView) {
		const keywordBasico = this.settings.basico;	
		const keywordInvertido= this.settings.inverso;
		const content = activeView.editor.getValue();
		const lines = content.split('\n');

		let preCard = '';
		let postCard = '';
		let tagsGen: string[] = [];
		let tagsInd: string[] = [];
		let deckInd = '';

		let deckGen = this.settings.deckDefault;
		let nivelGen = '';
		let origenGen = '';
		let leccionGen = '';

		let updateIdNote: number = 0;

		let idDelete = 0;

		let index = 0;
		let prop = false;
		let bandTags = false;
		let bandCard = false;
		let typeCard = '';
		let bandAddLine = true;
		let bandAddCard = false;

		let textAll = '';

		let contUpdate = 0;
		let contAdd = 0;
		let contDelete = 0;

		// Expresiones regulares para identificar los patrones
		const regexOclusion = /\{\{(.+?)\}\}/g;  //oclusion
		const regexInlInv = new RegExp(`([\\s\\S]+):::([\\s\\S]+)`);
		const regexInlBas = new RegExp(`([\\s\\S]+)::([\\s\\S]+)`);
		const regexBasico = new RegExp(`([\\s\\S]+)#${keywordBasico}([\\s\\S]+)`);
		const regexInvertido = new RegExp(`([\\s\\S]+)#${keywordInvertido}([\\s\\S]+)`);
		const regexDelete = /^\^(\d+)$/;

		const regex = [/\{\{(.+?)\}\}/, /:::/, /::/, new RegExp(`${keywordBasico}`), new RegExp(`#${keywordInvertido}`), regexDelete];

		let firstMatch = { pattern: -1, index: -1 };

		let antes = '';
		let despues  = '';

		// Obtiene Decks
		const decksAnki : string[] = await this.getDeck();

		//let paraTemp = [];


	
		for (let line of lines) {
			// Extrae datos de propiedades
			if (prop) {
				// Almacena Tags de propiedades
				if (bandTags) {
					const regexTagsGen = /  - (.+)/;
					const matchTagGen = line.match(regexTagsGen);
					if (matchTagGen) {
						if (matchTagGen[1].trim(). length > 0) {
							tagsGen.push(matchTagGen[1].trim());
						}
					}
					else if (line.trim() !== '-') {
						bandTags = false;
					}
				}
				if(!bandTags){
					// Busca field en las propiedades 
					const nombreDeckMatch = line.match(/Deck-Anki:\s*(.+)/) || '';
					const origenMatch = line.match(/Origen-Anki:\s*(.+)/) || '';
					const nivelMatch = line.match(/Nivel-Anki:\s*(.+)/) || '';
					const leccionMatch = line.match(/Lección-Anki:\s*(.+)/) || '';

					if (nombreDeckMatch) {
						deckGen = nombreDeckMatch[1];
					} 
					if (origenMatch) {
						origenGen = origenMatch[1];
					}
					if (nivelMatch) {
						nivelGen = nivelMatch[1];
					}
					if (leccionMatch) {
						leccionGen = leccionMatch[1];
					}

					if (line === '---') {
						prop = false;
					}
				}

				if (line.trim() === 'tags:' || line.trim() === 'Tags:') {
					bandTags = true
				}
			}
			else{
				if (bandCard) {

					if (line.trim().length == 0) {
						//Envio de tajeta 
						// Encontrar notas ya creadas
						const patternId = /\^(\d+)$/; // ^ seguido de uno o más números al final de la cadena
						const matchUpdate = postCard.match(patternId);

						const modelTemp = typeCard == 'b' ? 'Ingles basico': 'Ingles invertido';
												
						if (matchUpdate) {
							// Extrae el número después de ^
							updateIdNote = Number(matchUpdate[1]);
							// Elimina ^xxxxx del string original
							postCard = postCard.replace(patternId, '');
							const updateNote = await this.updateDeck(preCard, postCard, origenGen, nivelGen, leccionGen, modelTemp, tagsGen.concat(tagsInd), updateIdNote);
							updateNote ? contUpdate++ : null;
						} else {
							//Si tiene deck global o tiene deck unico
							const deckTemp = deckInd || deckGen;
							
							const addNote = await this.addNote(preCard, postCard, origenGen, nivelGen, leccionGen, deckTemp, modelTemp, tagsGen.concat(tagsInd), decksAnki);

							if (addNote.newDeck.trim().length > 0) {
								decksAnki.push(addNote.newDeck);
							}
							if(addNote.id !== -1){
								const addtext = postCard.replace(/^.*?\n/, '');
								textAll = textAll + '\n' + addtext +'\t^' + addNote.id;
								contAdd ++;
								//paraTemp.push(addNote.json);
							}
						}

						//---------------
						bandCard = false;
						preCard = '';
						typeCard = '';
					}
					postCard = postCard + '\n' + line;
				}
				else{

					firstMatch = { pattern: -1, index: -1 }

					// Busca la primera coincidencia
					regex.forEach(function(pattern, indexP) {
						const matchIndex = line.search(pattern);
						
						// Si encontramos una coincidencia y es la primera o la más temprana encontrada
						if (matchIndex !== -1 && (firstMatch.index === -1 || matchIndex < firstMatch.index)) {
							firstMatch = { pattern: indexP, index: matchIndex };

						}
					});

					switch (firstMatch.pattern) {
						case 0:
							let matchOclusion = line.match(regexOclusion) || [];
							let lineTemp = line;
							matchOclusion.forEach(element => {
								if(!element.match(/::/)){
									const palabra = element.replace('{{', '').replace('}}','');
									lineTemp = line.replace(`{{${palabra}}}`, `{{c1::${palabra}}}`);// Agregar c1:: si no está presente
								}
							});
							
							// Buscar palabras entre || al final de la línea si no fueron capturadas
							const deckOclusionMatch = lineTemp.match(/\|\|(.+?)\|\|/);
							if (deckOclusionMatch) {
								deckInd = deckOclusionMatch[1].trim() ;  // Capturar el texto entre los pipes
								lineTemp = lineTemp.replace(/\|\|(.+?)\|\|/g, '');  // Eliminar las palabras entre pipes de la línea
							}

							// Buscar palabras que comienzan con #
							tagsInd = [...lineTemp.matchAll(/#(\w+)/g)].map(matchTagsOclusion => matchTagsOclusion[1]);
					
							// Eliminar las palabras con # del texto procesado
							lineTemp = lineTemp.replace(/#\w+/g, '').trim();

							const patternOclusionId = /\^(\d+)$/; // ^ seguido de uno o más números al final de la cadena
							const matchUpdateOclusion = lineTemp.match(patternOclusionId);
							
							if (matchUpdateOclusion) {
								// Extrae el número después de ^
								updateIdNote = Number(matchUpdateOclusion[1]);
								// Elimina ^xxxxx del string original
								lineTemp = lineTemp.replace(patternOclusionId, '');

								const updateNote = await this.updateDeck(lineTemp, '', origenGen, nivelGen, leccionGen, 'Ingles oclusion', tagsGen.concat(tagsInd), updateIdNote);
								updateNote ? contUpdate++ : null;

							} else {
								//Si tiene deck global o tiene deck unico
								const deckTemp = deckInd || deckGen;
								
								const addNote = await this.addNote(lineTemp, '', origenGen, nivelGen, leccionGen, deckTemp, 'Ingles oclusion', tagsGen.concat(tagsInd), decksAnki);

								if (addNote.newDeck.trim().length > 0) {
									decksAnki.push(addNote.newDeck);
								}
								if(addNote.id !== -1){
									line = line + '\t^' + addNote.id;
									contAdd ++;
								}
							}	
						break;

						case 1:
						case 2:
							let modelTemp = firstMatch.pattern == 1 ? 'Ingles invertido' : 'Ingles basico';
							let matchInlineBasica = firstMatch.pattern == 2 ? line.match(regexInlBas) || [] : line.match(regexInlInv) || [];
							antes = matchInlineBasica[1].trim() || '';    // Capturar el texto inmediatamente antes de #card
							despues = matchInlineBasica[2].trim() || ''; // Capturar el texto después de #card
							// Extraer el texto entre || antes de #card
							deckInd = despues.match(/\|\|([\s\S]+?)\|\|/)?.[1] || '';
							// Eliminar el texto entre || del bloque antes
							despues = despues.replace(/\|\|([\s\S]+?)\|\|/g, '').trim();

							// Extraer las palabras que comienzan con # después de #card
							tagsInd = despues.match(/#\w+/g) || [];
							// Eliminar las palabras que empiezan con # del bloque después
							despues = despues.replace(/#\w+/g, '').trim();
							// Encontrar notas ya creadas
							const patternId = /\^(\d+)$/; // ^ seguido de uno o más números al final de la cadena
							const matchUpdate = despues.match(patternId);
							
							if (matchUpdate) {
								// Extrae el número después de ^
								updateIdNote = Number(matchUpdate[1]);
								// Elimina ^xxxxx del string original
								despues = despues.replace(patternId, '');

								const updateNote = await this.updateDeck(antes, despues, origenGen, nivelGen, leccionGen, modelTemp, tagsGen.concat(tagsInd), updateIdNote);
								updateNote ? contUpdate++ : null;

							} else {
								//Si tiene deck global o tiene deck unico
								const deckTemp = deckInd || deckGen;
								
								const addNote = await this.addNote(antes, despues, origenGen, nivelGen, leccionGen, deckTemp, modelTemp, tagsGen.concat(tagsInd), decksAnki);

								if (addNote.newDeck.trim().length > 0) {
									decksAnki.push(addNote.newDeck);
								}
								if(addNote.id !== -1){
									line = line + '\t^' + addNote.id;
									contAdd ++;
								}
							}
						break;
						
						case 3:
						case 4:
							let matchInvertido = firstMatch.pattern == 3 ? line.match(regexBasico) || [] : line.match(regexInvertido) || [];
							postCard = '';
							antes = matchInvertido[1].trim() || '';    // Capturar el texto inmediatamente antes de #card
							despues = matchInvertido[2].trim() || ''; // Capturar el texto después de #card

							// Extraer el texto entre || antes de #card
							deckInd = antes.match(/\|\|([\s\S]+?)\|\|/)?.[1] || '';
							// Eliminar el texto entre || del bloque antes
							preCard = preCard + '\n' + antes.replace(/\|\|([\s\S]+?)\|\|/g, '').trim();

							// Extraer las palabras que comienzan con # después de #card
							tagsInd = despues.match(/#\w+/g) || [];
							// Eliminar las palabras que empiezan con # del bloque después
							postCard = despues.replace(/#\w+/g, '').trim();

							typeCard = firstMatch.pattern == 3 ? 'b' : 'i';

							bandCard = true;
							bandAddCard = true;
						break;

						case 5:
							let matchDelete= line.match(regexDelete) ||[];
							idDelete = Number(matchDelete[1]);
							const deleteNote = await this.deleteNote(idDelete);
							if (deleteNote) {
								contDelete ++;
								bandAddLine = false;
							}
						break;

						default:
							break;
					}

					if (line.trim().length == 0) {
						preCard = '';
					}
					if (!bandCard) {
						preCard = preCard.trim() + '\n' + line.trim();
					}

					
				}
			}	

			//Identifica las propiedades
			if (index == 0) {
				if (line == '---') {
					prop = true;
				}
				textAll = line;	
			}
			else {
				if((bandAddLine && !bandCard) || bandAddCard) {
					textAll = textAll + '\n' + line;
					bandAddCard = false
				}
			}

			bandAddLine = true;

			index++;
		}
		
		activeView.editor.setValue(textAll)

		return {add:contAdd, update:contUpdate, delete:contDelete};
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

		const cleanedText = htmlContent.replace(/\n/g, '');
	
		return cleanedText;
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
		
		//containerEl.createEl('h1', { text: 'Configuración de AnkiObsidian' });

		
		containerEl.createEl('h4', { text: 'Configuración general' });

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
            .setName('Deck Pedeterminado')
            .setDesc('Deck en el que se almacenaran las tarjetas creadas en caso de no igresar un deck')
            .addText(text => text
                .setPlaceholder('Ingresa una palabra')
                .setValue(this.plugin.settings.deckDefault)
                .onChange(async (value) => {
                    this.plugin.settings.deckDefault = value;
                    await this.plugin.saveSettings();
                }));

		containerEl.createEl('h4', { text: 'Configuración de notas' });

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