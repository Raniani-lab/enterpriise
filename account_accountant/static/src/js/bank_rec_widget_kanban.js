/** @odoo-module **/

import viewRegistry from "web.view_registry";
import { device } from 'web.config';

import KanbanView from "web.KanbanView";
import KanbanController from "web.KanbanController";

import ControlPanel from "web.ControlPanel";

import { ComponentWrapper } from "web.OwlCompatibility";
import { View } from "./legacy_view_adapter";
import { BankRecWidgetGlobalInfo } from "./bank_rec_widget_global_info";


class BankRecWidgetKanbanControlPanel extends ControlPanel{}
if(device.isMobile){
    BankRecWidgetKanbanControlPanel.template = "account_accountant.BankRecWidgetKanbanControlPanelMobile";
}else{
    BankRecWidgetKanbanControlPanel.template = "account_accountant.BankRecWidgetKanbanControlPanel";
}


const BankRecWidgetKanbanController = KanbanController.extend({
    events: {
        ...KanbanController.prototype.events,

        // Owl events coming from the ComponentWrapper.
        "perform-do-action": "_onBankRecPerformDoAction",
    },

    // -------------------------------------------------------------------------
    // OVERRIDE
    // -------------------------------------------------------------------------

    // @override
    async start() {
        await this._super(...arguments);

        // Add the missing <div/> inside the view.
        await this._prepareKanbanViewDivs();

        await this._initControlPanelGlobalInfo();

        // Select the next available statement line.
        this._updateStLineIdsStillToReconcile();
        let context = this.initialState.context || {};

        if(context.default_st_line_id){
            await this._selectStLine(context.default_st_line_id);
        }else{
            await this._selectStLine(this._getNextAvailableStLine());
        }
    },

    // @override
    async update(params, options) {
        await this._super(...arguments);
        this._updateStLineIdsStillToReconcile();

        let defs = [];
        if(!params.skipAutoSelect){
            // The user changes something on the filters. Reset completely the selected statement line.
            let stLineId = await this._getNextAvailableStLine();
            defs.push(this._selectStLine(stLineId));
        }
        if(defs.length > 0){
            await Promise.all(defs);
        }

        this._refreshKanbanSelectedStLine();
    },

    /**
    Export the currently selected line in order to retrieve it in 'reload' when coming back on the view using the
    breadcrumb.

    @override
    **/
    exportState() {
        let res = this._super(...arguments);
        res.currentId = this.selectedStLineId;
        return res;
    },

    /**
    When reloading the widget (using the breadcrumb for example), reload from the previously selected line instead
    of focusing the next available line.
    Otherwise, select the first available line using the standard reload.

    @override
    **/
    async reload(params) {
        if(params.controllerState && params.controllerState.currentId){
            // Restoring from breadcrumb.
            await this._super({...params, skipAutoSelect: true});

            this.selectedStLineId = null;
            await this._selectStLine(params.controllerState.currentId);
        }else{
            // Standard reload.
            await this._super(params);
        }
    },

    /**
     Update the right panel after a click on a statement line.

    @override
    @private
    **/
    async _onOpenRecord(ev){
        let virtualStLineId = ev.data.id;

        // Clicked on something else.
        if(!virtualStLineId){
            return;
        }

        // Clicked on the already selected statement line.
        let stLineId = this.model.get(virtualStLineId).data.id;
        if(this.selectedStLineId === stLineId){
            return;
        }

        await this._selectStLine(stLineId);
    },

    // -------------------------------------------------------------------------
    // CUSTOM METHODS
    // -------------------------------------------------------------------------

    /**
    Reorganize the divs of the kanban view to have the anchors to append the custom widgets/views.

    @private
    **/
    async _prepareKanbanViewDivs(){
        let $bankRecMainDiv = $("<div/>", {class: "o_bank_rec_main_div"});
        let $controlPanelDiv = this.$el.find(".o_control_panel");
        let $bankRecKanbanDiv = this.$el.find(".o_content").addClass("o_bank_rec_kanban_div");
        let $bankRecRightDiv = $("<div/>", {class: "o_bank_rec_right_div"});

        $bankRecKanbanDiv.appendTo($bankRecMainDiv);
        $bankRecRightDiv.appendTo($bankRecMainDiv);
        $bankRecMainDiv.insertAfter($controlPanelDiv);

        let $controlPanelBottomLeftDiv = this.$el.find(".o_control_panel .o_cp_bottom_left .o_cp_buttons");
        let $bankRecGlobalInfoDiv = $("<div/>", {class: "o_bank_rec_global_info_div"});
        $bankRecGlobalInfoDiv.insertBefore($controlPanelBottomLeftDiv);
    },

    /**
    Init and mount the wizard form view to edit a statement line.

    @private
    **/
    async _refreshBankRecWidgetForm(){
        let bankRecRightDiv = this.el.querySelector(".o_bank_rec_right_div");
        const previousElements = [...bankRecRightDiv.children];
        let previousComponent = this.bankRecWidgetForm;
        this.bankRecWidgetForm = null;
        let defaultContext = this.initialState.context || {};

        if(this.selectedStLineId){
            // Create a new edition form.
            this.bankRecWidgetForm = new ComponentWrapper(this, View, {
                resModel: "bank.rec.widget",
                type: "form",
                context: {
                    form_view_ref: "account_accountant.view_bank_rec_widget_form",
                    default_st_line_id: this.selectedStLineId,
                    default_todo_command: defaultContext.default_todo_command || 'trigger_matching_rules',
                },
            });

            // Add it into the DOM.
            // Mount it into an empty fragment first to have a smooth transition between the previous and the new form.
            // If mounted directly, the user shows a white screen during 1/2 second.
            await this.bankRecWidgetForm.mount(bankRecRightDiv);
        }

        // Remove the existing elements
        for (const el of previousElements) {
            el.remove();
        }

        // Clear the previous widget.
        if(previousComponent){
            previousComponent.destroy();
        }
    },

    /**
    Init and mount the widget displaying the amounts on top as cards.

    @private
    **/
    async _initControlPanelGlobalInfo(){
        let context = this.initialState.context;
        if(!context.default_journal_id){
            return;
        }

        let bankRecGlobalInfoDiv = this.el.querySelector(".o_bank_rec_global_info_div");

        this.bankRecWidgetGlobalInfo = new ComponentWrapper(this, BankRecWidgetGlobalInfo, {
            journal_id: context.default_journal_id,
        });
        await this.bankRecWidgetGlobalInfo.mount(bankRecGlobalInfoDiv);
    },

    /**
    Collect the statement lines that are still to reconcile. We can't do that right after the validation of a statement
    line for performances matter. We want to avoid to wait the validation then wait the refresh of the kanban view,
    then wait the update of the top amounts. Instead, the statement lines that need to be reconciled are collected only
    when the kanban view is updated. Then, when validating a statement line, we are able to display the next one
    directly and all others computations are done asynchronously.

    @private
    **/
    _updateStLineIdsStillToReconcile(){
        this.stLineIdsStillToReconcile = [];

        let stLineDivs = this.el.querySelectorAll("div.o_bank_rec_st_line_kanban_card[st-line-todo='true']");
        for(const el of stLineDivs){
            this.stLineIdsStillToReconcile.push(parseInt(el.getAttribute('st-line-id')));
        }
    },

    /**
    Get the id of the next statement line that needs to be reconciled.

    @param {Integer} afterStLineId: An optional id indicating after which line the next available statement line should
                                    be peeK.
    @returns {Integer}              The id of a statement line or null.
    @private
    **/
    _getNextAvailableStLine(afterStLineId=null){
        let waitBeforeReturn = Boolean(afterStLineId);
        for(const stLineId of this.stLineIdsStillToReconcile){
            if(waitBeforeReturn){
                if(stLineId === afterStLineId){
                    waitBeforeReturn = false;
                }
            }else{
                return stLineId;
            }
        }
        return null;
    },

    /**
    Refresh the CSS of the kanban view.

    @private
    **/
    _refreshKanbanSelectedStLine(){
        // Clean previously selected line.
        let stLineDivs = this.el.querySelectorAll("div .o_bank_rec_selected_st_line");
        for(const el of stLineDivs){
            el.classList.remove("o_bank_rec_selected_st_line");
        }

        // Select the new statement line.
        if(this.selectedStLineId){
            let stLineDiv = this.el.querySelector(`div.o_bank_rec_st_line_kanban_card[st-line-id='${this.selectedStLineId}']`);
            if(stLineDiv){
                stLineDiv.classList.add("o_bank_rec_selected_st_line");
                stLineDiv.focus();
            }
        }
    },

    /**
    Method used to select the statement line passed as parameter and display the wizard accordingly.

    @param {Integer} stLineId: The id of the statement line is select.
    @private
    **/
    async _selectStLine(stLineId){
        let isSameStLine = this.selectedStLineId && this.selectedStLineId === stLineId;

        // Clicked on the already selected statement line.
        if(!isSameStLine){
            this.selectedStLineId = stLineId;
            this._refreshKanbanSelectedStLine();
            this._refreshBankRecWidgetForm();
        }
    },

    // -------------------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------------------

    /**
    Handler to propagate an action coming from the sub-views as it was generated by the kanban view itself to avoid
    issues with the breadcrumb.

    @private
    **/
    async _onBankRecPerformDoAction(ev){
        let self = this;
        let actionData = ev.detail.actionData;

        if(["ir.actions.client", "ir.actions.act_window"].includes(actionData.type)){
            // The button needs to redirect the user to another page.
            await this.do_action(actionData);
        }else if(actionData.type == "rpc"){
            let nextStLineId = self._getNextAvailableStLine(actionData.st_line_id);

            // This part is done asynchronously.
            this._rpc(
                {
                    model: "bank.rec.widget",
                    method: actionData.method,
                    args: [[], actionData.st_line_id, actionData.params],
                },
                {shadow: true}
            ).then(function(){
                self.update({skipAutoSelect: true}, {});
            });

            await this._selectStLine(nextStLineId);
        }else if(actionData.type == "move_to_next"){
            let nextStLineId = self._getNextAvailableStLine(actionData.st_line_id);

            this.update({skipAutoSelect: true}, {});
            await this._selectStLine(nextStLineId);
        }else if(actionData.type == "refresh"){
            this.update({skipAutoSelect: true}, {});
        }
    },

});


const BankRecWidgetKanban = KanbanView.extend({
    config: {
        ...KanbanView.prototype.config,
        Controller: BankRecWidgetKanbanController,
        ControlPanel: BankRecWidgetKanbanControlPanel,
    },
});


viewRegistry.add("bank_rec_widget_kanban", BankRecWidgetKanban);
