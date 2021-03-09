# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import babel.dates

from odoo import api, fields, models
from odoo.tools.misc import format_date
from odoo.tools.float_utils import float_round

from odoo.fields import Datetime, Date


class FleetVehicle(models.Model):
    _inherit = 'fleet.vehicle'

    co2_fee = fields.Float(compute='_compute_co2_fee', string="CO2 Fee")
    total_depreciated_cost = fields.Float(compute='_compute_total_depreciated_cost',
        string="Total Cost (Depreciated)", tracking=True, compute_sudo=True,
        help="This includes all the depreciated costs and the CO2 fee")
    total_cost = fields.Float(compute='_compute_total_cost', string="Total Cost", help="This include all the costs and the CO2 fee")
    fuel_type = fields.Selection(required=True, default='diesel')
    atn = fields.Float(compute='_compute_car_atn', string="ATN")
    acquisition_date = fields.Date(required=True)
    tax_deduction = fields.Float(compute='_compute_tax_deduction')

    def _from_be(self):
        if self:
            return self.company_id.country_id.code == "BE"
        else:
            return self.env.company.country_id.code == "BE"

    @api.depends('co2_fee', 'log_contracts', 'log_contracts.state', 'log_contracts.recurring_cost_amount_depreciated')
    def _compute_total_depreciated_cost(self):
        for car in self:
            car.total_depreciated_cost = car.co2_fee + \
                sum(car.log_contracts.filtered(
                    lambda contract: contract.state == 'open'
                ).mapped('recurring_cost_amount_depreciated'))

    @api.depends('co2_fee', 'log_contracts', 'log_contracts.state', 'log_contracts.cost_generated')
    def _compute_total_cost(self):
        for car in self:
            car.total_cost = car.co2_fee
            contracts = car.log_contracts.filtered(
                lambda contract: contract.state == 'open' and contract.cost_frequency != 'no'
            )
            for contract in contracts:
                if contract.cost_frequency == "daily":
                    car.total_cost += contract.cost_generated * 30.0
                elif contract.cost_frequency == "weekly":
                    car.total_cost += contract.cost_generated * 4.0
                elif contract.cost_frequency == "monthly":
                    car.total_cost += contract.cost_generated
                elif contract.cost_frequency == "yearly":
                    car.total_cost += contract.cost_generated / 12.0

    @api.depends('fuel_type', 'co2')
    def _compute_tax_deduction(self):
        be_vehicles = self.filtered(lambda vehicle: vehicle.company_id.country_id.code == "BE")
        (self - be_vehicles).tax_deduction = 0
        coefficients = self.env['hr.rule.parameter'].sudo()._get_parameter_from_code('tax_deduction_fuel_coefficients', raise_if_not_found=False)
        for vehicle in be_vehicles:
            fuel = vehicle.fuel_type
            co2 = vehicle.co2
            if fuel == 'electric':
                deduction = 1
            elif co2 >= 200:
                deduction = 0.4
            elif coefficients and fuel in coefficients:
                deduction = 1.2 - (0.005 * coefficients.get(fuel) * co2)
                deduction = min(max(deduction, 0.5), 1)
            else:
                deduction = 0
            vehicle.tax_deduction = deduction

    def _get_co2_fee(self, co2, fuel_type):
        # Reference: https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/companycar.html
        if not self._from_be() or self.vehicle_type == 'bike':
            return 0
        date = self.env.context.get('co2_fee_date', fields.Date.today())
        fuel_coefficient = self.env['hr.rule.parameter']._get_parameter_from_code('fuel_coefficient', date)
        co2_fee_min = self.env['hr.rule.parameter']._get_parameter_from_code('co2_fee_min', date)
        co2_fee = co2_fee_min
        if fuel_type and fuel_type in ['gasoline', 'diesel', 'lpg']:
            health_indice = self.env['hr.rule.parameter']._get_parameter_from_code('health_indice', date)
            health_indice_reference = self.env['hr.rule.parameter']._get_parameter_from_code('health_indice_reference', date)
            co2_fee = ((co2 * 9.0) - fuel_coefficient.get(fuel_type)) * health_indice / health_indice_reference / 12.0
        return max(co2_fee, co2_fee_min)

    @api.depends('co2', 'fuel_type', 'company_id.country_id')
    def _compute_co2_fee(self):
        for car in self:
            car.co2_fee = car._get_co2_fee(car.co2, car.fuel_type)

    @api.depends('fuel_type', 'car_value', 'acquisition_date', 'co2', 'company_id.country_id')
    def _compute_car_atn(self):
        for car in self:
            car.atn = car._get_car_atn()

    @api.depends('model_id', 'license_plate', 'log_contracts', 'acquisition_date',
                 'co2_fee', 'log_contracts', 'log_contracts.state', 'log_contracts.recurring_cost_amount_depreciated')
    def _compute_vehicle_name(self):
        super(FleetVehicle, self)._compute_vehicle_name()
        for vehicle in self:
            acquisition_date = vehicle._get_acquisition_date()
            vehicle.name += u" \u2022 " + acquisition_date

    def _get_analytic_name(self):
        # This function is used in fleet_account
        name = super(FleetVehicle, self)._get_analytic_name()
        if self.tax_deduction:
            return '%s, %s%s' % (name, round(self.tax_deduction * 100, 2), "%")
        else:
            return name

    @api.model
    def create(self, vals):
        res = super(FleetVehicle, self).create(vals)
        if not res.log_contracts:
            self.env['fleet.vehicle.log.contract'].create({
                'vehicle_id': res.id,
                'recurring_cost_amount_depreciated': res.model_id.default_recurring_cost_amount_depreciated,
                'purchaser_id': res.driver_id.id,
            })
        return res

    def _get_acquisition_date(self):
        self.ensure_one()
        return format_date(self.env, self.acquisition_date, date_format='MMMM y')

    def _get_car_atn(self, date=None):
        return self._get_car_atn_from_values(self.acquisition_date, self.car_value, self.fuel_type, self.co2, date)

    @api.model
    def _get_car_atn_from_values(self, acquisition_date, car_value, fuel_type, co2, date=None):
        if not self._from_be():
            return 0
        # Compute the correction coefficient from the age of the car
        date = date or Date.today()
        if acquisition_date:
            number_of_month = ((date.year - acquisition_date.year) * 12.0 + date.month -
                               acquisition_date.month +
                               int(bool(date.day - acquisition_date.day + 1)))
            if number_of_month <= 12:
                age_coefficient = 1.00
            elif number_of_month <= 24:
                age_coefficient = 0.94
            elif number_of_month <= 36:
                age_coefficient = 0.88
            elif number_of_month <= 48:
                age_coefficient = 0.82
            elif number_of_month <= 60:
                age_coefficient = 0.76
            else:
                age_coefficient = 0.70
            car_value = car_value * age_coefficient
            # Compute atn value from corrected car_value
            magic_coeff = 6.0 / 7.0  # Don't ask me why
            if fuel_type in ['electric', 'hydrogen']:
                atn = car_value * 0.04 * magic_coeff
            else:
                if fuel_type in ['diesel', 'hybrid', 'plug_in_hybrid_diesel']:
                    reference = self.env['hr.rule.parameter']._get_parameter_from_code('co2_reference_diesel', date)
                else:
                    reference = self.env['hr.rule.parameter']._get_parameter_from_code('co2_reference_petrol_lpg', date)

                if co2 <= reference:
                    atn = car_value * max(0.04, (0.055 - 0.001 * (reference - co2))) * magic_coeff
                else:
                    atn = car_value * min(0.18, (0.055 + 0.001 * (co2 - reference))) * magic_coeff
            return max(self.env['hr.rule.parameter']._get_parameter_from_code('min_car_atn', date), atn) / 12.0

    @api.onchange('model_id')
    def _onchange_model_id(self):
        self.car_value = self.model_id.default_car_value
        self.co2 = self.model_id.default_co2
        self.fuel_type = self.model_id.default_fuel_type


