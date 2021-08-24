/** @odoo-module */

import spreadsheet from "../o_spreadsheet_loader";
import { _lt } from "@web/core/l10n/translation";
import { IrMenuSelector } from "../../components/ir_menu_selector/ir_menu_selector";

const { cellRegistry, linkMenuRegistry } = spreadsheet.registries;
const { LinkCell } = spreadsheet.cellTypes;
const { isMarkdownLink, parseMarkdownLink } = spreadsheet.helpers;

const IR_MENU_ID_PREFIX = "odoo://ir_menu_id/";
const IR_MENU_XML_ID_PREFIX = "odoo://ir_menu_xml_id/";

/**
 *
 * @param {string} str
 * @returns
 */
function isMarkdownIrMenuIdLink(str) {
    if (!isMarkdownLink(str)) {
        return false;
    }
    const { url } = parseMarkdownLink(str);
    return url.startsWith(IR_MENU_ID_PREFIX);
}

/**
 *
 * @param {string} irMenuLink
 * @returns ir.ui.menu record id
 */
function parseIrMenuIdLink(irMenuLink) {
    if (irMenuLink.startsWith(IR_MENU_ID_PREFIX)) {
        return parseInt(irMenuLink.substr(IR_MENU_ID_PREFIX.length), 10);
    }
    throw new Error(`${irMenuLink} is not a valid menu id link`);
}

/**
 * @param {number} menuId
 * @returns
 */
function buildIrMenuIdLink(menuId) {
    return `${IR_MENU_ID_PREFIX}${menuId}`;
}

/**
 *
 * @param {string} str
 * @returns
 */
function isMarkdownIrMenuXmlLink(str) {
    if (!isMarkdownLink(str)) {
        return false;
    }
    const { url } = parseMarkdownLink(str);
    return url.startsWith(IR_MENU_XML_ID_PREFIX);
}

/**
 *
 * @param {string} irMenuLink
 * @returns ir.ui.menu record id
 */
function parseIrMenuXmlLink(irMenuLink) {
    if (irMenuLink.startsWith(IR_MENU_XML_ID_PREFIX)) {
        return irMenuLink.substr(IR_MENU_XML_ID_PREFIX.length);
    }
    throw new Error(`${irMenuLink} is not a valid menu xml link`);
}
/**
 * @param {number} menuXmlId
 * @returns
 */
function buildIrMenuXmlLink(menuXmlId) {
    return `${IR_MENU_XML_ID_PREFIX}${menuXmlId}`;
}

class OdooMenuLinkCell extends LinkCell {
    constructor(id, content, menuId, menuName, properties = {}) {
        super(id, content, properties);
        this.urlRepresentation = menuName;
        this.isUrlEditable = false;
        this._irMenuId = menuId;
    }

    action(env) {
        env.services.menu.selectMenu(this._irMenuId);
    }
}

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
});

linkMenuRegistry.add("odooMenu", {
    name: _lt("Link an Odoo menu"),
    sequence: 20,
    action: async (env) => {
        return new Promise((resolve) => {
            const closeDialog = env.services.dialog.add(IrMenuSelector, {
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
