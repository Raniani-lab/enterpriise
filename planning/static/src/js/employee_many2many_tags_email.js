/** @odoo-module alias=planning.EmployeeMany2ManyTagsEmail **/

import field_registry from 'web.field_registry';
import { FormViewDialog } from 'web.view_dialogs';
import { FieldMany2ManyTags } from 'web.relational_fields';


// We need to override the model of the view containing this widget as the planning.send form view.
const EmployeeMany2ManyTagsEmail = FieldMany2ManyTags.extend({
    fieldsToFetch: Object.assign({}, FieldMany2ManyTags.prototype.fieldsToFetch, {
        work_email: { type: 'char' },
    }),
    specialData: "_setInvalidMany2ManyTagsEmail",

    _checkEmailPopup: function () {
        const popupDefs = [];
        let validEmployees = [];

        // propose the user to correct invalid employees
        this.record.specialData[this.name].invalidEmployeeIds.forEach((resID) => {
            const def = new Promise((resolve, reject) => {
                const context = Object.assign({}, this.record.context, { 'force_email': true });
                const formDialog = new FormViewDialog(this, {
                    title: "",
                    res_model: this.field.relation,
                    res_id: resID,
                    context,
                    on_saved: (record) => {
                        if (record.data.work_email) {
                            validEmployees.push(record.res_id);
                        }
                    },
                }).open();
                formDialog.on('closed', this, () => resolve());
            });
            popupDefs.push(def);
        });
        return Promise.all(popupDefs)
            .then(() => {
                validEmployees = [...new Set(validEmployees)];
                if (validEmployees.length) {
                    const values = validEmployees.map((id) => ({ id }));
                    console.log(values);
                    this._setValue({
                        operation: 'ADD_M2M',
                        ids: values,
                    });
                }
            });
    },
    _render: function() {
        const _super = this._super.bind(this);
        return new Promise((resolve, reject) => {
            if (this.record.specialData[this.name].invalidEmployeeIds.length) {
                resolve(this._checkEmailPopup());
            } else {
                resolve();
            }
        }).then(() => _super.apply(this, arguments));
    }
});

field_registry.add('employee_many2many_tags_email', EmployeeMany2ManyTagsEmail);

export default EmployeeMany2ManyTagsEmail;
