/** @odoo-module */

import spreadsheet, { initCallbackRegistry } from "../o_spreadsheet/o_spreadsheet_extended";
import { _lt } from "@web/core/l10n/translation";

import { IrMenuSelectorDialog } from "@documents_spreadsheet/assets/components/ir_menu_selector/ir_menu_selector";

import IrMenuPlugin from "./ir_ui_menu_plugin"
import {
    isMarkdownIrMenuIdLink,
    isMarkdownIrMenuXmlLink,
    isMarkdownViewLink,
    parseIrMenuXmlLink,
    OdooViewLinkCell,
    OdooMenuLinkCell,
    buildViewLink,
    parseViewLink,
    buildIrMenuXmlLink,
    buildIrMenuIdLink,
    parseIrMenuIdLink
} from "./odoo_menu_link_cell"


const { uiPluginRegistry, cellRegistry, linkMenuRegistry } = spreadsheet.registries;
const { parseMarkdownLink, markdownLink } = spreadsheet.helpers;

uiPluginRegistry.add("ir_ui_menu_plugin", IrMenuPlugin);

cellRegistry.add("OdooMenuIdLink", {
    sequence: 65,
    match: isMarkdownIrMenuIdLink,
    createCell: (id, content, properties, sheetId, getters) => {
        const { url } = parseMarkdownLink(content);
        const menuId = parseIrMenuIdLink(url);
        const menuName = getters.getIrMenuNameById(menuId);
        return new OdooMenuLinkCell(id, content, menuId, menuName, properties);
    },
}).add("OdooMenuXmlLink", {
    sequence: 66,
    match: isMarkdownIrMenuXmlLink,
    createCell: (id, content, properties, sheetId, getters) => {
        const { url } = parseMarkdownLink(content);
        const xmlId = parseIrMenuXmlLink(url);
        const menuId = getters.getIrMenuIdByXmlId(xmlId);
        const menuName = getters.getIrMenuNameByXmlId(xmlId);
        return new OdooMenuLinkCell(id, content, menuId, menuName, properties);
    },
}).add("OdooIrFilterLink", {
    sequence: 67,
    match: isMarkdownViewLink,
    createCell: (id, content, properties, sheetId, getters) => {
        const { url } = parseMarkdownLink(content);
        const actionDescription = parseViewLink(url);
        return new OdooViewLinkCell(id, content, actionDescription, properties);
    },
});

linkMenuRegistry.add("odooMenu", {
    name: _lt("Link an Odoo menu"),
    sequence: 20,
    action: async (env) => {
        return new Promise((resolve) => {
            const closeDialog = env.services.dialog.add(IrMenuSelectorDialog, {
                onMenuSelected: (menuId) => {
                    closeDialog();
                    const menu = env.services.menu.getMenu(menuId);
                    const xmlId = menu.xmlid;
                    const url = xmlId ? buildIrMenuXmlLink(xmlId) : buildIrMenuIdLink(menuId);
                    const name = menu.name;
                    const link = { url, label: name };
                    resolve({
                        link,
                        isUrlEditable: false,
                        urlRepresentation: name,
                    });
                },
            });
        });
    },
});



/**
 * Helper to get the function to be called when the spreadsheet is opened
 * in order to insert the link.
 * @param {import("./odoo_menu_link_cell").ViewLinkDescription} actionToLink
 * @returns Function to call
 */
function insertLink(actionToLink) {
    return (model) => {
        if (!this.isEmptySpreadsheet) {
            const sheetId = model.uuidGenerator.uuidv4();
            const sheetIdFrom = model.getters.getActiveSheetId();
            model.dispatch("CREATE_SHEET", {
                sheetId,
                position: model.getters.getSheetIds().length,
            });
            model.dispatch("ACTIVATE_SHEET", { sheetIdFrom, sheetIdTo: sheetId });
        }
        const viewLink = buildViewLink(actionToLink);
        model.dispatch("UPDATE_CELL", {
            sheetId: model.getters.getActiveSheetId(),
            content: markdownLink(actionToLink.name, viewLink),
            col: 0,
            row: 0,
        });
    };
}

initCallbackRegistry.add("insertLink", insertLink);
