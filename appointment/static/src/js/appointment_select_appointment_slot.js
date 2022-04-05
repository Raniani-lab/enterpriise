odoo.define('appointment.select_appointment_slot', function (require) {
'use strict';

var core = require('web.core');
var publicWidget = require('web.public.widget');
var qweb = core.qweb;

publicWidget.registry.appointmentSlotSelect = publicWidget.Widget.extend({
    selector: '.o_appointment',
    xmlDependencies: [
        '/appointment/static/src/xml/appointment_slots.xml',
        '/appointment/static/src/xml/appointment_no_slot.xml',
    ],
    events: {
        'change select[name="timezone"]': '_onRefresh',
        'change select[id="selectStaffUser"]': '_onRefresh',
        'click .o_js_calendar_navigate': '_onCalendarNavigate',
        'click .o_day': '_onClickDaySlot',
    },

    /**
     * @override
     */
    start: function () {
        return this._super(...arguments).then(async () => {
            this.initSlots();
        });
    },

    /**
     * Initializes variables and design
     * - $slotsList: the block containing the availabilities
     * - $first: the first day containing a slot
     */
    initSlots: async function () {
        this.$slotsList = this.$('#slotsList');
        this.$first = this.$('.o_day').first();
        await this._updateSlotAvailability();
    },

    /**
     * Finds the first day with an available slot, replaces the currently shown month and
     * click on the first date where a slot is available.
     */
    selectFirstAvailableMonth: function () {
        const $firstMonth = this.$first.closest('.o_appointment_month');
        const $currentMonth = this.$('.o_appointment_month:not(.d-none)');
        $currentMonth.addClass('d-none');
        $firstMonth.removeClass('d-none');
        this.$slotsList.empty();
        this.$first.click();
    },

    /**
     * Checks whether any slot is available in the calendar.
     * If there isn't, adds an explicative message in the slot list.
     *
     */
     _updateSlotAvailability: function () {
        if (!this.$first.length) { // No slot available
            if (!this.$slotsList.hasClass('o_no_slot')) {
                this.$('#slots_availabilities').empty().append(qweb.render('Appointment.appointment_info_no_slot'));
            }
        }
    },

    /**
     * Navigate between the months available in the calendar displayed
     */
    _onCalendarNavigate: function (ev) {
        const parent = this.$('.o_appointment_month:not(.d-none)');
        let monthID = parseInt(parent.attr('id').split('-')[1]);
        monthID += ((this.$(ev.currentTarget).attr('id') === 'nextCal') ? 1 : -1);
        parent.addClass('d-none');
        const $month = $(`div#month-${monthID}`).removeClass('d-none');
        this.$('.o_slot_selected').removeClass('o_slot_selected');
        this.$slotsList.empty();

        if (!!this.$first.length) {
            // If there is at least one slot available, check if it is in the current month.
            this.$slotsList.removeClass('o_no_slot');
            if (!$month.find('.o_day').length) {
                const slotDate = this.$first.children().first().attr('id');
                this.$slotsList.append(qweb.render('Appointment.appointment_info_no_slot_month', {
                    date_first_availability: moment(slotDate).format('dddd D MMMM YYYY'),
                }));
                $('#next_available_slot').on('click', () => this.selectFirstAvailableMonth());
            }
        }
    },

    /**
     * Display the list of slots available for the date selected
     */
    _onClickDaySlot: function (ev) {
        this.$('.o_slot_selected').removeClass('o_slot_selected');
        this.$(ev.currentTarget).addClass('o_slot_selected');

        const appointmentTypeID = this.$("input[name='appointment_type_id']").val();
        const slotDate = this.$(ev.currentTarget.firstElementChild).attr('id');
        const slots = JSON.parse(this.$(ev.currentTarget).find('div')[0].dataset['availableSlots']);
        const commonUrlParams = window.location.search.substring(1);

        this.$slotsList.empty().append(qweb.render('appointment.slots_list', {
            commonUrlParams: commonUrlParams,
            slotDate: moment(slotDate).format("dddd D MMMM"),
            slots: slots,
            url: `/appointment/${appointmentTypeID}/info`,
        }));
    },

    /**
     * Refresh the slots info when the user modifies the timezone or the assigned user.
     */
    _onRefresh: function (ev) {
        if (this.$("#slots_availabilities")[0]) {
            const self = this;
            const appointmentTypeID = this.$("input[name='appointment_type_id']").val();
            const filterAppointmentTypeIds = this.$("input[name='filter_appointment_type_ids']").val();
            const filterUserIds = this.$("input[name='filter_staff_user_ids']").val();
            const inviteToken = this.$("input[name='invite_token']").val();
            const staffUserID = this.$("#slots_form select[name='staff_user_id']").val();
            const timezone = this.$("select[name='timezone']").val();
            this._rpc({
                route: `/appointment/${appointmentTypeID}/update_available_slots`,
                params: {
                    invite_token: inviteToken,
                    filter_appointment_type_ids: filterAppointmentTypeIds,
                    filter_staff_user_ids: filterUserIds,
                    staff_user_id: staffUserID,
                    timezone: timezone,
                },
            }).then(function (data) {
                if (data) {
                    self.$("#slots_availabilities").replaceWith(data);
                    self.initSlots();
                }
            });
        }
    },
});
});
