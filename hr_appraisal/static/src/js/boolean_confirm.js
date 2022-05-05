/** @odoo-module */

import { BooleanToggle } from 'web.basic_fields'
import { _t } from 'web.core';
import Dialog from 'web.Dialog';
import field_registry from 'web.field_registry';

const BooleanToggleConfirm = BooleanToggle.extend({
    async _onClick(event) {
        event.stopPropagation();

        const isEmployee = this.recordData.employee_user_id && this.recordData.employee_user_id.data.id === this.getSession().uid;
        const isManager = this.recordData.is_appraisal_manager || this.recordData.is_implicit_manager;
        if (isManager && !this.value && !isEmployee) {
            if (this.dialog)
                return;

            this.dialog = Dialog.confirm(this,
                _t("The employee's feedback will be published without their consent. Do you really want to publish it? This action will be logged in the chatter."), {
                confirm_callback: async () => {
                    await this._setValue(!this.value);
                    this._render();
                },
            });
            this.dialog.on('closed', this, () => this.dialog = undefined);
        }
        else {
            await this._super.apply(this, arguments);
        }
    },
});

field_registry.add('boolean_toggle_confirm', BooleanToggleConfirm);
