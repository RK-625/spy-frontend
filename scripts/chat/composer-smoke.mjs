/** Run against a dev server: node_modules/.bin/electron scripts/chat/composer-smoke.mjs
 * Uses temporary Electron storage and mocked APIs; never writes test chats to Spy's stores.
 */
import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composerFixtureSource } from "./composer-fixture.mjs";

const storage = mkdtempSync(join(tmpdir(), "spy-composer-qa-"));
console.log("Starting Electron composer smoke checks");
app.setPath("userData", storage);
app.setName("Spy Composer QA");
const timeout = setTimeout(() => { console.error("Composer smoke test timed out"); app.exit(1); }, 90000);
let window;

const evaluate = (expression) => window.webContents.executeJavaScript(expression, true);
const waitFor = async (expression) => evaluate(`new Promise((resolve, reject) => {
  const deadline = Date.now() + 12000;
  function check() { if (${expression}) return resolve(true); if (Date.now() > deadline) return reject(new Error(${JSON.stringify(`Timed out: ${expression}`)})); setTimeout(check, 25); }
  check();
})`);
const editor = 'document.querySelector(".prompt-markdown-editor [contenteditable=true]")';
const value = 'document.querySelector("input[name=message]").value';
const quoteCount = 'document.querySelectorAll("[aria-label^=\\"Remove quote from\\"]").length';
const switchChat = async (id) => {
  await evaluate(`history.pushState({...history.state,chatId:${JSON.stringify(id)}},"","/chat?c="+${JSON.stringify(id)});dispatchEvent(new PopStateEvent("popstate",{state:history.state}));`);
  await waitFor(`location.search.includes(${JSON.stringify(id)}) && document.querySelector("[data-message-id=qa-assistant]")`);
  await waitFor(editor);
};
const selectExcerpt = async () => {
  await evaluate(`{ const p=document.querySelector("[data-message-id=qa-assistant] p"); const r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r); }`);
  await waitFor('document.querySelector("[aria-label=\\"Selected text actions\\"]")');
};
const action = async (label) => evaluate(`Array.from(document.querySelectorAll("[role=toolbar] button")).find(button => button.textContent.includes(${JSON.stringify(label)})).click()`);
const paste = async (text, html = "") => {
  await evaluate(`${editor}.focus()`);
  window.webContents.sendInputEvent({ type: "keyDown", keyCode: "A", modifiers: ["meta"] });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode: "A", modifiers: ["meta"] });
  await evaluate('new Promise(resolve => setTimeout(resolve, 40))');
  await evaluate(`{const view=${editor};${text || html ? `const data=new DataTransfer();data.setData("text/plain",${JSON.stringify(text)});${html ? `data.setData("text/html",${JSON.stringify(html)});` : ""}view.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:data}));` : 'document.execCommand("delete");'}}`);
};
const enter = async (composing = false, shift = false) => evaluate(`${editor}.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",code:"Enter",bubbles:true,cancelable:true,isComposing:${composing},shiftKey:${shift}}))`);

