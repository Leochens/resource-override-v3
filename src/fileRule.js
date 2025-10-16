import { mainSuggest } from "./suggest.js";
import { buildRegexFromMatch, getTabResources } from "./util.js";
import { openEditor } from "./editor.js";
import {
    instanceTemplate,
    getNextRuleId,
    makeFieldRequired,
    deleteButtonIsSure,
    deleteButtonIsSureReset,
    fadeOut
} from "./util.js";

/* globals chrome */

const fileOverrideTemplate = document.getElementById("fileOverrideTemplate");

const createFileOverrideMarkup = async (savedData, saveFunc) => {
    savedData = savedData || {};
    saveFunc = saveFunc || (() => {});

    let rid = savedData.id;
    if (!rid) {
        const allData = await chrome.storage.local.get({ ruleGroups: [] });
        rid = getNextRuleId(allData.ruleGroups);
    }
    const override = instanceTemplate(fileOverrideTemplate);
    override.id = `r${rid}`;
    const matchInput = override.querySelector(".matchInput");
    const editBtn = override.querySelector(".edit-btn");
    const noteInput = override.querySelector(".noteInput");
    const noteLabel = override.querySelector(".noteLabel");
    const ruleOnOff = override.querySelector(".onoffswitch-checkbox");
    const deleteBtn = override.querySelector(".sym-btn");

    matchInput.value = savedData.match || "";
    noteInput.value = savedData.note || "";
    noteLabel.textContent = savedData.note || "规则";
    makeFieldRequired(matchInput);
    ruleOnOff.checked = savedData.on === false ? false : true;

    if (savedData.on === false) {
        override.classList.add("disabled");
    }

    editBtn.addEventListener("click", () => {
        openEditor(rid, matchInput.value, false);
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
            saveFunc({ removeIds: [rid] });
        }, 300);
    });

    deleteBtn.addEventListener("mouseout", () => {
        deleteButtonIsSureReset(deleteBtn);
    });

    mainSuggest.init(matchInput);
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
                mainSuggest.fillOptions(matched.slice(0, 50));
            });
        });
    }

    matchInput.addEventListener("keyup", saveFunc);
    if (chrome.devtools && chrome.devtools.inspectedWindow) {
        const updateHighlight = () => {
            const regex = buildRegexFromMatch(matchInput.value || "");
            if (!regex) { override.classList.remove("proxy-hit"); return; }
            getTabResources((resources) => {
                const matched = resources.filter(u => regex.test(u));
                if (ruleOnOff.checked && matched.length) {
                    override.classList.add("proxy-hit");
                } else {
                    override.classList.remove("proxy-hit");
                }
            });
        };
        matchInput.addEventListener("focus", updateHighlight);
        matchInput.addEventListener("keyup", updateHighlight);
        ruleOnOff.addEventListener("change", updateHighlight);
    }
    noteInput.addEventListener("keyup", saveFunc);
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

    return override;
};

export default createFileOverrideMarkup;
