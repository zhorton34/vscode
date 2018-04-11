/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { References } from './peek';
import { Commands } from '../workbench/workbench';
import { Code } from '../../vscode/code';

const RENAME_BOX = '.monaco-editor .monaco-editor.rename-box';
const RENAME_INPUT = `${RENAME_BOX} .rename-input`;
const EDITOR = filename => `.monaco-editor[data-uri$="${filename}"]`;

export class Editor {

	private static readonly VIEW_LINES = '.monaco-editor .view-lines';
	private static readonly LINE_NUMBERS = '.monaco-editor .margin .margin-view-overlays .line-numbers';
	private static readonly FOLDING_EXPANDED = '.monaco-editor .margin .margin-view-overlays>:nth-child(${INDEX}) .folding';
	private static readonly FOLDING_COLLAPSED = `${Editor.FOLDING_EXPANDED}.collapsed`;

	constructor(private code: Code, private commands: Commands) { }

	async findReferences(term: string, line: number): Promise<References> {
		await this.clickOnTerm(term, line);
		await this.commands.runCommand('Find All References');
		const references = new References(this.code);
		await references.waitUntilOpen();
		return references;
	}

	async rename(filename: string, line: number, from: string, to: string): Promise<void> {
		await this.clickOnTerm(from, line);
		await this.commands.runCommand('Rename Symbol');

		await this.code.waitForActiveElement(RENAME_INPUT);
		await this.code.setValue(RENAME_INPUT, to);

		await this.code.dispatchKeybinding('enter');
	}

	async gotoDefinition(term: string, line: number): Promise<void> {
		await this.clickOnTerm(term, line);
		await this.commands.runCommand('Go to Definition');
	}

	async peekDefinition(term: string, line: number): Promise<References> {
		await this.clickOnTerm(term, line);
		await this.commands.runCommand('Peek Definition');
		const peek = new References(this.code);
		await peek.waitUntilOpen();
		return peek;
	}

	async waitForHighlightingLine(line: number): Promise<void> {
		const currentLineIndex = await this.getViewLineIndex(line);
		if (currentLineIndex) {
			await this.code.waitForElement(`.monaco-editor .view-overlays>:nth-child(${currentLineIndex}) .current-line`);
			return;
		}
		throw new Error('Cannot find line ' + line);
	}

	async getSelector(term: string, line: number): Promise<string> {
		const lineIndex = await this.getViewLineIndex(line);
		const classNames = await this.getClassSelectors(term, lineIndex);
		return `${Editor.VIEW_LINES}>:nth-child(${lineIndex}) span span.${classNames[0]}`;
	}

	async foldAtLine(line: number): Promise<any> {
		const lineIndex = await this.getViewLineIndex(line);
		await this.code.waitAndClick(Editor.FOLDING_EXPANDED.replace('${INDEX}', '' + lineIndex));
		await this.code.waitForElement(Editor.FOLDING_COLLAPSED.replace('${INDEX}', '' + lineIndex));
	}

	async unfoldAtLine(line: number): Promise<any> {
		const lineIndex = await this.getViewLineIndex(line);
		await this.code.waitAndClick(Editor.FOLDING_COLLAPSED.replace('${INDEX}', '' + lineIndex));
		await this.code.waitForElement(Editor.FOLDING_EXPANDED.replace('${INDEX}', '' + lineIndex));
	}

	async waitUntilShown(line: number): Promise<void> {
		await this.getViewLineIndex(line);
	}

	async clickOnTerm(term: string, line: number): Promise<void> {
		const selector = await this.getSelector(term, line);
		await this.code.waitAndClick(selector);
	}

	async waitForTypeInEditor(filename: string, text: string, selectorPrefix = ''): Promise<any> {
		const editor = [selectorPrefix || '', EDITOR(filename)].join(' ');

		await this.code.waitForElement(editor);

		const textarea = `${editor} textarea`;
		await this.code.waitForActiveElement(textarea);

		await this.code.typeInEditor(textarea, text);

		await this.waitForEditorContents(filename, c => c.indexOf(text) > -1, selectorPrefix);
	}

	async waitForEditorContents(filename: string, accept: (contents: string) => boolean, selectorPrefix = ''): Promise<any> {
		const selector = [selectorPrefix || '', `${EDITOR(filename)} .view-lines`].join(' ');

		return this.code.waitForTextContent(selector, undefined, c => accept(c.replace(/\u00a0/g, ' ')));
	}

	private async getClassSelectors(term: string, viewline: number): Promise<string[]> {
		const elements = await this.code.waitForElements(`${Editor.VIEW_LINES}>:nth-child(${viewline}) span span`, false, els => els.some(el => el.textContent === term));
		const { className } = elements.filter(r => r.textContent === term)[0];
		return className.split(/\s/g);
	}

	private async getViewLineIndex(line: number): Promise<number> {
		const elements = await this.code.waitForElements(Editor.LINE_NUMBERS, false, els => {
			return els.some(el => el.textContent === `${line}`);
		});

		for (let index = 0; index < elements.length; index++) {
			if (elements[index].textContent === `${line}`) {
				return index + 1;
			}
		}

		throw new Error('Line not found');
	}
}