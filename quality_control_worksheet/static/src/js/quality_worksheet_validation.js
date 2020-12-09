odoo.define('quality_control_worksheet.WorksheetValidationView', function (require) {
"use strict";

const FormController = require('web.FormController');
const FormView = require('web.FormView');
const viewRegistry = require('web.view_registry');


const WorksheetValidationController = FormController.extend({
    /**
     * @override
     */
    saveRecord: async function () {
        return this._super(...arguments).then(res => {
            const record = this.model.get(this.handle);
            this._rpc({
                method: 'action_worksheet_check',
                model: 'quality.check',
                args: [[record.data.x_quality_check_id.res_id]],
            }).then(action => {
                this.do_action(action);
            });
        });
    },
});


const WorksheetValidationView = FormView.extend({
    config: Object.assign({}, FormView.prototype.config, {
        Controller: WorksheetValidationController,
    }),
});

viewRegistry.add('worksheet_validation', WorksheetValidationView);

});
