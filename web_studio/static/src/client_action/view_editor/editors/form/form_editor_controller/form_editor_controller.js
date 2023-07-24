/** @odoo-module */

import { useState, onMounted, onPatched } from "@odoo/owl";
import { formView } from "@web/views/form/form_view";

function applyParentRecordOnModel(model, parentRecord) {
    const evalContext = { ...parentRecord.evalContext };
    model.config.context.parent = { evalContext };
}

export class FormEditorController extends formView.Controller {
    setup() {
        super.setup();
        this.mailTemplate = null;
        this.hasFileViewerInArch = false;

        this.viewEditorModel = useState(this.env.viewEditorModel);

        if (this.props.parentRecord) {
            applyParentRecordOnModel(this.model, this.props.parentRecord);
        }

        onMounted(() => {
            const xpath = this.viewEditorModel.lastActiveNodeXpath;
            if (xpath && xpath.includes("notebook")) {
                const tabXpath = xpath.match(/.*\/page\[\d+\]/)[0];
                const tab = document.querySelector(`[data-studio-xpath='${tabXpath}'] a`);
                if (tab) {
                    // store the targetted element to restore it after being patched
                    this.notebookElementData = {
                        xpath,
                        restore: Boolean(this.viewEditorModel.activeNodeXpath),
                        sidebarTab: this.viewEditorModel.sidebarTab,
                        isTab: xpath.length === tabXpath.length,
                    };
                    tab.click();
                }
            } else {
                this.notebookElementData = null;
            }
        });

        onPatched(() => {
            if (this.notebookElementData) {
                if (
                    this.notebookElementData.isTab &&
                    this.viewEditorModel.lastActiveNodeXpath !== this.notebookElementData.xpath
                ) {
                    return;
                }
                if (this.notebookElementData.restore) {
                    this.env.config.onNodeClicked(this.notebookElementData.xpath);
                } else {
                    // no element was currently highlighted, the editor sidebar must display the stored tab
                    this.viewEditorModel.resetSidebar(this.notebookElementData.sidebarTab);
                }
                this.notebookElementData = null;
            }
        });
    }
}
FormEditorController.props = {
    ...formView.Controller.props,
    parentRecord: { type: [Object, { value: null }], optional: true },
};
