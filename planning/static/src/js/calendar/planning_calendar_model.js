/** @odoo-module */

import CalendarModel from 'web.CalendarModel';

const PlanningCalendarModel = CalendarModel.extend({
    /**
     * @public
     * @returns {moment} Date
     */
    convertToServerTime(date) {
        return date.clone().utc().locale('en').format('YYYY-MM-DD HH:mm:ss');
    },

    /**
     * @public
     * @returns {moment} startDate
     */
    getStartDate() {
        return this.convertToServerTime(this.get().start_date);
    },

   /**
     * Returns start and end date of currently selected range (day/week/month/year)
     *
     * @public
     * @returns { 'startDate': moment(), 'endDate': moment() }
     */
    getDates() {
        let startDate = this.get().start_date;
        let endDate = this.get().end_date;
        if (['month', 'year'].includes(this.data.scale)) {
            startDate = this.get().target_date.clone().startOf(this.data.scale);
            endDate = this.get().target_date.clone().endOf(this.data.scale);
        }
        return {
            'startDate': this.convertToServerTime(startDate),
            'endDate': this.convertToServerTime(endDate),
        }
    },

    /**
     * @public
     * @param {Object} ctx
     * @returns {Object} context
     */
    getAdditionalContext(ctx) {
        const state = this.get();
        const { startDate, endDate } = this.getDates();
        return Object.assign({}, ctx, {
            'default_start_datetime': startDate,
            'default_end_datetime': endDate,
            'default_slot_ids': state.data.map(state => state.id),
            'scale': state.scale,
            'active_domain': state.domain,
            'active_ids': state.data,
        });
    },

    /**
     * @private
     * @returns {Array[]} domain
     */
    _getDomain() {
        const domain = this._getRangeDomain()
        return this.data.domain.concat(domain);
    }
});

export default PlanningCalendarModel;
