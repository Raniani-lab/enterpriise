odoo.define('website_appointment.s_online_appointment', function (require) {
'use strict';

const publicWidget = require('web.public.widget');


const OnlineAppointmentCtaWidget = publicWidget.Widget.extend({
    selector: '.s_online_appointment',
    disabledInEditableMode: true,
    events: {
        'click': '_onCtaClick'
    },
    _onCtaClick: function (ev) {
        let url = '/appointment';

        const selectedAppointments = ev.target.dataset.appointmentTypes;
        const nbSelectedAppointments = JSON.parse(selectedAppointments);
        if (nbSelectedAppointments === 1) {
            url += `/${selectedAppointments[0]}`;
            const selectedUsers = ev.target.dataset.staffUsers;
            if (JSON.parse(selectedUsers).length) {
                url += `?filter_staff_user_ids=${selectedUsers}`;
            }
        } else if (nbSelectedAppointments > 1) {
            url += `?filter_appointment_type_ids=${selectedAppointments}`;
        }
        window.location = url;
    },
});

publicWidget.registry.online_appointment = OnlineAppointmentCtaWidget;

return OnlineAppointmentCtaWidget;
});
