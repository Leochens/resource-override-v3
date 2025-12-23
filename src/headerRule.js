import { mainSuggest } from "./suggest.js";
import { buildRegexFromMatch, getTabResources } from "./util.js";
import { openHeaderEditor, getHeaderEditRules } from "./headerEditor.js";
import {
    instanceTemplate,
    getNextRuleId,
    makeFieldRequired,
    deleteButtonIsSure,
    deleteButtonIsSureReset,
    fadeOut
} from "./util.js";

/* globals chrome */

const headerRuleTemplate = document.getElementById("headerRuleTemplate");

// This is what shows up *outside* the header editor.
const createHeaderRuleMarkup = async (savedData, saveFunc) => {
    savedData = savedData || {};
    saveFunc = saveFunc || (() => {});

    let rid = savedData.id;
    if (!rid) {
        const allData = await chrome.storage.local.get({ ruleGroups: [] });
        rid = getNextRuleId(allData.ruleGroups);
    }
    const override = instanceTemplate(headerRuleTemplate);
    override.id = `r${rid}`;
    const matchInput = override.querySelector(".matchInput");
    const noteInput = override.querySelector(".noteInput");
    const noteLabel = override.querySelector(".noteLabel");
    const requestRulesInput = override.querySelector(".requestRules");
    const responseRulesInput = override.querySelector(".responseRules");
    const editBtn = override.querySelector(".edit-btn");
    const ruleOnOff = override.querySelector(".onoffswitch-checkbox");
    const deleteBtn = override.querySelector(".sym-btn");

    matchInput.value = savedData.match || "";
    noteInput.value = savedData.note || "";
    noteLabel.textContent = savedData.note || "规则";
    makeFieldRequired(matchInput);

    const updateHeaderInput = (input, ruleStr) => {
        input.value = decodeURIComponent(ruleStr.replace(/\;/g, "; "));
        input.setAttribute("title", decodeURIComponent(ruleStr.replace(/\;/g, "\n")));
        input.dataset.rules = ruleStr;
    };

    updateHeaderInput(requestRulesInput, savedData.requestRules || "");
    updateHeaderInput(responseRulesInput, savedData.responseRules || "");

    ruleOnOff.checked = savedData.on === false ? false : true;

    if (savedData.on === false) {
        override.classList.add("disabled");
    }

    const editorSaveFunc = () => {
        const rules = getHeaderEditRules();
        updateHeaderInput(requestRulesInput, rules.requestRules.join(";"));
        updateHeaderInput(responseRulesInput, rules.responseRules.join(";"));
        saveFunc();
    };

    const editFunc = () => {
        const reqStr = requestRulesInput.dataset.rules || "";
        const resStr = responseRulesInput.dataset.rules || "";
        openHeaderEditor(reqStr, resStr, matchInput.value, editorSaveFunc);
    };

    mainSuggest.init(matchInput);

    matchInput.addEventListener("keyup", saveFunc);
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
        const updateHighlight = () => {
            const regex = buildRegexFromMatch(matchInput.value || "");
            if (!regex) { override.classList.remove("proxy-hit"); return; }
            getTabResources((resources) => {
                const matched = resources.filter(u => regex.test(u));
                mainSuggest.fillOptions(matched.slice(0, 50));
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

    override.addEventListener("click", (e) => {
        if (e.target.classList.contains("headerRuleInput")) {
            editFunc();
        }
    });
    editBtn.addEventListener("click", editFunc);

    deleteBtn.addEventListener("click", () => {
        if (!deleteButtonIsSure(deleteBtn)) {
            return;
        }
        override.style.transition = "none";
        fadeOut(override);
        setTimeout(() => {
            override.remove();
            saveFunc({ removeIds: [rid] });
        }, 300);
    });

    deleteBtn.addEventListener("mouseout", () => {
        deleteButtonIsSureReset(deleteBtn);
    });

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

export default createHeaderRuleMarkup;
