odoo.define('website_calendar.select_appointment_type', function (require) {
'use strict';

var sAnimations = require('website.content.snippets.animation');
var ajax = require('web.ajax');

require('web_editor.ready');

sAnimations.registry.websiteCalendarSelect = sAnimations.Class.extend({
    selector: '.o_website_calendar_appointment',
    read_events: {
        'change .o_website_appoinment_form select[id="calendarType"]': '_onAppointmentTypeChange'
    },

    /**
     * @override
     * @param {Object} parent
     */
    start: function (parent) {
        // set default timezone
        var timezone = jstz.determine();
        $(".o_website_appoinment_form select[name='timezone']").val(timezone.name());
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * On appointment type change: adapt appointment intro text and available employees (if option enabled)
     *
     * @override
     */
    _onAppointmentTypeChange: function () {
        _.debounce(function () {
            var appointment_id = $(this).val();
            var previous_selected_employee_id = $(".o_website_appoinment_form select[name='employee_id']").val();
            var post_url = '/website/calendar/' + appointment_id + '/appointment';
            $(".o_website_appoinment_form").attr('action', post_url);
            ajax.jsonRpc("/website/calendar/get_appointment_info", 'call', {
                appointment_id: appointment_id,
                prev_emp: previous_selected_employee_id,
            }).then(function (data) {
                if (data) {
                    $('.o_calendar_intro').html(data.message_intro);
                    if (data.assignation_method === 'chosen') {
                        $(".o_website_appoinment_form div[name='employee_select']").replaceWith(data.employee_selection_html);
                    } else {
                        $(".o_website_appoinment_form div[name='employee_select']").addClass('o_hidden');
                        $(".o_website_appoinment_form select[name='employee_id']").children().remove();
                    }
                }
            });
        }, 250);
    },

});

});

odoo.define('website_calendar.appointment_form', function (require) {
'use strict';

var sAnimations = require('website.content.snippets.animation');

require('web_editor.ready');

sAnimations.registry.websiteCalendarForm = sAnimations.Class.extend({
    selector: '.o_website_calendar_form',
    read_events: {
        'change .appointment_submit_form select[name="country_id"]': '_onUpdateCountry'
    },

    /**
     * @override
     */
    _onUpdateCountry: function () {
        var country_code = $(this).find('option:selected').data('phone-code');
        $('.appointment_submit_form #phone_field').val(country_code);
    },

});

});
