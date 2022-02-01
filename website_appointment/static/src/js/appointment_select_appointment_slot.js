odoo.define('website_appointment.select_appointment_slot', function (require) {
'use strict';

const publicWidget = require('web.public.widget');
const appointmentSlotSelect = publicWidget.registry.appointmentSlotSelect;

appointmentSlotSelect.include({
    xmlDependencies: appointmentSlotSelect.prototype.xmlDependencies.concat([
        '/website_appointment/static/src/xml/appointment_no_slot.xml',
    ]),
});
});
