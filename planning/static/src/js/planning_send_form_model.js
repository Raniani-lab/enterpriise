/** @odoo-module alias=planning.PlanningSendFormModel */

import BasicModel from 'web.BasicModel';

/**
 * This model is used for the planning.slot form view and planning.send form view.
 * When the user wants to send the planning to his employees and some ones
 * The goal is the redirect the user to a quick form view of hr.employee.public
 * to define the work email of this employee to send the planning.
 */
export default BasicModel.extend({
    /**
     * @override
     * @see many2many_tags_email.js file to see this model create in BasicModel.
     *
     * @param {Object} record
     * @param {string} fieldName
     * @return {Promise<Object>}
     */
    _setInvalidMany2ManyTagsEmail: function (record, fieldName) {
        const localID = (record._changes && fieldName in record._changes) ? record._changes[fieldName] : record.data[fieldName];
        const list = this._applyX2ManyOperations(this.localData[localID]);
        const invalidEmployeeIds = [];
        list.data.forEach((id) => {
            const record = this.localData[id];
            if (!record.data.work_email) {
                invalidEmployeeIds.push(record);
            }
        });
        let def;
        if (invalidEmployeeIds.length) {
            // remove invalid employees
            const changes = {
                operation: 'DELETE',
                ids: invalidEmployeeIds.map((employee) => employee.id),
            };
            def = this._applyX2ManyChange(record, fieldName, changes) ;
        }
        return Promise
                    .resolve(def)
                    .then(
                        () => ({ invalidEmployeeIds: invalidEmployeeIds.map(
                            employee => employee.res_id) })
                    );
    }
});