class FleetVehicleLogContract(models.Model):
    _inherit = 'fleet.vehicle.log.contract'

    recurring_cost_amount_depreciated = fields.Float("Depreciated Cost Amount", tracking=True)

    @api.model
    def create(self, vals):
        if not vals.get('recurring_cost_amount_depreciated', 0) and vals.get('vehicle_id'):
            vehicle_id = self.env['fleet.vehicle'].browse(vals['vehicle_id'])
            vals['recurring_cost_amount_depreciated'] = vehicle_id.model_id.default_recurring_cost_amount_depreciated
        return super(FleetVehicleLogContract, self).create(vals)


class FleetVehicleModel(models.Model):
    _inherit = 'fleet.vehicle.model'

    default_recurring_cost_amount_depreciated = fields.Float(string="Cost (Depreciated)",
        help="Default recurring cost amount that should be applied to a new vehicle from this model")
    default_co2 = fields.Float(string="CO2 emissions")
    default_fuel_type = fields.Selection([
        ('gasoline', 'Gasoline'),
        ('diesel', 'Diesel'),
        ('lpg', 'LPG'),
        ('electric', 'Electric'),
        ('hybrid', 'Hybrid'),
        ('plug_in_hybrid_diesel', 'Plug-in Hybrid Diesel'),
        ('plug_in_hybrid_gasoline', 'Plug-in Hybrid Gasoline'),
        ('full_hybrid_gasoline', 'Full Hybrid Gasoline'),
        ('cng', 'CNG'),
        ('hydrogen', 'Hydrogen'),
        ], 'Default Fuel Type', default='diesel', help='Fuel Used by the vehicle')
    default_car_value = fields.Float(string="Catalog Value (VAT Incl.)")
    can_be_requested = fields.Boolean(string="Can be requested", help="Can be requested on a contract as a new vehicle")
    default_atn = fields.Float(compute='_compute_atn', string="ATN")
    default_total_depreciated_cost = fields.Float(compute='_compute_default_total_depreciated_cost', compute_sudo=True, string="Total Cost (Depreciated)")
    co2_fee = fields.Float(compute='_compute_co2_fee', string="CO2 fee")

    @api.depends('default_car_value', 'default_co2', 'default_fuel_type')
    def _compute_atn(self):
        now = Datetime.now()
        for model in self:
            model.default_atn = self.env['fleet.vehicle']._get_car_atn_from_values(now, model.default_car_value, model.default_fuel_type, model.default_co2)

    @api.depends('co2_fee', 'default_recurring_cost_amount_depreciated')
    def _compute_default_total_depreciated_cost(self):
        for model in self:
            model.default_total_depreciated_cost = model.co2_fee + model.default_recurring_cost_amount_depreciated

    @api.depends('default_co2', 'default_fuel_type')
    def _compute_co2_fee(self):
        for model in self:
            if model.vehicle_type == 'bike':
                model.co2_fee = 0
            else:
                model.co2_fee = self.env['fleet.vehicle']._get_co2_fee(model.default_co2, model.default_fuel_type)
