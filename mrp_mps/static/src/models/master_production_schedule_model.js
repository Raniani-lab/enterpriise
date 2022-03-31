/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { Mutex } from "@web/core/utils/concurrency";

const { EventBus } = owl;

export class MasterProductionScheduleModel extends EventBus {
    constructor(params, services) {
        super();
        this.domain = [];
        this.params = params;
        this.orm = services.orm;
        this.action = services.action;
        this.dialog = services.dialog;
        this.mutex = new Mutex();
    }

    async load(domain, offset = 0, limit = false) {
        if (domain) {
            this.domain = domain;
        }
        this.data = await this.orm.call( 'mrp.production.schedule', 'get_mps_view_state', [this.domain, offset, limit]);
        this.notify();
    }

    async reload(productionScheduleId) {
        const self = this;
        return await self.orm.call(
            'mrp.production.schedule',
            'get_impacted_schedule',
            [productionScheduleId, self.domain],
        ).then(function (productionScheduleIds) {
            productionScheduleIds.push(productionScheduleId);
            return self.orm.call(
                'mrp.production.schedule',
                'get_production_schedule_view_state',
                [productionScheduleIds],
            )
        }).then(function (production_schedule_ids){
            for (var i = 0; i < production_schedule_ids.length; i++) {
                const index = self.data.production_schedule_ids.findIndex(ps => ps.id === production_schedule_ids[i].id);
                if (index >= 0) {
                    self.data.production_schedule_ids.splice(index, 1, production_schedule_ids[i]);
                } else {
                    self.data.production_schedule_ids.push(production_schedule_ids[i]);
                }
            }
            self.notify();
        });
    }

    notify() {
        this.trigger('update');
    }

    /**
     * Make an rpc to replenish the different schedules passed as arguments.
     * If the procurementIds list is empty, it replenish all the schedules under
     * the current domain. Reload the content after the replenish in order to
     * display the new forecast cells to run.
     *
     * @private
     * @param {Array} [productionScheduleIds] mrp.production.schedule ids to
     * replenish.
     * @return {Promise}
     */
     _actionReplenish(productionScheduleIds, basedOnLeadTime = false) {
        const self = this;
        this.mutex.exec(function () {
            return self.orm.call(
                'mrp.production.schedule',
                'action_replenish',
                [productionScheduleIds, basedOnLeadTime],
            ).then(function (){
                if (productionScheduleIds.length === 1) {
                    self.reload(productionScheduleIds[0]);
                } else {
                    self.load(self.domain);
                }
            });
        });
    }

    replenishAll() {
        this.orm.search("mrp.production.schedule", this.domain).then((ids) => {
            this._actionReplenish(ids, true);
        });
    }

    /**
     * Save the forecasted quantity and reload the current schedule in order
     * to update its To Replenish quantity and its safety stock (current and
     * future period). Also update the other schedules linked by BoM in order
     * to update them depending the indirect demand.
     *
     * @private
     * @param {Object} [productionScheduleId] mrp.production.schedule Id.
     * @param {Integer} [dateIndex] period to save (column number)
     * @param {Float} [forecastQty] The new forecasted quantity
     * @return {Promise}
     */
    _saveForecast(productionScheduleId, dateIndex, forecastQty) {
        const self = this;
        return this.mutex.exec(function() {
            self.orm.call(
                'mrp.production.schedule',
                'set_forecast_qty',
                [productionScheduleId, dateIndex, forecastQty],
            ).then(function () {
                return self.reload(productionScheduleId);
            });
        });
    }

    /**
     * Open the mrp.production.schedule form view in order to create the record.
     * Once the record is created get its state and render it.
     *
     * @private
     * @return {Promise}
     */
    _createProduct() {
        const self = this;
        this.mutex.exec(function () {
            self.action.doAction('mrp_mps.action_mrp_mps_form_view',{
                onClose: () => self.load(self.domain),
            });
        });
    }

    /**
     * Open the mrp.production.schedule form view in order to edit the record.
     * Once the record is edited get its state and render it.
     *
     * @private
     * @param {Object} [productionScheduleId] mrp.production.schedule Id.
     */
    _editProduct(productionScheduleId) {
        const self = this;
        this.mutex.exec(function () {
            self.action.doAction({
                name: 'Edit Production Schedule',
                type: 'ir.actions.act_window',
                res_model: 'mrp.production.schedule',
                views: [[false, 'form']],
                target: 'new',
                res_id: productionScheduleId,
            }, {
                onClose: () => self.reload(productionScheduleId),
            });
        });
    }

    /**
     * Unlink the production schedule and remove it from the DOM. Use a
     * confirmation dialog in order to avoid a mistake from the user.
     *
     * @private
     * @param {Object} [productionScheduleId] mrp.production.schedule Id.
     * @return {Promise}
     */
    _unlinkProduct(productionScheduleId) {
        const self = this;
        function doIt() {
            self.mutex.exec(function () {
                return self.orm.unlink(
                    'mrp.production.schedule',
                    [productionScheduleId],
                ).then(function () {
                    const index = self.data.production_schedule_ids.findIndex(ps => ps.id === productionScheduleId);
                    self.data.production_schedule_ids.splice(index, 1);
                    self.notify();
                });
            });
        }
        this.dialog.add(ConfirmationDialog, {
            body: _t("Are you sure you want to delete this record?"),
            title: _t("Confirmation"),
            confirm: () => doIt(),
        });
    }

    _actionOpenDetails(procurementId, action, dateStr, dateStart, dateStop) {
        const self = this;
        this.mutex.exec(function () {
            return self.orm.call(
                'mrp.production.schedule',
                action,
                [procurementId, dateStr, dateStart, dateStop]
            ).then(function (action){
                return self.action.doAction(action);
            });
        });
    }

    /**
     * Save the quantity To Replenish and reload the current schedule in order
     * to update it's safety stock and quantity in future period. Also mark
     * the cell with a blue background in order to show that it was manually
     * updated.
     *
     * @private
     * @param {Object} [productionScheduleId] mrp.production.schedule Id.
     * @param {Integer} [dateIndex] period to save (column number)
     * @param {Float} [replenishQty] The new quantity To Replenish
     * @return {Promise}
     */
    _saveToReplenish(productionScheduleId, dateIndex, replenishQty) {
        const self = this;
        return this.mutex.exec(function () {
            self.orm.call(
                'mrp.production.schedule',
                'set_replenish_qty',
                [productionScheduleId, dateIndex, replenishQty],
            ).then(function () {
                return self.reload(productionScheduleId);
            });
        });
    }

    _removeQtyToReplenish(productionScheduleId, dateIndex) {
        const self = this;
        return this.mutex.exec(function () {
            self.orm.call(
                'mrp.production.schedule',
                'remove_replenish_qty',
                [productionScheduleId, dateIndex]
            ).then(function () {
                return self.reload(productionScheduleId);
            });
        });
    }

    _getOriginValue(productionScheduleId, dateIndex, inputName) {
        return this.data.production_schedule_ids.find(ps => ps.id === productionScheduleId).forecast_ids[dateIndex][inputName];
    }

    /**
     * Save the company settings and hide or display the rows.
     *
     * @private
     * @param {Object} [values] {field_name: field_value}
     */
    _saveCompanySettings(values) {
        const self = this;
        this.mutex.exec(function () {
            self.orm.write(
                'res.company',
                [self.data.company_id],
                values,
            ).then(function () {
                self.load(self.domain);
            });
        });
    }

}

MasterProductionScheduleModel.services = ["action", "dialog"];
