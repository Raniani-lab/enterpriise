/** @odoo-module **/

import MockServer from 'web.MockServer';
import session from 'web.session';

MockServer.include({
    /**
     * Simulate the creation of an anytime appointment type.
     * @override
     */
    async _performRpc(route, args) {
        const _super = this._super.bind(this);
        if (route === "/appointment/appointment_type/search_create_anytime") {
            let anytimeAppointmentID = this._mockSearch(
                'appointment.type',
                [[['category', '=', 'anytime'], ['staff_user_ids', 'in', [session.uid]]]],
                {},
            )[0];
            if (!anytimeAppointmentID) {
                anytimeAppointmentID = this._mockCreate('appointment.type', {
                    name: "Anytime with Actual User",
                    staff_user_ids: [session.uid],
                    category: 'anytime',
                    website_published: true,
                });
            }
            return {
                appointment_type_id: anytimeAppointmentID,
                invite_url: `http://amazing.odoo.com/appointment/3?filter_staff_user_ids=%5B${session.uid}%5D`,
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
                return Promise.resolve({
                    appointment_types_info: appointment_types_info
                });
            }
            return {};
        }
        return await _super(...arguments);
    },
});
