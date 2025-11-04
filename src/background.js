/* globals chrome */
import setupNetRequestRules from "./netRequestRules.js";

let allRuleGroups = [];
const reloadData = async () => {
    const existingData = await chrome.storage.local.get({ ruleGroups: [] });
    allRuleGroups = existingData.ruleGroups;
};
reloadData();

const updateAllRules = async () => {
    // 清除所有现有规则
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(rule => rule.id);
    
    if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: existingRuleIds,
            addRules: []
        });
    }
    
    // 为每个启用的规则组重新设置规则
    // 注意：这里我们不传递deletedRuleIds，因为我们已经清除了所有规则
    for (const group of allRuleGroups) {
        if (group.on) {
            // 创建一个临时组，只包含启用的规则
            const enabledGroup = {
                ...group,
                rules: (group.rules || []).filter(rule => rule.on)
            };
            await setupNetRequestRules(enabledGroup, [], {});
        }
    }
};

const actions = {
    sync: async () => {
        await reloadData();
        await updateAllRules();
    }
};

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.log("BG ON MESSAGE!", request);
    let sentResponse = false;
    const mySendResponse = (...args) => {
        sentResponse = true;
        sendResponse(...args);
    };
    const action = actions[request.action];
    if (action) {
        await action(request, sender, mySendResponse);
        if (!sentResponse) {
            sendResponse();
        }
        // !!!Important!!! Need to return true for sendResponse to work.
        return true;
    }
    console.error(`BG message handler: No action named ${request.action}`);
});

chrome.action.onClicked.addListener(function() {
    // open or focus options page.
    const optionsUrl = chrome.runtime.getURL("src/devtoolstab.html");
    chrome.tabs.query({}, function(extensionTabs) {
        let found = false;
        for (let i = 0, len = extensionTabs.length; i < len; i++) {
            if (optionsUrl === extensionTabs[i].url) {
                found = true;
                chrome.tabs.update(extensionTabs[i].id, {selected: true});
                break;
            }
        }
        if (found === false) {
            chrome.tabs.create({url: optionsUrl});
        }
    });
});

console.log("hi bg9");

// eslint-disable-next-line no-unused-vars
const urlMatches = (matchStr, url) => {
    const result = transformMatchReplace(matchStr);
    let regex;
    try {
        regex = new RegExp(result.match);
    } catch {}
    return regex && regex.test(url);
};

// TODO: This code will probably get me denied
chrome.webNavigation.onCommitted.addListener((details) => {
    allRuleGroups.forEach((ruleGroup) => {
        // 全局禁用时，不注入
        // 注：这里用 storage 读取一次即可，注入点频率不高
        chrome.storage.local.get({ globalDisabled: false }).then(({ globalDisabled }) => {
            if (globalDisabled) return;
        if (ruleGroup.on) {
            const groupMatch = ruleGroup.matchUrl || ruleGroup.name || "";
            const groupOk = groupMatch ? urlMatches(groupMatch, details.url) : true;
            if (!groupOk) {
                return;
            }
            const rules = ruleGroup.rules || [];
            rules.forEach((rule) => {
                if (rule.on && rule.type === "fileInject" && urlMatches(rule.match, details.url)) {
                    if (rule.fileType === "js") {
                        chrome.scripting.executeScript({
                            target: { tabId: details.tabId, frameIds: [details.frameId] },
                            // injectImmediately: true,
                            func: code => {
                                const el = document.createElement('script');
                                el.textContent = code;
                                document.head.appendChild(el);
                                el.remove();
                            },
                            args: [rule.file],
                            world: 'MAIN',
                        });
                    } else if (rule.fileType === 'css') {
                        chrome.scripting.insertCSS({
                            target: { tabId: details.tabId },
                            css: rule.file,
                            origin: "USER"
                        });
                    }
                }
            });
        }
        });
    });
});
