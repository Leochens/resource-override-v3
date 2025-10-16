import { openEditor } from "./editor.js";
import { buildRegexFromMatch, getTabResources } from "./util.js";
import {
    instanceTemplate,
    getNextRuleId,
    makeFieldRequired,
    deleteButtonIsSure,
    deleteButtonIsSureReset,
    fadeOut
} from "./util.js";

/* globals chrome */

const fileInjectTemplate = document.getElementById("fileInjectTemplate");

const createFileInjectMarkup = async (savedData, saveFunc) => {
    savedData = savedData || {};
    saveFunc = saveFunc || (() => {});

    let rid = savedData.id;
    if (!rid) {
        const allData = await chrome.storage.local.get({ ruleGroups: [] });
        rid = getNextRuleId(allData.ruleGroups);
    }
    const override = instanceTemplate(fileInjectTemplate);
    override.id = `r${rid}`;
    const matchInput = override.querySelector(".matchInput");
    const fileName = override.querySelector(".fileName");
    const fileType = override.querySelector(".fileTypeSelect");
    const editBtn = override.querySelector(".edit-btn");
    const ruleOnOff = override.querySelector(".onoffswitch-checkbox");
    const deleteBtn = override.querySelector(".sym-btn");
    const noteInput = override.querySelector(".noteInput");
    const noteLabel = override.querySelector(".noteLabel");

    matchInput.value = savedData.match || "";
    noteInput.value = savedData.note || "";
    noteLabel.textContent = savedData.note || "规则";
    makeFieldRequired(matchInput);
    fileName.value = savedData.fileName || "";
    fileType.value = savedData.fileType || "js";
    ruleOnOff.checked = savedData.on === false ? false : true;

    if (savedData.on === false) {
        override.classList.add("disabled");
    }

    editBtn.addEventListener("click", () => {
        openEditor(rid, fileName.value, true);
    });

    deleteBtn.addEventListener("click", () => {
        if (!deleteButtonIsSure(deleteBtn)) {
            return;
        }

        override.style.transition = "none";
        fadeOut(override);
        setTimeout(() => {
            override.remove();
            chrome.storage.local.remove(`f${rid}`);
            saveFunc();
        }, 300);
    });

    deleteBtn.addEventListener("mouseout", () => {
        deleteButtonIsSureReset(deleteBtn);
    });

    matchInput.addEventListener("keyup", saveFunc);
    fileName.addEventListener("keyup", saveFunc);
    noteInput.addEventListener("keyup", saveFunc);
    const showNoteEdit = () => {
        noteLabel.style.display = "none";
        noteInput.style.display = "inline-block";
        noteInput.focus();
        noteInput.select();
    };
    const hideNoteEdit = () => {
        const val = noteInput.value || "规则";
        noteLabel.textContent = val;
        noteLabel.style.display = "inline-block";
        noteInput.style.display = "none";
    };
    noteLabel.addEventListener("dblclick", showNoteEdit);
    noteInput.addEventListener("blur", () => { hideNoteEdit(); saveFunc(); });
    noteInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { noteInput.blur(); }
        if (e.key === "Escape") { noteInput.value = savedData.note || ""; noteInput.blur(); }
    });

    if (chrome.devtools && chrome.devtools.inspectedWindow) {
        matchInput.addEventListener("focus", () => {
            const regex = buildRegexFromMatch(matchInput.value || "");
            if (!regex) { return; }
            getTabResources((resources) => {
                const matched = resources.filter(u => regex.test(u));
                if (!matched.length) return;
                // Note: Inject 规则也可参考匹配到的资源 URL
                // 这里仅作为便捷选择
                // 不改变 fileName/fileType
            });
        });
    }
    const changeOnOffSwitch = () => {
        if (ruleOnOff.checked) {
            override.classList.remove("disabled");
        } else {
            override.classList.add("disabled");
        }
        saveFunc();
    };
    ruleOnOff.addEventListener("click", changeOnOffSwitch);
    ruleOnOff.addEventListener("change", changeOnOffSwitch);
    fileType.addEventListener("change", saveFunc);

    return override;
};

export default createFileInjectMarkup;
