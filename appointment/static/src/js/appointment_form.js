/** @odoo-module **/

import publicWidget from "web.public.widget";

publicWidget.registry.appointmentForm = publicWidget.Widget.extend({
    selector: '.o_appointment_attendee_form',
    events: {
        'click .appointment_submit_form .btn': ' async _validateCheckboxes',
    },

    _validateCheckboxes: function() {
        this.$el.find('.checkbox-group.required').each(function() {
            var checkboxes = $(this).find('.checkbox input');
            checkboxes.prop('required', !_.any(checkboxes, checkbox => checkbox.checked));
        });
        if ($(this.$el.find('form'))[0].checkValidity()) {
            return new Promise((resolve, reject) => {});
        }
    },
});
