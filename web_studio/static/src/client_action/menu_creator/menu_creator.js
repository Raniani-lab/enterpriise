/** @odoo-module */
import { Component, useState } from "@odoo/owl";
import { useOwnedDialogs } from "@web/core/utils/hooks";
import { Dialog } from "@web/core/dialog/dialog";

import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { Record } from "@web/views/record";
import { _t } from "@web/core/l10n/translation";

import { useDialogConfirmation } from "@web_studio/client_action/utils";
import { ModelConfiguratorDialog } from "../model_configurator/model_configurator";

export class MenuCreatorModel {
    constructor({ allowNoModel } = {}) {
        this.data = {
            modelId: false,
            menuName: "",
            modelChoice: "new",
        };

        // Info to instantiate the many2one to select an existing model
        this.modelIdfieldsInfo = {
            modelId: {
                relation: "ir.model",
                domain: [
                    ["transient", "=", false],
                    ["abstract", "=", false],
                ],
                type: "many2one",
            },
        };

        // Info to select what kind of model is linked to the menu
        this.modelChoiceSelection = {
            new: _t("New Model"),
            existing: _t("Existing Model"),
        };

        if (allowNoModel) {
            this.modelChoiceSelection.parent = _t("Parent Menu");
        }
    }

    validateField(fieldName) {
        if (fieldName === "menuName") {
            return !!this.data.menuName;
        } else if (fieldName === "modelId") {
            return this.data.modelChoice === "existing" ? !!this.data.modelId : true;
        }
    }

    get isValid() {
        return ["menuName", "modelId"].every((fName) => this.validateField(fName));
    }
}

export class MenuCreator extends Component {
    static template = "web_studio.MenuCreator";
    static components = { Record, Many2OneField };
    static props = {
        menuCreatorModel: { type: Object },
        showValidation: { type: Boolean, optional: true },
    };
    static defaultProps = {
        showValidation: false,
    };

    setup() {
        this.state = useState(this.props.menuCreatorModel);
    }

    isValid(fieldName) {
        return this.props.showValidation ? this.state.validateField(fieldName) : true;
    }
}

export class MenuCreatorDialog extends Component {
    static template = "web_studio.MenuCreatorDialog";
    static components = { Dialog, MenuCreator };
    static props = { confirm: { type: Function }, close: { type: Function } };

    setup() {
        this.addDialog = useOwnedDialogs();
        this.menuCreatorModel = useState(new MenuCreatorModel({ allowNoModel: true }));
        this.state = useState({ showValidation: false });
        this.title = _t("Create your menu");
        const { confirm, cancel } = useDialogConfirmation({
            confirm: async (data = {}) => {
                if (!this.menuCreatorModel.isValid) {
                    this.state.showValidation = true;
                    return false;
                }
                await this.props.confirm(data);
            },
        });
        this._confirm = confirm;
        this._cancel = cancel;
    }

    confirm(data = {}) {
        this._confirm({ ...this.menuCreatorModel.data, ...data });
    }

    onCreateNewModel() {
        if (!this.menuCreatorModel.isValid) {
            this.state.showValidation = true;
            return;
        }
        this.addDialog(ModelConfiguratorDialog, {
            confirmLabel: _t("Create Menu"),
            confirm: (data) => {
                this.confirm({ modelOptions: data });
            },
        });
    }
}
