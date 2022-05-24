/** @odoo-module **/

import ListView from "web.ListView";
import ListController from "web.ListController";
import ListRenderer from "web.ListRenderer";
import ControlPanel from "web.ControlPanel";
import { device } from 'web.config';


class BankRecWidgetFormInnerTabControlPanel extends ControlPanel{}
if(device.isMobile){
    BankRecWidgetFormInnerTabControlPanel.template = "account_accountant.BankRecWidgetFormInnerTabControlPanelMobile";
}else{
    BankRecWidgetFormInnerTabControlPanel.template = "account_accountant.BankRecWidgetFormInnerTabControlPanel";
}


export const BankRecWidgetFormInnerTabListController = ListController.extend({

    // @override
    async update(params, options){
        let res = await this._super.apply(this, arguments);

        // Refresh the CSS according to the wizard data.
        this.trigger_up("refresh-inner-list-view");

        return res;
    },

});

export const BankRecWidgetFormInnerTabListRenderer = ListRenderer.extend({

    // @override
    init(parent, state, params){
        // Disable the selectors. The record is mounted when clicking on it.
        let newParams = _.extend({}, params, {hasSelectors: false});
        return this._super(parent, state, newParams);
    },

    // @override
    _renderRow(record){
        let $tr = this._super(...arguments);

        // Set the real record id as parameter.
        $tr.attr("data-res-id", record.data.id);

        return $tr;
    },

    // @override
    _onRowClicked(ev) {
        let localRecordId = $(ev.currentTarget).data("id");
        if(localRecordId){
            // A new record has been selected.
            let viewController = this.getParent();
            let recordId = viewController.model.get(localRecordId).data.id;
            this._onNotebookTabRowClicked(recordId);
        }else{
            // Clicked on something having no id like a "group by" line.
            this._super(...arguments);
        }
    },

    /**
    HOOK allowing a custom behavior when clicking on the row.
    @private
    **/
    _onNotebookTabRowClicked(recordId){},

});


export const BankRecWidgetFormInnerTabList = ListView.extend({
    config: {
        ...ListView.prototype.config,
        Controller: BankRecWidgetFormInnerTabListController,
        Renderer: BankRecWidgetFormInnerTabListRenderer,
        ControlPanel: BankRecWidgetFormInnerTabControlPanel,
    },

    // @override
    init(viewInfo, params){
        this.dynamicFilters = params.context.dynamicFilters;

        this._super(...arguments);

        // Disable extra buttons.
        this.controllerParams.activeActions = {};

        // Limit the number of displayed records by default.
        this.loadParams.limit = params.context.limit;
    },

    // @override
    _createSearchModel(params, extraExtensions) {
        const {controlPanelInfo} = params;
        const dynamicFilters = this.dynamicFilters;

        // Inject the dynamic filters.
        const findInjectIndex = (x) => x.tag === "separator" && x.attrs.name === "inject_after";
        let injectIndex = controlPanelInfo.children.findIndex(findInjectIndex);
        if(injectIndex >= 0){
            let extraArchNodes = [];
            dynamicFilters.forEach(x => {
                extraArchNodes.push({
                    tag: "filter",
                    attrs: {
                        name: x.name,
                        string: x.string,
                        domain: x.domain,
                    },
                });
                if(!x.no_separator){
                    extraArchNodes.push({
                        tag: "separator",
                        attrs: {},
                    });
                }
            });
            controlPanelInfo.children.splice(injectIndex + 1, 0, ...extraArchNodes);
        }

        return this._super(...arguments);
    },

});
