/** @odoo-module **/

import viewRegistry from "web.view_registry";

import FormView from "web.FormView";
import FormController from "web.FormController";

import { ComponentWrapper } from "web.OwlCompatibility";
import { View } from "./legacy_view_adapter";


export const BankRecWidgetFormController = FormController.extend({
    events: {
        ...FormController.prototype.events,

        "click div[data-name='bank_rec_widget_notebook'] a": "_onNotebookTabClicked",
        "click div[name='form_extra_text'] button": "_onLinesWidgetFormExtraButtonClicked",

        // Owl events.
        "lines-widget-remove-line": "_onLinesWidgetRemoveLine",
        "lines-widget-mount-line": "_onLinesWidgetMountLine",
        "amls-view-line-clicked": "_onAmlsViewMountLine",
        "reco-models-widget-button-clicked": "_onRecoModelsWidgetButtonClicked",
        "refresh-inner-list-view": "_onRefreshInnerListView",
    },

    // -------------------------------------------------------------------------
    // OVERRIDE
    // -------------------------------------------------------------------------

    // @override
    async start(){
        await this._super(...arguments);

        // Init the dynamic notebook. Load the default active one.
        this.notebookDataList = this._initLazyNotebookTabs();
    },

    // @override
    async on_attach_callback(){
        await this._super(...arguments);

        // We need to ensure the wizard is inside the DOM before embedding a view.
        await this._ensureActiveNotebookTabContentMounted();
    },

    // @override
    async _confirmChange(id, fields, ev) {
        let res = await this._super(...arguments);

        // Refresh the active notebook tab.
        await this._ensureActiveNotebookTabContentMounted();

        // Post processing from the method calling 'field_changed'.
        if(ev.data.postMethod){
            await ev.data.postMethod(ev);
        }

        this.canBeSaved();

        return res;
    },

    /**
    The record must never be created since the wizard is not a stored model.
    @override
    **/
    async createRecord(parentID, additionalContext){},

    /**
    The record must never be saved since the wizard is not a stored model.
    @override
    **/
    async _saveRecord(){
        return Promise.resolve();
    },

    /**
    The normal flow is to save the record, then read it and call the action's button on it.
    Since the wizard is not a stored model, we completely override this method to bring a new behavior to call the
    actions directly on 'new' records. In case the action is a redirection, the action is delegated to the kanban view
    in order to have a correct breadcrumb.
    @override
    **/
    async _onButtonClicked(ev){
        ev.stopPropagation();

        if(!this.canBeSaved()){
            return;
        }

        //Prevent clicking multiple times on the same button.
        this._disableButtons();

        let todo_command = `button_clicked,${ev.data.attrs.name}`;
        if(ev.data.attrs.method_args){
            todo_command = todo_command.concat(',', JSON.parse(ev.data.attrs.method_args).join(','));
        }
        await new Promise((resolve, reject) => {
            this.trigger_up("field_changed", {
                dataPointID: this.handle,
                changes: {todo_command: todo_command},
                onSuccess: resolve,
                onFailure: reject,
            });
        });

        let record = this.model.get(this.handle);
        let actionData = record.data.next_action_todo;
        if(actionData){
            this.trigger_up("perform-do-action", {actionData: actionData});

            // No need to enable back the buttons since we are moving to another view.
            // This prevents the user to quickly click on another button before the redirection.
            return;
        }else{
            // Refresh the kanban view but stay focused on the current statement line.
            this.trigger_up("perform-do-action", {actionData: {type: "refresh"}});
        }

        this._enableButtons();
    },

    // -------------------------------------------------------------------------
    // HELPERS
    // -------------------------------------------------------------------------

    /**
    Method used to retrieve a field to focus automatically on the "manual operation" tab when clicking somewhere on the
    'lines_widget' widget.

    @param {string} path:   The path to an element to focus automatically.
    @returns {boolean}       true if the path found an element, false otherwise.
    @private
    **/
    _bankRecTryAutoFocusElement(path){
        let inputEl = this.el.querySelector(path);
        if(!inputEl){
            return false;
        }

        if(inputEl.tagName.toLowerCase() === "input"){
            inputEl.select();
        }else{
            inputEl.focus();
        }
        return true;
    },

    /**
    Method used to focus automatically the field passed as parameter on the "manual operation" tab when clicking
    somewhere on the 'lines_widget' widget.

    @param {string} selectedField: The name of the clicked field inside the 'lines_widget' widget.
    @private
    **/
    _bankRecTryAutoFocusField(selectedField){
        if(['debit', 'credit'].includes(selectedField)){
            if(this._bankRecTryAutoFocusElement("div[name='form_balance'] input")){
                return;
            }
            if(this._bankRecTryAutoFocusElement("div[name='form_amount_currency'] input")){
                return;
            }
        }else{
            if(this._bankRecTryAutoFocusElement(`div[name='form_${selectedField}'] input`)){
                return;
            }
            if(this._bankRecTryAutoFocusElement(`input[name='form_${selectedField}']`)){
                return;
            }
        }
    },

    // -------------------------------------------------------------------------
    // NOTEBOOK
    // -------------------------------------------------------------------------

    /**
    Configure the notebooks having custom content. The content is loaded in a lazy way when the tab becomes active.

    @returns A list of dictionaries containing:
        - tabName:          The name of the tab inside the form view.
        - anchorName:       The name of the div inside the tab on which the dynamic content will be appended.
        - listOptions:      Custom values for a list view.
            - selectedIdsFieldName:     The name of the field containing the already selected record ids.
            - trClass:                  The class used to retrieve the records in the list view.
        - initMethod:       The function to be called when the content of the tab is mounted and returning the component.
        - postInitMethod:   An optional function taking the newly created element as parameter to allow a post-processing.
    @private
    **/
    _initLazyNotebookTabs(){
        let self = this;
        return [
            {
                tabName: "amls_tab",
                anchorName: "bank_rec_widget_form_amls_list_anchor",
                listOptions: {
                    selectedIdsFieldName: "selected_aml_ids",
                    trClass: "o_bank_rec_widget_aml",
                },
                initMethod: function(){
                    let data = self.model.get(self.handle).data;
                    let amlsWidgetData = data.amls_widget;

                    return new ComponentWrapper(self, View, {
                        resModel: "account.move.line",
                        type: "list",
                        views: [[false, "search"]],
                        load_filters: true,
                        domain: amlsWidgetData.domain,
                        context: Object.assign({dynamicFilters: amlsWidgetData.dynamic_filters}, amlsWidgetData.context),
                    });
                },
            },
            {
                tabName: "discuss_tab",
                anchorName: "bank_rec_widget_form_discuss_anchor",
                initMethod: function(){
                    let data = self.model.get(self.handle).data;

                    return new ComponentWrapper(self, View, {
                        resModel: "account.move",
                        resId: data.move_id.data.id,
                        type: "form",
                        withControlPanel: false,
                        onPushState: () => {},
                        context: {
                            form_view_ref: "account_accountant.view_move_form_bank_rec_widget",
                        },
                    });
                },
                postInitMethod: function(anchorEl){
                    anchorEl.querySelector("div.o_form_view").className = '';
                    anchorEl.querySelector("div.o_FormRenderer_chatterContainer").className = '';

                    anchorEl.parentElement.style.paddingTop = "0px";
                },
            }
        ];
    },

    /**
    Refresh the CSS of the embedded list views inside a notebook tab.

    @private
    **/
    async _refreshNotebookTabListContent(notebookData){
        let data = this.model.get(this.handle).data;
        let notebookDomPath = `div[data-name='bank_rec_widget_notebook'] div.${notebookData.anchorName} tr.${notebookData.listOptions.trClass}`

        // Clean previous selected elements.
        let selectClass = "o_rec_widget_list_selected_item";
        let previousSelectedElements = this.el.querySelectorAll(`${notebookDomPath}.${selectClass}`);
        for(const el of previousSelectedElements){
            el.classList.remove(selectClass);
        }

        // Process newly selected element.
        let fieldValue = data[notebookData.listOptions.selectedIdsFieldName];
        if(fieldValue){
            for(const selectedData of fieldValue.data){
                let selectedElements = this.el.querySelectorAll(`${notebookDomPath}[data-res-id='${selectedData.res_id}']`);
                for(const el of selectedElements){
                    el.classList.add(selectClass);
                }
            }
        }
    },

    /**
    This method is called to ensure the content of the notebook is well loaded since it's lazy.

    @param {Object} notebookData: The notebook to check defined by the '_initLazyNotebookTabs' method.
    @private
    **/
    async _ensureNotebookTabContentMounted(notebookData){
        let isMounted = Boolean(notebookData.wrapper);
        if(isMounted){
            return;
        }

        notebookData.wrapper = notebookData.initMethod();
        let anchorEl = this.el.querySelector(`.${notebookData.anchorName}`);
        await notebookData.wrapper.mount(anchorEl);

        if(notebookData.postInitMethod){
            notebookData.postInitMethod(anchorEl);
        }
    },

    /**
    This method ensure the content of the active notebook is well loaded since it's lazy.

    @private
    **/
    async _ensureActiveNotebookTabContentMounted(){
        let activeFound = false;
        for(const notebookData of this.notebookDataList){
            let notebookEl = this.el.querySelector(`div[data-name='bank_rec_widget_notebook'] a[name='${notebookData.tabName}']`);
            if(notebookEl.classList.contains('active') && !activeFound){
                activeFound = true;
                await this._ensureNotebookTabContentMounted(notebookData);

                if(notebookData.listOptions){
                    await this._refreshNotebookTabListContent(notebookData);
                }
            }else{
                // Disable manually others tabs and each corresponding tab content. This is quite hacky but we have
                // no choice since we don't have any proper hook on which perform such extra behavior.
                // This is needed when resetting a statement line to edit mode. In that case, 2 notebooks are active
                // in the same time because the 'amls_tab' is mounted making (for some reason) the tab active by
                // default without disabling the 'discuss_tab'.
                notebookEl.classList.remove('active');
                this.el.querySelector(notebookEl.getAttribute("href")).classList.remove('active');
            }
        }
    },

    async _focusLinesWidgetLastLine(){
        let els = this.el.querySelectorAll("div[name='lines_widget'] td[field='debit']");
        let lastIndex = els.length - 1;
        if(lastIndex >= 0){
            await els[lastIndex].click();
        }
    },

    // -------------------------------------------------------------------------
    // HANDLERS
    // -------------------------------------------------------------------------

    /**
    Handler when a notebook is clicked by the user.

    @private
    **/
    async _onNotebookTabClicked(ev){
        let data = this.model.get(this.handle).data;

        if(ev.currentTarget.getAttribute('name') === "manual_operations_tab"){
            let hasLineAlreadyMounted = Boolean(data.form_index);

            // Focus the last available line.
            if(!hasLineAlreadyMounted){
                this._focusLinesWidgetLastLine();
            }
        }else{
            // The user is not focusing the "Manual Operations" tab. Clear the selection.
            this.trigger_up("field_changed", {
                dataPointID: this.handle,
                changes: {todo_command: "clear_edit_form"},
            });

            // Find the newly selected notebook to load the lazy content (if any).
            let tabName = ev.currentTarget.name;
            let selectedNotebookData = this.notebookDataList.filter(x => x.tabName === tabName);
            if(selectedNotebookData.length === 0){
                return;
            }

            // Ensure the newly focused tab is well loaded in case of some lazy content (embedded views).
            let notebookData = selectedNotebookData[0];
            await this._ensureNotebookTabContentMounted(notebookData);

            // Refresh the CSS of the selected list view.
            if(notebookData.listOptions){
                await this._refreshNotebookTabListContent(notebookData);
            }
        }
    },

    /**
    Handler when the trash button is clicked on 'lines_widget'.

    @private
    **/
    _onLinesWidgetRemoveLine(ev){
        ev.stopPropagation();
        let index = ev.detail.index;

        // The content of the "Manual Operations" tab is cleared when removing a line. However, if the tab is focused
        // by the user, we focus the last line automatically.
        let isManualOpTabFocused = Boolean(this.el.querySelector("div.o_notebook_headers a.active[name='manual_operations_tab']"));
        let postMethod = isManualOpTabFocused ? this._focusLinesWidgetLastLine.bind(this) : null;

        // Trigger the onchange.
        this.trigger_up("field_changed", {
            dataPointID: this.handle,
            postMethod: postMethod,
            changes: {todo_command: `remove_line,${index}`},
        });
    },

    /**
    Handler when a line in 'lines_widget' is clicked to be mounted inside the "manual operations" tab for edition.

    @private
    **/
    _onLinesWidgetMountLine(ev){
        ev.stopPropagation();
        let index = ev.detail.index;
        let data = this.model.get(this.handle).data;

        if(data.state === "reconciled"){
            return;
        }

        let postMethod = function(ev){
            let isManualOpTabFocused = Boolean(this.el.querySelector("div[data-name='bank_rec_widget_notebook'] a.active[name='manual_operations_tab']"));

            if(!isManualOpTabFocused){
                // The "Manual Operations" tab is not focused by the user. Click on it to be the active one.
                let manualOpTab = this.el.querySelector("div[data-name='bank_rec_widget_notebook'] a[name='manual_operations_tab']");
                if(manualOpTab){
                    manualOpTab.click();
                }
            }

            // Focus a field by default inside the "Manual Operations" tab depending of the clicked field in 'lines_widget'.
            this._bankRecTryAutoFocusField(ev.data.selectedField);
        }

        // Trigger the onchange.
        this.trigger_up("field_changed", {
            dataPointID: this.handle,
            postMethod: postMethod.bind(this),
            selectedField: ev.detail.selectedField,
            changes: {todo_command: `mount_line_in_edit,${index}`},
        });
    },

    /**
    Handler when an account.move.line is clicked on the amls list view.

    @private
    **/
    _onAmlsViewMountLine(ev){
        ev.stopPropagation();
        let recordId = ev.detail.recordId;
        let data = this.model.get(this.handle).data;

        if(data.selected_aml_ids.data.some(x => x.data.id === recordId)){
            // Remove the line from the selection.
            this.trigger_up("field_changed", {
                dataPointID: this.handle,
                changes: {todo_command: `remove_new_aml,${recordId}`},
            });
        }else{
            // Mount the line into the selection.
            this.trigger_up("field_changed", {
                dataPointID: this.handle,
                changes: {todo_command: `add_new_amls,${recordId}`},
            });
        }
    },

    /**
    Handler when a reconciliation model button is clicked in 'reco_models_widget'.

    @private
    **/
    _onRecoModelsWidgetButtonClicked(ev){
        ev.stopPropagation();

        let key = ev.detail.key;
        let todo_command;
        if(ev.detail.selected){
            todo_command = `unselect_reconcile_model_button,${key}`;
        }else{
            todo_command = `select_reconcile_model_button,${key}`;
        }

        // Trigger the onchange.
        this.trigger_up("field_changed", {
            dataPointID: this.handle,
            postMethod: this._focusLinesWidgetLastLine.bind(this),
            changes: {todo_command: todo_command},
        });
    },

    _onLinesWidgetFormExtraButtonClicked(ev){
        this.trigger_up("button_clicked", {attrs: $(ev.currentTarget).getAttributes()});
    },

    /**
    Refresh the CSS of the targeted embedded list view.

    @param ev: An odoo event.
    **/
    _onRefreshInnerListView(ev){
        let anchorName = ev.target.parentElement.className;
        let selectedNotebookData = this.notebookDataList.filter(x => x.anchorName === anchorName);
        if(selectedNotebookData.length === 0){
            return;
        }

        let notebookData = selectedNotebookData[0];
        this._refreshNotebookTabListContent(notebookData);
    },

});


export const BankRecWidgetForm = FormView.extend({
    config: {
        ...FormView.prototype.config,
        Controller: BankRecWidgetFormController,
    },
    withControlPanel: false,
});


viewRegistry.add("bank_rec_widget_form", BankRecWidgetForm);
