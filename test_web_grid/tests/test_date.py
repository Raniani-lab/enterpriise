# -*- coding: utf-8 -*-

from .common import TestWebGrid
from odoo.fields import Date


class TestReadGridDomainDate(TestWebGrid):

    def test_read_grid_domain_date(self):

        field = "start_date"
        grid_anchor = '2019-06-14'

        domain_day = self.grid_obj_2.with_context(grid_anchor=grid_anchor).read_grid_domain(field, self.range_day)

        # For checking different span and step in week
        domain_week = self.grid_obj_2.with_context(grid_anchor=grid_anchor).read_grid_domain(field, self.range_week)
        domain_week_2 = self.grid_obj_2.with_context(grid_anchor=grid_anchor).read_grid_domain(field, self.range_week_2)

        domain_month = self.grid_obj_2.with_context(grid_anchor=grid_anchor).read_grid_domain(field, self.range_month)

        self.assertEqual(domain_day, ['&', ('start_date', '>=', '2019-06-01'), ('start_date', '<=', '2019-06-30')])
        self.assertEqual(domain_week, ['&', ('start_date', '>=', '2019-06-10'), ('start_date', '<=', '2019-06-16')])
        self.assertEqual(domain_week_2, ['&', ('start_date', '>=', '2019-05-27'), ('start_date', '<=', '2019-06-30')])
        self.assertEqual(domain_month, ['&', ('start_date', '>=', '2019-01-01'), ('start_date', '<=', '2019-12-31')])

    def test_read_grid_method_date(self):
        project_id = self.grid_obj_2.project_id
        grid_range = self.range_day
        row_field = []
        col_field = "start_date"
        cell_field = "resource_hours"
        domain = [('project_id', '=', project_id.id)]

        # A call to read_grid with grid_anchor should return data from 2019-06-01 to 2019-06-30
        result_read_grid = self.grid_obj_2.with_context(grid_anchor="2019-06-14").read_grid(row_field, col_field, cell_field, domain, grid_range)

        # For checking today, previous and next grid_anchor
        self.assertEqual(result_read_grid.get('prev').get('grid_anchor'), "2019-05-14")
        self.assertEqual(result_read_grid.get('next').get('grid_anchor'), "2019-07-14")
        today = Date.from_string(Date.context_today(self.env.user))
        self.assertEqual(result_read_grid.get('initial').get('grid_anchor'), Date.to_string(today))

        # Should have 30 cols for 30 days of June and 1 row for grid_obj_2
        self.assertEqual(len(result_read_grid.get('cols')), 30)
        self.assertEqual(len(result_read_grid.get('rows')), 1)

        date_of_work = self.grid_obj_2.start_date.day - 1
        self.assertEqual(result_read_grid.get('grid')[0][date_of_work].get('value'), self.grid_obj_2.resource_hours)

        # For checking readonly of freeze cell
        result_read_grid_readonly = self.grid_obj_2_validated.with_context(grid_anchor="2019-06-14").read_grid(row_field, col_field, cell_field, domain, grid_range, readonly_field='validated')
        date_of_work = self.grid_obj_2_validated.start_date.day - 1
        self.assertEqual(result_read_grid_readonly.get('grid')[0][date_of_work].get('readonly'), True)

        # For checking week range ('span': 'month', 'step': 'week')
        result_read_grid = self.grid_obj_2.with_context(grid_anchor="2019-06-14").read_grid(row_field, col_field, cell_field, domain, self.range_week_2)
        # Should have 5 weeks in cols
        self.assertEqual(len(result_read_grid.get('cols')), 5)
        col0 = result_read_grid.get('cols')[0]
        week1_start_date0 = col0.get('values').get('start_date')
        self.assertEqual(week1_start_date0[0], "2019-05-27/2019-06-03")
        col4 = result_read_grid.get('cols')[4]
        week1_start_date4 = col4.get('values').get('start_date')
        self.assertEqual(week1_start_date4[0], "2019-06-24/2019-07-01")
        # Since the start_date for obj_2 is 2019-06-04, so it is the second week according to its domain
        self.assertEqual(result_read_grid.get('grid')[0][1].get('value'), self.grid_obj_2.resource_hours)  # resource_hours for grid_obj_2 is 4.0
