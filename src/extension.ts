'use strict';
import { Block } from './block';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {

  // Built-in default templates
  const defaultTemplates = {
    "Trailing comments #": "(?<=\\S.*)\\s+#",
    "Trailing comments //": "(?<=\\S.*)\\s+//",
    "abc": "=|,|:"
  };

  let lastInput: string;

  let alignByRegex = vscode.commands.registerTextEditorCommand('align.regex', async (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, args: any[]) => {
    let userTemplates = vscode.workspace.getConfiguration().get('align.regex.templates');
    // Merge defaults with user templates (user templates override defaults)
    let templates = Object.assign({}, defaultTemplates, userTemplates);
    let templateNames = templates ? Object.keys(<any>templates) : [];

    let input: string | undefined;

    // Show template selection if templates are available
    if (templateNames.length > 0) {
      input = await vscode.window.showQuickPick(templateNames, {
        placeHolder: 'Select a template or press Escape to enter a regular expression.',
        canPickMany: false
      });

      // If user didn't select, fall back to input box
      if (input === undefined) {
        input = await vscode.window.showInputBox({ prompt: 'Enter regular expression or template name.', value: lastInput });
      }
    } else {
      input = await vscode.window.showInputBox({ prompt: 'Enter regular expression or template name.', value: lastInput });
    }

    if (input !== undefined && input.length > 0) {
      lastInput = input;
      let regexPattern = input;
      if (templates !== undefined) {
        let template = (<any>templates)[input];
        if (template !== undefined) {
          regexPattern = template as string;
        }
      }

      let textDocument = textEditor.document;
      let selections = textEditor.selections;

      // Collect all lines that need to be aligned (both selected and cursor-only lines)
      let linesToAlign = new Map<number, vscode.Selection>();

      for (let selection of selections) {
        if (!selection.isEmpty) {
          // Non-empty selection: add all lines in the range
          let startLine = selection.start.line;
          let endLine = selection.end.line;
          if (selection.end.character === 0) {
            endLine--;
          }
          for (let line = startLine; line <= endLine; line++) {
            linesToAlign.set(line, selection);
          }
        } else {
          // Empty selection (cursor-only): add the cursor's line
          linesToAlign.set(selection.active.line, selection);
        }
      }

      if (linesToAlign.size > 0) {
        // Get all line numbers to align, sorted
        let lineNumbers = Array.from(linesToAlign.keys()).sort((a, b) => a - b);

        // Collect text only from lines that have cursors or selections
        let textLines: string[] = [];
        for (let lineNum of lineNumbers) {
          textLines.push(textDocument.lineAt(lineNum).text);
        }
        let text = textLines.join(textDocument.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n');

        // Create and align the block with startLine = 0 (we'll map back to actual line numbers)
        let block: Block = new Block(text, regexPattern, 0, textDocument.eol).trim().align();

        await textEditor.edit(e => {
          // Apply replacements for aligned lines
          for (let blockLineIndex = 0; blockLineIndex < block.lines.length; blockLineIndex++) {
            let line = block.lines[blockLineIndex];
            let actualLineNumber = lineNumbers[blockLineIndex];

            let deleteRange = new vscode.Range(new vscode.Position(actualLineNumber, 0), new vscode.Position(actualLineNumber, textDocument.lineAt(actualLineNumber).range.end.character));
            let replacement: string = '';
            for (let part of line.parts) {
              replacement += part.value;
            }
            e.replace(deleteRange, replacement);
          }
        });
      }
    }
  });
  context.subscriptions.push(alignByRegex);
}

// this method is called when your extension is deactivated
export function deactivate() {
}