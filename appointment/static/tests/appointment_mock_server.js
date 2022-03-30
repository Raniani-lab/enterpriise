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
        if (route === "/appointment/appointment_type/create_custom") {
            const slots = args.slots;
            if (slots.length === 0) {
                return false;
            }
            const customAppointmentTypeID = this._mockCreate('appointment.type', {
                name: "Appointment with Actual User",
                staff_user_ids: [session.uid],
                category: 'custom',
                website_published: true,
            });
            let slotIDs = [];
            slots.forEach(slot => {
                const slotID = this._mockCreate('appointment.slot', {
                    appointment_type_id: customAppointmentTypeID,
                    start_datetime: slot.start,
                    end_datetime: slot.end,
                    slot_type: 'unique',
                });
                slotIDs.push(slotID);
            });
            return {
                id: customAppointmentTypeID,
                url: `http://amazing.odoo.com/appointment/3?filter_staff_user_ids=%5B${session.uid}%5D`,
            };
        } else if (route === "/appointment/appointment_type/get_staff_user_appointment_types") {
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
