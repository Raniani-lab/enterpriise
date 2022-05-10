/** @odoo-module */

import spreadsheet from "../o_spreadsheet/o_spreadsheet_extended";
const { UIPlugin } = spreadsheet;

export default class IrMenuPlugin extends UIPlugin {
    constructor(getters, history, dispatch, config) {
        super(getters, history, dispatch, config);
        this.env = config.evalContext.env;
    }

    /**
     * Get an ir menu from an id or an xml id
     * @param {number | string} menuId
     * @returns {object | undefined}
     */
    getIrMenu(menuId) {
        let menu = this.env.services.menu.getMenu(menuId);
        if(!menu){
            menu = this.env.services.menu.getAll().find((menu) => menu.xmlid === menuId);
        }
        return menu;
    }

    getIrMenuNameById(menuId) {
        return this.env.services.menu.getMenu(menuId).name;
    }

    getIrMenuNameByXmlId(xmlId) {
        return this._getIrMenuByXmlId(xmlId).name;
    }

    getIrMenuIdByXmlId(xmlId) {
        return this._getIrMenuByXmlId(xmlId).id;
    }

    _getIrMenuByXmlId(xmlId) {
        const menu = this.env.services.menu.getAll().find((menu) => menu.xmlid === xmlId);
        if (!menu) {
            throw new Error(`Menu ${xmlId} not found. You may not have the required access rights.`);
        }
        return menu;
    }
}
IrMenuPlugin.getters = ["getIrMenuNameByXmlId", "getIrMenuNameById", "getIrMenuIdByXmlId", "getIrMenu"];
