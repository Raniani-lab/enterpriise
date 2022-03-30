/** @odoo-module **/

import MockServer from 'web.MockServer';
import session from 'web.session';

MockServer.include({
    /**
     * Simulate the creation of a custom appointment type
     * by receiving a list of slots.
     * @override
     */
    async _performRpc(route, args) {
        const _super = this._super.bind(this);
        if (route === "/appointment/appointment_type/search_create_work_hours") {
            let workHoursAppointmentID = this._mockSearch(
                'appointment.type',
                [[['category', '=', 'work_hours'], ['staff_user_ids', 'in', [session.uid]]]],
                {},
            )[0];
            if (!workHoursAppointmentID) {
                workHoursAppointmentID = this._mockCreate('appointment.type', {
                    name: "Work Hours with Actual Employee",
                    staff_user_ids: [session.uid],
                    category: 'work_hours',
                    website_published: true,
                });
            }
            return {
                id: workHoursAppointmentID,
                url: `http://amazing.odoo.com/appointment/3?filter_staff_user_ids=%5B${session.uid}%5D`,
            };
        } else if (route === "/appointment/appointment_type/get_staff_user_appointment_types") {
            /* This route will come before the existing same route from appointment, called below,
            * hence will be chosen in priority.
            */
            if (session.uid) {
                const domain = [
                    ['staff_user_ids', 'in', [session.uid]],
                    ['category', '!=', 'custom'],
                    ['website_published', '=', true],
                ];
                const appointment_types_info = this._mockSearchRead('appointment.type', [domain, ['category', 'name']], {});
                /* As this overrides route in appointment module, it would throw an error since Qunit module
                *  appointment.appointment_link' do not have any hr.employee fields. Make sure there is some
                *  useful data. TODO : make this clean.
                */
                let context_user_employees = [];
                const hasDataHrEmployeeModel = typeof this.data['hr.employee'] !== 'undefined';
                if (hasDataHrEmployeeModel) {
                    context_user_employees = this._mockSearch('hr.employee', [[['user_id', '=', session.uid]]], {});
                }
                return Promise.resolve({
                    appointment_types_info: appointment_types_info,
                    context_user_has_employee: context_user_employees.length > 0
                });
            }
            return {};
        }
        return await _super(...arguments);
    },
});
