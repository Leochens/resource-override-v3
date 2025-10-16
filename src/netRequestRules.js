/* globals chrome */
import globMatchToDNRRegex from "./globMatchToDNRRegex.js";
import extractMimeType from "./extractMime.js";
import { parseHeaderDataStr } from "./util.js";

export const allResourceTypes = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object",
"xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"];

export const transformMatchReplace = (match = "", replace = "") => {
    const trimMatch = match.trim();
    if (trimMatch.length > 2 && trimMatch[0] === "/" && trimMatch[trimMatch.length - 1] === "/") {
        // the match string has the "regex mode" characters, so dont do transform.
        return {
            match: trimMatch.substring(1, trimMatch.length - 1),
            replace
        };
    }
    const result = globMatchToDNRRegex(match, replace);
    result.match = `^${result.match}$`;
    return result;
};

const getInitiatorDomainsFromGroup = (group = {}) => {
    const raw = (group.matchUrl || group.name || "").trim();
    if (!raw) return null;
    let p = raw;
    // strip schemes like *://, http://, https://, and leading //
    if (p.startsWith('*://')) p = p.slice(4);
    if (p.startsWith('http://') || p.startsWith('https://')) {
        try {
            const u = new URL(p);
            p = u.host;
        } catch {
            // fall through
        }
    }
    if (p.startsWith('//')) p = p.slice(2);
    const host = p.split('/')[0];
    if (!host || host.includes('*')) return null;
    if (!/^[A-Za-z0-9.-]+$/.test(host)) return null;
    return [host.replace(/^\*\./, '')];
};

const setupNetRequestRules = async (group = {}, deletedRuleIds = [], ruleErrors = {}) => {
    const allRuleIds = [];
    const ruleIdToRule = {};
    const rules = group.rules || [];
    rules.forEach(rule => {
        ruleIdToRule[rule.id] = rule;
        allRuleIds.push(rule.id);
    });
    const removeRuleIds = allRuleIds.concat(deletedRuleIds);
    const newRules = [];
    const { globalDisabled } = await chrome.storage.local.get({ globalDisabled: false });
    if (globalDisabled) {
        return chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules: []
        }).then(() => ruleErrors).catch(e => {
            console.error("FAILED TO UPDATE RULES!", e);
            return ruleErrors;
        });
    }
    if (group.on) {
        const initiatorDomains = getInitiatorDomainsFromGroup(group);
        rules.forEach((rule, idx) => {
            const priority = 10 + rules.length - idx;
            if (rule.on && !ruleErrors[rule.id]) {
                if (rule.type === "normalOverride" && rule.match && rule.replace) {
                    const transformedMatchReplace = transformMatchReplace(rule.match, rule.replace);
                    newRules.push({
                        id: rule.id,
                        priority,
                        action: {
                            type: "redirect",
                            redirect: {
                                regexSubstitution: transformedMatchReplace.replace
                            }
                        },
                        condition: {
                            resourceTypes: allResourceTypes,
                            regexFilter: transformedMatchReplace.match,
                            ...(initiatorDomains ? { initiatorDomains } : {})
                        }
                    });
                } else if (rule.type === "fileOverride" && rule.match) {
                    const mimeAndFile = extractMimeType(rule.match, rule.file);
                    const transformedMatchReplace = transformMatchReplace(rule.match, "");
                    newRules.push({
                        id: rule.id,
                        priority,
                        action: {
                            type: "redirect",
                            redirect: {
                                url: "data:" + mimeAndFile.mime + ";charset=UTF-8;base64," +
                                btoa(unescape(encodeURIComponent(mimeAndFile.file || "")))
                            }
                        },
                        condition: {
                            resourceTypes: allResourceTypes,
                            regexFilter: transformedMatchReplace.match,
                            ...(initiatorDomains ? { initiatorDomains } : {})
                        }
                    });
                } else if (rule.type === "headerRule" && rule.match) {
                    const transformedMatchReplace = transformMatchReplace(rule.match, "");
                    const requestHeaders = parseHeaderDataStr(rule.requestRules || "");
                    const responseHeaders = parseHeaderDataStr(rule.responseRules || "");
                    const action = { type: "modifyHeaders" };
                    if (requestHeaders.length) {
                        action.requestHeaders = requestHeaders;
                    }
                    if (responseHeaders.length) {
                        action.responseHeaders = responseHeaders;
                    }
                    if (action.requestHeaders || action.responseHeaders) {
                        newRules.push({
                            id: rule.id,
                            priority,
                            action,
                            condition: {
                                resourceTypes: allResourceTypes,
                                regexFilter: transformedMatchReplace.match,
                                ...(initiatorDomains ? { initiatorDomains } : {})
                            }
                        });
                    }
                }
            }
        });
    }
    return chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: newRules
    }).then(() => ruleErrors).catch(e => {
        console.error("FAILED TO UPDATE RULES!", e);
        const messageParts = e.message?.split?.("Rule with id ");
        if (messageParts && messageParts.length > 1) {
            const badId = parseInt(messageParts[1]);
            let errorMessage = e.message;
            if (errorMessage.includes("regexSubstitution")) {
                errorMessage =
                    "The \"To\" field has incorrect syntax or is referencing an undefined capture group.";
            } else if (errorMessage.includes("regexFilter")) {
                if (ruleIdToRule[badId].type === "headerRule") {
                    errorMessage = "The \"For\" field has incorrect syntax.";
                } else {
                    errorMessage = "The \"From\" field has incorrect syntax.";
                }
            }
            ruleErrors[badId] = errorMessage;
            return setupNetRequestRules(group, deletedRuleIds, ruleErrors);
        }
    });
};

export default setupNetRequestRules;
