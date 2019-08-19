# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details

from datetime import datetime

from odoo.tests.common import Form

from .test_recurrency import TestCommonPlanning


class TestRecurrencyWizards(TestCommonPlanning):

    @classmethod
    def setUpClass(cls):
        super(TestRecurrencyWizards, cls).setUpClass()

        cls.setUpEmployees()

        cls.env.company.write({
            'planning_generation_interval': 1,
            'planning_generation_uom': 'month',
        })

    def test_create_wizard_entering_repeat_create_the_new_shift_and_recurrency(self):
        with self._patch_now('2019-06-01 08:00:00'):
            ctx = {
                'default_employee_id': self.employee_bert.id,
                'default_start_datetime': datetime(2019, 6, 1, 0, 0),
                'default_end_datetime': datetime(2019, 6, 1, 23, 59),
            }

            wizard = None
            with Form(self.env['planning.create.slot'].with_context(ctx)) as create_wizard:
                create_wizard.repeat = True
                create_wizard.repeat_interval = 1
                create_wizard.repeat_unit = 'week'
                create_wizard.repeat_until = False
                wizard = create_wizard.save()

            wizard.action_create_new()

            self.assertEqual(len(self.env['planning.recurrency'].search([])), 1, 'the repeat option on the wizard made it create a recurrency')
            self.assertEqual(len(self.env['planning.recurrency'].search([]).slot_ids), 5, 'the recurrency has the right repeat_until from the wizard')

    def test_repeat_wizard_makes_a_shift_recurrent(self):
        with self._patch_now('2019-06-01 08:00:00'):
            ctx = {
                'default_employee_id': self.employee_bert.id,
                'default_start_datetime': datetime(2019, 6, 1, 0, 0),
                'default_end_datetime': datetime(2019, 6, 1, 23, 59),
            }

            form = Form(self.env['planning.create.slot'].with_context(ctx))
            wizard = form.save()
            shift = wizard.action_create_new()
            self.assertFalse(shift.recurrency_id)
            self.assertFalse(self.env['planning.recurrency'].search([]))

            ctx = {
                'active_id': shift.id,
                'active_model': 'planning.slot',
            }

            wizard = None
            with Form(self.env['planning.repeat.slot'].with_context(ctx)) as repeat_wizard:
                repeat_wizard.repeat_interval = 1
                repeat_wizard.repeat_unit = 'week'
                wizard = repeat_wizard.save()
            wizard.action_repeat()

            recurrency = self.env['planning.recurrency'].search([])
            self.assertEqual(len(recurrency), 1, 'it create a new recurrency')
            self.assertEqual(shift.recurrency_id, recurrency, 'it attached our active shift to the recurrency')
            self.assertEqual(self.env['planning.slot'].search_count([('recurrency_id', '=', recurrency.id)]), 5, '5 occurrences of the shift should be generate in the recurrency')
