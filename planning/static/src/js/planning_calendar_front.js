/* eslint-disable no-undef */
odoo.define('planning.calendar_frontend', function (require) {
"use strict";

const publicWidget = require('web.public.widget');

publicWidget.registry.PlanningView = publicWidget.Widget.extend({
    selector: '#calendar_employee',
    jsLibs: [
        '/web/static/lib/fullcalendar/core/main.js',
        '/web/static/lib/fullcalendar/interaction/main.js',
        '/web/static/lib/fullcalendar/moment/main.js',
        '/web/static/lib/fullcalendar/daygrid/main.js',
        '/web/static/lib/fullcalendar/timegrid/main.js',
        '/web/static/lib/fullcalendar/list/main.js'
    ],
    cssLibs: [
        '/web/static/lib/fullcalendar/core/main.css',
        '/web/static/lib/fullcalendar/daygrid/main.css',
        '/web/static/lib/fullcalendar/timegrid/main.css',
        '/web/static/lib/fullcalendar/list/main.css'
    ],

    init: function (parent, options) {
        this._super.apply(this, arguments);
    },
    start: function () {
       this._super.apply(this, arguments);
       this.calendarElement = this.$(".o_calendar_widget")[0];
       const employeeSlotsFcData = JSON.parse($('.employee_slots_fullcalendar_data').attr('value'));
       const locale = $('.locale').attr('value');
       this.calendar = new FullCalendar.Calendar($("#calendar_employee")[0], {
            // Settings
            plugins: [
                'moment',
                'dayGrid',
                'timeGrid'
            ],
            locale: locale,
            defaultView: 'dayGridMonth',
            titleFormat: 'MMMM YYYY',
            defaultDate: moment.min(employeeSlotsFcData.map(item => moment(item.start))).toDate(),
            timeFormat: 'LT',
            displayEventEnd: true,
            height: 'auto',
            eventTextColor: 'white',
            eventOverlap: true,
            eventTimeFormat: {
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short',
                omitZeroMinute: true,
            },
            header: {
                left: 'title',
                center: false,
                right: false
            },
            eventRender: function (info) {
                                $(info.el).css('font-weight', 'bold');
            },
            // Data
            events: employeeSlotsFcData,
            // Event Functions
            eventClick: this.eventFunction
            });
            this.calendar.render();
    },
    eventFunction: function (calEvent) {
        const planningToken = $('.planning_token').attr('value');
        const employeeToken = $('.employee_token').attr('value');
        $(".modal-title").text(calEvent.event.title);
        $(".modal-header").css("background-color", calEvent.event.backgroundColor);
        $("#start").text(moment(calEvent.event.start).format("YYYY-MM-DD hh:mm A"));
        $("#stop").text(moment(calEvent.event.end).format("YYYY-MM-DD hh:mm A"));
        $("#alloc_hours").text(calEvent.event.extendedProps.alloc_hours);
        if (calEvent.event.extendedProps.alloc_perc !== 100) {
            $("#alloc_perc").text(calEvent.event.extendedProps.alloc_perc + "%");
            $("#alloc_perc").prev().css("display", "");
            $("#alloc_perc").css("display", "");
        } else {
            $("#alloc_perc").prev().css("display", "none");
            $("#alloc_perc").css("display", "none");
        }
        $("#allow_self_unassign").text(calEvent.event.extendedProps.allow_self_unassign);
        if (calEvent.event.extendedProps.note) {
            $("#note").prev().css("display", "");
            $("#note").text(calEvent.event.extendedProps.note);
            $("#note").css("display", "");
        } else {
            $("#note").prev().css("display", "none");
            $("#note").text("");
        }
        if (calEvent.event.extendedProps.allow_self_unassign) {
            document.getElementById("dismiss_shift").style.display = "block";
        } else {
            document.getElementById("dismiss_shift").style.display = "none";
        }
        $("#modal_action_dismiss_shift").attr("action", "/planning/" + planningToken + "/" + employeeToken + "/unassign/" + calEvent.event.extendedProps.slot_id);
        $("#fc-slot-onclick-modal").modal("show");
    },
});

// Add client actions
return publicWidget.registry.PlanningView;
});
