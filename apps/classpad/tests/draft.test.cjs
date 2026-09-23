"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {test} = require("node:test");
const source = fs.readFileSync(require.resolve("../source/main.js"), "utf8");

function harness(storage = new Map()) {
  let markdown = "Texte sans sujet et $x^2$";
  let response = async () => ({ok:true, json:async () => ({filename:"notes.md"})});
  const context = vm.createContext({
    localStorage:{getItem:key => storage.get(key) ?? null,
      setItem:(key, value) => storage.set(key, value), removeItem:key => storage.delete(key)},
    course:{value:"Maths", disabled:false}, title:{value:""}, status:{},
    padCourse:"Maths", loadedPad:null,
    exportToMarkdown:() => markdown,
    normalizeMarkdownEnd:text => text,
    identifyImportedFormulae:text => ({source:text, formulae:[]}),
    renderMarkdown:text => { markdown = text; },
    saveInProgress:false, savePending:false, saveIdleResolvers:[],
    URLSearchParams, fetch:() => response(), loadCourseFiles:() => {},
    scheduleTitleRename:() => {}, clearTimeout:() => {}, setTimeout:() => 1,
    saveTimer:null
  });
  vm.runInContext(source.slice(source.indexOf("const draftStorageKey"), source.indexOf("// Thème clair"))
    + source.slice(source.indexOf("function formatLocalDateTime"), source.indexOf("function subjectFilename")), context);
  return {context, storage, run:code => vm.runInContext(code, context),
    text:value => { markdown = value; }, getText:() => markdown,
    response:fn => { response = fn; }};
}

test("untitled text is persisted immediately and restored after reopening", async () => {
  const h = harness();
  h.run("scheduleSave()");
  await h.run("doSave()");
  const reopened = harness(h.storage);
  reopened.text("");
  assert.equal(reopened.run("restoreDraft()"), "Maths");
  assert.equal(reopened.getText(), "Texte sans sujet et $x^2$");
  assert.equal(reopened.context.title.value, "");
});

test("successful disk save removes the draft", async () => {
  const h = harness();
  h.context.title.value = "Sujet";
  h.run("scheduleSave()");
  await h.run("doSave()");
  assert.equal(h.storage.size, 0);
});

test("failed disk save preserves the draft", async () => {
  const h = harness();
  h.context.title.value = "Sujet";
  h.response(async () => { throw new Error("offline"); });
  h.run("scheduleSave()");
  await h.run("doSave()");
  assert.equal(h.storage.size, 1);
});

test("edits during a disk save survive its completion and retain the filename", async () => {
  const h = harness();
  h.context.title.value = "Sujet";
  h.run("scheduleSave()");
  let finish;
  h.response(() => new Promise(resolve => { finish = resolve; }));
  const saving = h.run("doSave()");
  h.text("Texte plus récent");
  h.run("scheduleSave()");
  finish({ok:true, json:async () => ({filename:"notes.md"})});
  await saving;
  const reopened = harness(h.storage);
  reopened.run("restoreDraft()");
  assert.equal(reopened.getText(), "Texte plus récent");
  assert.equal(reopened.context.loadedPad.filename, "notes.md");
});

test("corrupt or inaccessible browser storage does not prevent use", () => {
  const h = harness(new Map([["classpad-unsaved-draft", "invalid JSON"]]));
  assert.equal(h.run("restoreDraft()"), "");
  h.context.localStorage = {getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("full"); }};
  assert.doesNotThrow(() => h.run("scheduleSave(); restoreDraft(); clearDraft('old')"));
});
