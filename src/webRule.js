import { mainSuggest } from "./suggest.js";
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

const overrideTemplate = document.getElementById("overrideTemplate");

const createWebOverrideMarkup = async (savedData, saveFunc) => {
    savedData = savedData || {};
    saveFunc = saveFunc || (() => {});

    let rid = savedData.id;
    if (!rid) {
        const allData = await chrome.storage.local.get({ ruleGroups: [] });
        rid = getNextRuleId(allData.ruleGroups);
    }
    const override = instanceTemplate(overrideTemplate);
    override.id = `r${rid}`;
    const matchInput = override.querySelector(".matchInput");
    const replaceInput = override.querySelector(".replaceInput");
    const noteInput = override.querySelector(".noteInput");
    const noteLabel = override.querySelector(".noteLabel");
    const ruleOnOff = override.querySelector(".onoffswitch-checkbox");
    const deleteBtn = override.querySelector(".sym-btn");

    matchInput.value = savedData.match || "";
    noteInput.value = savedData.note || "";
    noteLabel.textContent = savedData.note || "规则";
    replaceInput.value = savedData.replace || "";
    makeFieldRequired(matchInput);
    makeFieldRequired(replaceInput);
    ruleOnOff.checked = savedData.on === false ? false : true;

    if (savedData.on === false) {
        override.classList.add("disabled");
    }

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

    // 在 DevTools 中：点击 From 输入框时，若匹配当前请求，展示候选并可一键填充
    if (chrome.devtools && chrome.devtools.inspectedWindow) {
        matchInput.addEventListener("focus", () => {
            const regex = buildRegexFromMatch(matchInput.value || "");
            if (!regex) { return; }
            getTabResources((resources) => {
                const matched = resources.filter(u => regex.test(u));
                if (!matched.length) return;
                // 简易下拉：复用 suggest 机制（填充选项列表）
                mainSuggest.fillOptions(matched.slice(0, 50));
            });
        });
    }

    matchInput.addEventListener("keyup", saveFunc);
    noteInput.addEventListener("keyup", saveFunc);
    replaceInput.addEventListener("keyup", saveFunc);

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

export default createWebOverrideMarkup;