app.whenReady().then(async () => {
console.log("Electron ready; opening composer fixture");
try {
  window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, partition: "composer-qa" } });
  await window.loadURL("about:blank");
  window.webContents.debugger.attach("1.3");
  await window.webContents.debugger.sendCommand("Page.enable");
  await window.webContents.debugger.sendCommand("Page.addScriptToEvaluateOnNewDocument", { source: composerFixtureSource });
  await window.loadURL(`${process.env.SPY_URL ?? "http://localhost:3002"}/chat?c=composer-qa`);
  await waitFor(editor);
  await waitFor('document.querySelector("[data-message-id=qa-assistant]")');

  await paste("Draft stays intact");
  await selectExcerpt(); await action("Copy");
  await waitFor('window.__composerQA.clipboard.length === 1');
  assert.equal(await evaluate("window.__composerQA.clipboard[0]"), "Select this excerpt to ask a follow-up.");
  await action("Add to chat");
  await waitFor(`${quoteCount} === 1`);
  assert.equal(await evaluate(value), "Draft stays intact\n");
  assert.equal(await evaluate(`document.activeElement === ${editor}`), true);
  await selectExcerpt(); await action("Add to chat");
  assert.equal(await evaluate(quoteCount), 1);
  console.log("PASS: selection copy, quote chips, deduplication and rich-editor focus");

  await selectExcerpt();
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Tab",bubbles:true,cancelable:true}))');
  assert.equal(await evaluate('document.activeElement.textContent.includes("Add to chat")'), true);
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));getSelection().removeAllRanges()');
  await waitFor('!document.querySelector("[role=toolbar]")');
  await evaluate('{const r=document.createRange();r.setStart(document.querySelector("[data-message-id=qa-user] p").firstChild,0);r.setEnd(document.querySelector("[data-message-id=qa-assistant] p").firstChild,6);getSelection().addRange(r)}');
  await evaluate('new Promise(resolve => setTimeout(resolve, 60))');
  assert.equal(await evaluate('Boolean(document.querySelector("[role=toolbar]"))'), false);
  await paste("Draft stays intact");
  assert.equal(await evaluate('Boolean(document.querySelector("[role=toolbar]"))'), false);

  await window.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await evaluate('{const surface=Array.from(document.querySelectorAll("[data-message-id=qa-assistant] p")).at(-1);const r=document.createRange();r.selectNodeContents(surface);getSelection().removeAllRanges();getSelection().addRange(r)}');
  await waitFor('document.querySelector("[role=toolbar]")');
  assert.equal(await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  assert.equal(await evaluate('{const r=document.querySelector("[role=toolbar]").getBoundingClientRect();r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight}'), true);
  await action("Add to chat");
  await waitFor(`${quoteCount} === 2`);
  await evaluate('Array.from(document.querySelectorAll("[aria-label^=\\"Preview quote from\\"]")).at(-1).click()');
  await waitFor('document.querySelector("[data-slot=popover-content]")?.textContent.includes("Long excerpt preview")');
  await evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
  await evaluate('Array.from(document.querySelectorAll("[aria-label^=\\"Remove quote from\\"]")).at(-1).click()');
  await waitFor(`${quoteCount} === 1`);
  console.log("PASS: keyboard access, selection boundaries, viewport positioning, long preview and reduced motion");

  await evaluate("window.__composerQA.clipboardFails=true");
  await selectExcerpt(); await action("Copy");
  await waitFor('document.body.innerText.includes("Couldn’t copy") || document.body.innerText.includes("Couldn\'t copy")');
  await evaluate("window.__composerQA.clipboardFails=false;getSelection().removeAllRanges()");
  await paste("");
  await waitFor(`${value} === ""`);
  await evaluate('document.querySelector("form").requestSubmit()');
  assert.equal(await evaluate(quoteCount), 1);
  assert.equal(await evaluate("window.__composerQA.sent.length"), 0);
  console.log("PASS: clipboard failure feedback and refused submission retain quotes");

  await paste("Persisted draft");
  await switchChat("composer-qa-other");
  await waitFor(`${value} === "" && ${quoteCount} === 0`);
  await switchChat("composer-qa");
  await waitFor(`${value}.includes("Persisted draft") && ${quoteCount} === 1`);
  await window.loadURL(window.webContents.getURL());
  await waitFor(`${editor} && ${value}.includes("Persisted draft") && ${quoteCount} === 1`);
  console.log("PASS: drafts and quotes survive chat switches and cold reload");

  await paste("Immediate send sentinel"); await enter();
  await waitFor("window.__composerQA.sent.length === 1");
  assert.match(await evaluate("window.__composerQA.sent[0].messages.at(-1).parts[0].text"), /> \*\*Spy:\*\*[\s\S]*Immediate send sentinel$/);
  await waitFor(`${value} === "" && ${quoteCount} === 0`);
  console.log("PASS: immediate Enter includes current text and clears accepted quotes");

  await paste("- First item"); await enter();
  assert.equal(await evaluate('document.querySelectorAll(".prompt-markdown-editor li").length'), 2);
  await paste("```ts\nconst answer = 42;\n```"); await enter();
  assert.equal(await evaluate("window.__composerQA.sent.length"), 1);
  assert.equal(await evaluate('Boolean(document.querySelector(".prompt-markdown-editor pre"))'), true);
  await paste("| Action | Result |\n| --- | --- |\n| Edit | Update |\n");
  assert.equal(await evaluate('document.querySelectorAll(".prompt-markdown-editor th").length'), 2);
  await paste("Action\tResult\nEdit\tUpdate", "<table><tr><th>Action</th><th>Result</th></tr><tr><td>Edit</td><td><strong>Update</strong></td></tr></table>");
  assert.equal(await evaluate('document.querySelector(".prompt-markdown-editor strong").textContent'), "Update");
  await enter();
  assert.equal(await evaluate("window.__composerQA.sent.length"), 1);
  console.log("PASS: list/code/table Enter edits blocks; Markdown and HTML paste retain formatting");

  await paste("IME stays unsent"); await enter(true);
  assert.equal(await evaluate("window.__composerQA.sent.length"), 1);
  await evaluate(`{const view=${editor};const data=new DataTransfer();data.items.add(new File(["qa"],"composer-qa.txt",{type:"text/plain"}));view.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:data}));}`);
  await waitFor('document.querySelector("[aria-label=\\"Remove attachment\\"]")');
  await evaluate('document.querySelector("[aria-label=\\"Remove attachment\\"]").click()');
  await evaluate(`{const data=new DataTransfer();data.items.add(new File(["drop"],"composer-drop.txt",{type:"text/plain"}));${editor}.dispatchEvent(new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:data}));}`);
  await waitFor('document.querySelector("[aria-label=\\"Remove attachment\\"]")');
  await evaluate('document.querySelector("[aria-label=\\"Remove attachment\\"]").click()');
  await paste("Before voice");
  await evaluate('window.__composerQA.speech.dispatchEvent(Object.assign(new Event("result"),{resultIndex:0,results:[{0:{transcript:"voice appended"},length:1,isFinal:true}]}))');
  await waitFor(`${value}.includes("voice appended") && ${editor}.textContent.includes("voice appended")`);
  console.log("PASS: IME does not send; file paste and speech synchronize with the draft");

  await paste("Undo baseline");
  await evaluate('new Promise(resolve => setTimeout(resolve, 600))');
  await window.webContents.insertText(" edited");
  await waitFor(`${value}.includes(" edited")`);
  window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Z", modifiers: ["meta"] });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Z", modifiers: ["meta"] });
  await waitFor(`${value}.trim() === "Undo baseline"`);
  window.webContents.sendInputEvent({ type: "keyDown", keyCode: "Z", modifiers: ["meta", "shift"] });
  window.webContents.sendInputEvent({ type: "keyUp", keyCode: "Z", modifiers: ["meta", "shift"] });
  await waitFor(`${value}.includes(" edited")`);
  await enter(false, true);
  assert.equal(await evaluate("window.__composerQA.sent.length"), 1);
  console.log("PASS: native typing, Undo/Redo and Shift+Enter preserve editing behavior");

  await switchChat("composer-qa-forced");
  await waitFor('document.body.innerText.includes("Which action?")');
  await selectExcerpt(); await action("Add to chat");
  assert.equal(await evaluate(`${editor}.closest("[hidden]") !== null`), true);
  await evaluate('document.querySelector("form").requestSubmit()');
  assert.equal(await evaluate("window.__composerQA.sent.length"), 1);
  assert.equal(await evaluate(quoteCount), 1);
  await evaluate('Array.from(document.querySelectorAll("button")).find(button => button.textContent.trim() === "Edit content").click()');
  await waitFor("window.__composerQA.sent.length === 2");
  assert.match(await evaluate("window.__composerQA.sent.at(-1).messages.at(-1).parts[0].text"), /Q: Which action\?\nA: Edit content$/);
  assert.match(await evaluate("window.__composerQA.sent.at(-1).messages.at(-1).parts[0].text"), /> \*\*Spy:\*\*/);
  await waitFor(`${quoteCount} === 0`);
  await switchChat("composer-qa-custom");
  await waitFor('document.body.innerText.includes("Which action?")');
  await selectExcerpt(); await action("Add to chat");
  await paste("Custom answer"); await enter();
  await waitFor("window.__composerQA.sent.length === 3");
  assert.match(await evaluate("window.__composerQA.sent.at(-1).messages.at(-1).parts[0].text"), /Q: Which action\?\nA: Custom answer$/);
  await waitFor(`${quoteCount} === 0`);
  console.log("PASS: forced-choice answers include quotes without bypassing answer validation");
  console.log("All Electron composer smoke checks passed.");
} catch (error) {
  console.error(error);
  console.error(await evaluate('JSON.stringify({url:location.href,fixture:typeof window.__composerQA,text:document.body.innerText.slice(-1800)})').catch(() => "Renderer unavailable"));
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  window?.destroy();
  rmSync(storage, { recursive: true, force: true });
  app.exit(process.exitCode ?? 0);
}
});
