odoo.define("documents_spreadsheet.SpreadsheetAction", function (require) {
    "use strict";

    const AbstractAction = require("web.AbstractAction");
    const SpreadsheetComponent = require("documents_spreadsheet.SpreadsheetComponent");
    const SpreadsheetControlPanel = require("documents_spreadsheet.ControlPanel");
    const core = require("web.core");

    const _t = core._t;

    const { ComponentWrapper } = require("web.OwlCompatibility");
    const SpreadsheetAction = AbstractAction.extend({
        config: Object.assign({}, AbstractAction.prototype.config, {
            ControlPanel: SpreadsheetControlPanel,
        }),
        contentTemplate: "documents_spreadsheet.SpreadsheetAction",
        events: {},
        custom_events: {
            spreadsheet_name_changed: "_onSpreadSheetNameChanged",
            favorite_toggled: "_onSpreadSheetFavoriteToggled",
        },
        hasControlPanel: true,

        /**
         * @override
         */
        init: function (parent, action) {
            this._super.apply(this, arguments);
            this.res_id = action.params.active_id;
            this.spreadsheetComponent = false;
            this.spreadsheetData = false;
            this.spreadsheetName = false;
            this.isFavorited = false;
        },

        /**
         * @override
         */
        willStart: function () {
            const promises = [];
            promises.push(this._super.apply(this, arguments));
            promises.push(this._loadData());
            return Promise.all(promises);
        },

        /**
         * @override
         */
        start: async function () {
            this._setTitle(this.spreadsheetName);
            this.controlPanelProps.isFavorited = this.isFavorited;
            if (!this.spreadsheetData) {
                return this.do_action({
                    type: "ir.actions.client",
                    tag: "home",
                });
            }
            await this._super.apply(this, arguments);
            const container = this.el.getElementsByClassName("o_spreadsheet_action")[0];
            this.spreadsheetComponent = new ComponentWrapper(this, SpreadsheetComponent, {
                data: this.spreadsheetData,
                res_id: this.res_id,
            });
            await this.spreadsheetComponent.mount(container);
        },

        destroy: function () {
            if (this.spreadsheetComponent) {
                this.spreadsheetComponent.destroy();
            }
            this._super.apply(this, arguments);
        },

        canBeRemoved: function () {
            return this.spreadsheetComponent.componentRef.comp.saveData();
        },

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        _loadData: async function () {
            if (this.res_id === undefined) {
                return;
            }
            const result = await this._rpc({
                route: "/web/dataset/search_read",
                model: "documents.document",
                context: this.context,
                fields: ["raw", "name", "is_favorited"],
                domain: [["id", "=", this.res_id]],
            });
            if (result.records.length !== 0) {
                const [ record ] = result.records
                this.spreadsheetData = JSON.parse(record.raw);
                this.spreadsheetName = record.name;
                this.isFavorited = record.is_favorited;
            }
        },
        /**
         * Saves the spreadsheet name change.
         * @private
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetNameChanged(ev) {
            return this._rpc({
                model: "documents.document",
                method: "write",
                args: [[this.res_id], {
                    name: ev.data.name,
                }],
            });
        },
        /**
         * @param {OdooEvent} ev
         * @returns {Promise}
         */
        _onSpreadSheetFavoriteToggled(ev) {
            return this._rpc({
                model: "documents.document",
                method: "toggle_favorited",
                args: [[this.res_id]],
            });
        },
        /**
         * Open a spreadsheet
         */
        _openSpreadsheet(active_id) {
            this.displayNotification({
                type: "info",
                message: _t("New spreadsheet created in Documents"),
                sticky: false,
            });
            this.do_action({
                type: "ir.actions.client",
                tag: "action_open_spreadsheet",
                params: { active_id },
            }, { clear_breadcrumbs: true });
        }
    });

    core.action_registry.add("action_open_spreadsheet", SpreadsheetAction);

    return SpreadsheetAction;
});
