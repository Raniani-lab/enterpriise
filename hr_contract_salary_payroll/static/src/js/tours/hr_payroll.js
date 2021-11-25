/** @odoo-module **/

import tour from 'web_tour.tour';

if (tour.tours.payroll_tours) {
    delete tour.tours['payroll_tours'];
}
