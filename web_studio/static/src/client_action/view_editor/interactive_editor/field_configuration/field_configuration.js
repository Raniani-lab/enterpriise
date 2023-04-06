/** @odoo-module */
import { Component, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { Record } from "@web/views/record";
import { ModelFieldSelector } from "@web/core/model_field_selector/model_field_selector";
import { useDialogConfirmation } from "@web_studio/client_action/utils";
import { useOwnedDialogs, useService } from "@web/core/utils/hooks";
import { session } from "@web/session";
import { _t } from "@web/core/l10n/translation";
import { sprintf } from "@web/core/utils/strings";
import { DomainSelector } from "@web/core/domain_selector/domain_selector";
import { SelectionContentDialog } from "@web_studio/client_action/view_editor/interactive_editor/field_configuration/selection_content_dialog";

export function getCurrencyField(fieldsGet) {
    const field = Object.entries(fieldsGet).find(([fName, fInfo]) => {
        return fInfo.type === "many2one" && fInfo.relation === "res.currency";
    });
    if (field) {
        return field[0];
    }
}

export class SelectionValuesEditor extends Component {
    static components = {
        SelectionContentDialog,
    };
    static props = {
        configurationModel: { type: Object },
        confirm: { type: Function },
        cancel: { type: Function },
    };
    static template = "web_studio.SelectionValuesEditor";
    static Model = class SelectionValuesModel {
        constructor() {
            this.selection = "[]";
        }
        get isValid() {
            return true;
        }
    };
    get selection() {
        return JSON.parse(this.props.configurationModel.selection);
    }
    onConfirm(choices) {
        this.props.configurationModel.selection = JSON.stringify(choices);
        this.props.confirm();
    }
}

export class RelationalFieldConfigurator extends Component {
    static template = "web_studio.RelationalFieldConfigurator";
    static components = { Record, Many2OneField };
    static props = {
        configurationModel: { type: Object },
        resModel: { type: String },
        fieldType: { type: String },
    };
    static Model = class RelationalFieldModel {
        constructor() {
            this.relationId = false;
        }
        get isValid() {
            return !!this.relationId;
        }
    };

    setup() {
        this.state = useState(this.props.configurationModel);

        const relationId = {
            type: "many2one",
            context: {},
        };

        if (this.fieldType === "one2many") {
            relationId.relation = "ir.model.fields";
            relationId.domain = [
                ["relation", "=", this.props.resModel],
                ["ttype", "=", "many2one"],
                ["model_id.abstract", "=", false],
                ["store", "=", true],
            ];
        } else {
            relationId.relation = "ir.model";
            relationId.domain = [
                ["transient", "=", false],
                ["abstract", "=", false],
            ];
        }

        this.activeFields = { relationId };

        const state = this.state;
        this.recordProps = {
            activeFields: this.activeFields,
            fields: this.activeFields,
            get values() {
                return {
                    relationId: state.relationId,
                };
            },
            onRecordChanged: (rec) => {
                this.state.relationId = rec.data.relationId;
            },
        };
    }

    get fieldType() {
        return this.props.fieldType;
    }
}

class RelatedChainBuilderModel {
    static services = ["field", "dialog"];

    constructor({ services, props }) {
        this.services = services;
        this.relatedParams = {};
        this.fieldInfo = { resModel: props.resModel, fieldDef: null };
        this.shouldOpenCurrencyDialog = props.shouldOpenCurrencyDialog;
        this.resModel = props.resModel;
    }

    get isValid() {
        return !!this.relatedParams.related;
    }

    getRelatedFieldDescription(resModel, lastField) {
        const fieldType = lastField.type;
        const relatedDescription = {
            readonly: true,
            copy: false,
            string: lastField.string,
            type: fieldType,
            store: ["one2many", "many2many"].includes(fieldType) ? false : lastField.store,
        };

        if (["many2one", "many2many", "one2many"].includes(fieldType)) {
            relatedDescription.relation = lastField.relation;
        }
        if (["one2many", "many2many"].includes(fieldType)) {
            relatedDescription.relational_model = resModel;
        }
        if (fieldType === "selection") {
            relatedDescription.selection = lastField.selection;
        }
        return relatedDescription;
    }

    async confirm() {
        const relatedDescription = this.getRelatedFieldDescription(
            this.fieldInfo.resModel,
            this.fieldInfo.fieldDef
        );
        if (this.shouldOpenCurrencyDialog && relatedDescription.type === "monetary") {
            const currencyDescription = await openCurrencyConfirmDialog(
                this.services.dialog.add,
                this.resModel
            );
            if (!currencyDescription) {
                return false;
            }
            const relatedCurrencyField = await this.getRelatedCurrencyField(
                this.fieldInfo.resModel
            );
            if (relatedCurrencyField) {
                currencyDescription.related = relatedCurrencyField;
            } else {
                currencyDescription.related = "";
            }

            Object.assign(this.relatedParams, currencyDescription);
            return true;
        } else {
            Object.assign(this.relatedParams, relatedDescription);
            return true;
        }
    }

    async getRelatedCurrencyField(resModel) {
        const fields = await this.services.field.loadFields(resModel);
        const currencyField = getCurrencyField(fields);
        if (!currencyField) {
            return null;
        }
        const chainSplit = this.relatedParams.related.split(".");
        chainSplit.splice(chainSplit.length - 1, 1, currencyField);
        return chainSplit.join(".");
    }
}

export class RelatedChainBuilder extends Component {
    static template = owl.xml`<ModelFieldSelector resModel="props.resModel" path="fieldChain" readonly="false" filter.bind="filter" update.bind="updateChain" />`;
    static components = { ModelFieldSelector };
    static props = {
        resModel: { type: String },
        configurationModel: { type: Object },
        shouldOpenCurrencyDialog: { type: Boolean },
    };
    static Model = RelatedChainBuilderModel;

    setup() {
        this.state = useState(this.props.configurationModel);
        this.relatedParams.related = "";
    }

    get relatedParams() {
        return this.state.relatedParams;
    }

    get fieldChain() {
        return this.relatedParams.related;
    }

    filter(fieldDef, path) {
        if (!path) {
            return fieldDef.type === "many2one";
        }
        return true;
    }

    async updateChain(path, fieldInfo) {
        this.relatedParams.related = path;
        this.state.fieldInfo = fieldInfo;
    }
}

function useConfiguratorModel(Model, props) {
    const services = Object.fromEntries(
        (Model.services || []).map((servName) => {
            let serv;
            if (servName === "dialog") {
                serv = { add: useOwnedDialogs() };
            } else {
                serv = useService(servName);
            }
            return [servName, serv];
        })
    );

    const model = new Model({ services, props });
    return useState(model);
}

export class FieldConfigurationDialog extends Component {
    static props = {
        confirm: { type: Function },
        cancel: { type: Function },
        close: { type: Function },
        Component: { type: Function },
        componentProps: { type: Object, optional: true },
        fieldType: { type: String, optional: true },
        isDialog: { type: Boolean, optional: true },
        title: { type: String, optional: true },
        size: { type: String, optional: true },
    };
    static template = "web_studio.FieldConfigurationDialog";
    static components = { Dialog };

    setup() {
        const { confirm, cancel } = useDialogConfirmation({
            confirm: async () => {
                let confirmValues = false;
                if (!this.configurationModel.isValid) {
                    return false;
                }
                if (this.configurationModel.confirm) {
                    const res = await this.configurationModel.confirm();
                    if (res || res === undefined) {
                        confirmValues = this.configurationModel;
                    }
                } else {
                    confirmValues = this.configurationModel;
                }
                return this.props.confirm(confirmValues);
            },
            cancel: () => this.props.cancel(),
        });
        this.confirm = confirm;
        this.cancel = cancel;
        this.configurationModel = useConfiguratorModel(
            this.Component.Model,
            this.props.componentProps
        );
    }

    get title() {
        if (this.props.title) {
            return this.props.title;
        }
        if (this.props.fieldType) {
            return sprintf(_t("Field properties: %s"), this.props.fieldType);
        }
        return "";
    }

    get Component() {
        return this.props.Component;
    }

    get canConfirm() {
        return this.configurationModel.isValid;
    }
}

export function openCurrencyConfirmDialog(add, resModel) {
    const currencyFieldDescription = {
        default_value: session.company_currency_id, // FIXME: doesn't exist and/or necessary ?
        field_description: "Currency",
        model_name: resModel,
        name: "x_currency_id",
        relation: "res.currency",
        type: "many2one",
    };

    return new Promise((resolve, reject) => {
        add(ConfirmationDialog, {
            body: _t(
                `In order to use a monetary field, you need a currency field on the model. Do you want to create a currency field first? You can make this field invisible afterwards.`
            ),
            confirm: () => {
                resolve(currencyFieldDescription);
            },
            cancel: () => resolve(false),
        });
    });
}

export class FilterConfiguration extends Component {
    static components = { DomainSelector };
    static template = "web_studio.FilterConfiguration";
    static props = {
        resModel: { type: String },
        configurationModel: { type: Object },
    };
    static Model = class FilterConfigurationModel {
        constructor() {
            this.filterLabel = "";
            this.domain = "[]";
        }

        get isValid() {
            return !!this.filterLabel;
        }
    };

    setup() {
        this.state = useState(this.props.configurationModel);
    }

    get domainSelectorProps() {
        return {
            resModel: this.props.resModel,
            readonly: false,
            domain: this.state.domain,
            update: (domainStr) => {
                this.state.domain = domainStr;
            },
            isDebugMode: !!this.env.debug,
        };
    }
}
