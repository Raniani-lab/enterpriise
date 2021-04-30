odoo.define('website_calendar.appointment_form', function (require) {
'use strict';

var publicWidget = require('web.public.widget');

publicWidget.registry.websiteCalendarForm = publicWidget.Widget.extend({
    selector: '.o_wcalendar_attendee_form',
    events: {
        'click .appointment_submit_form .btn': '_validateCheckboxes',
    },

    _validateCheckboxes: function() {
        this.$target.find('.form-group .checkbox-group.required').each(function() {
            var checkboxes = $(this).find('.checkbox input');
            checkboxes.prop('required', !_.any(checkboxes, checkbox => checkbox.checked));
        });
    },
});
});
