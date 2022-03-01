/** @odoo-module **/

import CalendarModel from 'calendar.CalendarModel';

CalendarModel.include({
    /**
     * @override
     */
    __get() {
        var result = this._super(...arguments);
        result.contextUserHasEmployee = this.data.contextUserHasEmployee;
        return result;
    },
    /**
     * We precise to the model whether the user has an employee or not.
     * @override
     * @returns {Promise}
     */
     async _loadCalendar() {
        const _super = this._super.bind(this);
        var result = await _super(...arguments);
        this.data.contextUserHasEmployee = this.data.appointmentStaffUserInfo.context_user_has_employee;
        return result;
    },
});
