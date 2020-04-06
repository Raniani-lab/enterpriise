# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from lxml import etree
from collections import defaultdict

from odoo import models, fields, api, _
from odoo.addons.web_grid.models.models import END_OF, STEP_BY, START_OF
from odoo.exceptions import UserError, AccessError
from odoo.osv import expression


class AnalyticLine(models.Model):
    _inherit = 'account.analytic.line'

    employee_id = fields.Many2one(group_expand="_group_expand_employee_ids")

    # reset amount on copy
    amount = fields.Monetary(copy=False)
    validated = fields.Boolean("Validated line", group_operator="bool_and", store=True, copy=False)
    is_timesheet = fields.Boolean(
        string="Timesheet Line", compute_sudo=True,
        compute='_compute_is_timesheet', search='_search_is_timesheet',
        help="Set if this analytic line represents a line of timesheet.")

    project_id = fields.Many2one(group_expand="_group_expand_project_ids")

    @api.model
    def read_grid(self, row_fields, col_field, cell_field, domain=None, range=None, readonly_field=None, orderby=None):
        """
            Override method to manage the group_expand in project_id and employee_id fields
        """
        result = super(AnalyticLine, self).read_grid(row_fields, col_field, cell_field, domain, range, readonly_field, orderby)

        if not self.env.context.get('group_expand', False):
            return result

        res_rows = [row['values'] for row in result['rows']]

        # For the group_expand, we need to have some information :
        #   1) search in domain one rule with one of next conditions :
        #       -   project_id = value
        #       -   user_id = value
        #       -   employee_id = value
        #   2) search in account.analytic.line if the user timesheeted
        #       in the past 30 days
        #   3) retrieve data and create correctly the grid and rows in result
        today = fields.Date.to_string(fields.Date.today())
        grid_anchor = self.env.context.get('grid_anchor', today)

        last_month = (fields.Datetime.from_string(grid_anchor) - timedelta(days=30)).date()
        domain_search = [
            ('project_id', '!=', False),
            ('date', '>=', last_month),
            ('date', '<=', grid_anchor)
        ]

        # check if project_id or employee_id is in domain
        # if not then group_expand return None
        field = None
        for rule in domain:
            # if in domain, we have project_id = value and user_id = value
            # then we are in 'My Timesheet' page.
            if len(rule) == 3:
                name, operator, value = rule
                if operator in ['=', '!=']:
                    if name in ['project_id', 'employee_id']:
                        field = name
                        domain_search.append((name, operator, value))
                    elif name == 'user_id':
                        domain_search.append((name, operator, value))
                elif operator == ['ilike', 'not ilike']:  # When the user want to filter the results
                    domain_search.append((name, operator, value))

        if not field:
            return result

        # step 2: search timesheets
        timesheets = self.search(domain_search)

        # step 3: retrieve data and create correctly the grid and rows in result
        seen = []  # use to not have duplicated rows
        rows = []
        def read_row_value(row_field, timesheet):
            field_name = row_field.split(':')[0]  # remove all groupby operator e.g. "date:quarter"
            return timesheets._fields[field_name].convert_to_read(timesheet[field_name], timesheet)
        for timesheet in timesheets:
            # check uniq project or task, or employee
            k = tuple(read_row_value(f, timesheet) for f in row_fields)
            if k not in seen:  # check if it's not a duplicated row
                record = {
                    row_field: read_row_value(row_field, timesheet)
                    for row_field in row_fields
                }
                seen.append(k)
                if not any(record == row for row in res_rows):
                    rows.append({'values': record, 'domain': [('id', '=', timesheet.id)]})

        # _grid_make_empty_cell return a dict, in this dictionary,
        # we need to check if the cell is in the current date,
        # then, we add a key 'is_current' into this dictionary
        # to get the result of this checking.
        grid = [
            [{**self._grid_make_empty_cell(r['domain'], c['domain'], domain), 'is_current': c.get('is_current', False)} for c in result['cols']]
            for r in rows]

        if len(rows) > 0:
            # update grid and rows in result
            if len(result['rows']) == 0 and len(result['grid']) == 0:
                result.update(rows=rows, grid=grid)
            else:
                result['rows'].extend(rows)
                result['grid'].extend(grid)

        return result

    @api.depends('project_id')
    def _compute_is_timesheet(self):
        for line in self:
            line.is_timesheet = bool(line.project_id)

    def _search_is_timesheet(self, operator, value):
        if (operator, value) in [('=', True), ('!=', False)]:
            return [('project_id', '!=', False)]
        return [('project_id', '=', False)]

    def action_validate_timesheet(self):
        """ Action validate timesheet

            When the user want to validate the list of timesheets that he see
            in grid view.
            First, we need to check if this user has the correct access to do
            this action.
            Then, we need to add timesheets to validate into
            timesheet.validation model for the wizard.

            Explanation for record in timesheet.validation model :

            For validation, we need to group by employee > project > task
            (if task exists).

            The first idea is created a dict contains records filtered
            with this groupby, for example, the dict looks like this:

            records = {
                employee_id: {
                    project_id: {
                        task_id: [timesheet_ids]
                    }
                }
            }

            Then we create a list named "valid_data" that contains the list of
            line for timesheet.validation.line model.
            For example, this list will look like this :

            valid_data = [{
                employee_id: employee_id.id,
                project_id: project_id.id,
                task_id: task_id.id,
                timesheet_ids: [list of timesheets]
            }]
        """
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_approver'):
            raise AccessError(_("Sorry, you don't have the access to validate the timesheets."))

        if not self:
            raise UserError(_("There aren't any timesheet to validate"))

        analytic_lines = self.filtered_domain(self._get_domain_for_validation_timesheets())
        if not analytic_lines:
            raise UserError(_('All selected timesheets for which you are indicated as responsible are already validated.'))

        # Prepare record for timesheet.validation model
        valid_data = []  # will contains the list of line for timesheet.validation.line
        # records will be the dict containing the timesheets filtered with the group by
        # employee > project > task.
        # First, group by employee
        for employee in analytic_lines.employee_id:
            timesheets = analytic_lines.filtered(lambda t: t.employee_id == employee)
            # group by (employee > project)
            for project in timesheets.project_id:
                record = defaultdict(lambda: [])  # structure -> {task_id.id: timesheets.ids}

                # group by (employee > project > task)
                for timesheet in timesheets.filtered(lambda t: t.project_id == project):
                    record[timesheet.task_id.id].append(timesheet.id)
                for (k, v) in record.items():
                    # create records for timesheet.validation.line
                    # each record contains a dict with
                    # employee_id, project_id, task_id, timesheet_ids keys
                    valid_data.append({
                        'employee_id': employee.id,
                        'project_id': project.id,
                        'task_id': k,
                        'timesheet_ids': v
                    })

        validation = self.env['timesheet.validation'].create({
            'validation_line_ids': [(0, 0, data) for data in valid_data]
        })

        return {
            'name': _('Validate the timesheets'),
            'type': 'ir.actions.act_window',
            'target': 'new',
            'res_model': 'timesheet.validation',
            'res_id': validation.id,
            'views': [(False, 'form')]
        }

    @api.model_create_multi
    def create(self, vals_list):
        analytic_lines = super(AnalyticLine, self).create(vals_list)

        # Check if the user has the correct access to create timesheets
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_approver') and any(line.is_timesheet and line.user_id.id != self.env.user.id for line in analytic_lines):
            raise AccessError(_("You cannot access timesheets that are not yours."))
        return analytic_lines

    def write(self, vals):
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_approver'):
            if 'validated' in vals:
                raise AccessError(_('Only a Timesheets Approver or Manager is allowed to validate a timesheet'))
            elif self.filtered(lambda r: r.is_timesheet and r.validated):
                raise AccessError(_('Only a Timesheets Approver or Manager is allowed to modify a validated entry.'))

        return super(AnalyticLine, self).write(vals)

    def unlink(self):
        if not self.user_has_groups('hr_timesheet.group_hr_timesheet_approver') and self.filtered(lambda r: r.is_timesheet and r.validated):
            raise AccessError(_('Only a Timesheets Approver or Manager is allowed to delete a validated entry.'))
        return super(AnalyticLine, self).unlink()

    @api.model
    def _fields_view_get(self, view_id=None, view_type='form', toolbar=False, submenu=False):
        """ Set the correct label for `unit_amount`, depending on company UoM """
        result = super(AnalyticLine, self)._fields_view_get(view_id=view_id, view_type=view_type, toolbar=toolbar, submenu=submenu)
        if view_type == 'grid':
            doc = etree.XML(result['arch'])
            encoding_uom = self.env.company.timesheet_encode_uom_id
            # Here, we override the string put on unit_amount field to display only the UoM name in
            # the total label on the grid view.
            # Here, we select only the unit_amount field having no string set to give priority to
            # custom inheretied view stored in database.
            for node in doc.xpath("//field[@name='unit_amount'][@widget='timesheet_uom'][not(@string)]"):
                node.set('string', encoding_uom.name)
            result['arch'] = etree.tostring(doc, encoding='unicode')
        return result

    def adjust_grid(self, row_domain, column_field, column_value, cell_field, change):
        if column_field != 'date' or cell_field != 'unit_amount':
            raise ValueError(
                "{} can only adjust unit_amount (got {}) by date (got {})".format(
                    self._name,
                    cell_field,
                    column_field,
                ))

        additionnal_domain = self._get_adjust_grid_domain(column_value)
        domain = expression.AND([row_domain, additionnal_domain])
        line = self.search(domain)

        day = column_value.split('/')[0]
        if len(line) > 1:  # copy the last line as adjustment
            line[0].copy({
                'name': _('Timesheet Adjustment'),
                column_field: day,
                cell_field: change
            })
        elif len(line) == 1:  # update existing line
            line.write({
                cell_field: line[cell_field] + change
            })
        else:  # create new one
            self.search(row_domain, limit=1).copy({
                'name': _('Timesheet Adjustment'),
                column_field: day,
                cell_field: change,
            })
        return False

    def _get_adjust_grid_domain(self, column_value):
        # span is always daily and value is an iso range
        day = column_value.split('/')[0]
        return [('date', '=', day)]

    def _group_expand_project_ids(self, projects, domain, order):
        """ Group expand by project_ids in grid view

            This group expand allow to add some record grouped by project,
            where the current user (= the current employee) has been
            timesheeted in the past 30 days.
        """
        today = fields.Date.to_string(fields.Date.today())
        grid_anchor = self.env.context.get('grid_anchor', today)

        last_month = (fields.Datetime.from_string(grid_anchor) - timedelta(days=30)).date()

        # We keep the rules other than date
        rules = [rule for rule in domain if len(rule) == 3 and rule[0] != 'date']

        domain_rule = expression.AND([[('date', '>=', last_month), ('date', '<=', grid_anchor)], rules])

        return self.search(domain_rule).project_id

    def _group_expand_employee_ids(self, employees, domain, order):
        """ Group expand by employee_ids in grid view

            This group expand allow to add some record by employee, where
            the employee has been timesheeted in a task of a project in the
            past 30 days.
        """
        today = fields.Date.to_string(fields.Date.today())
        grid_anchor = self.env.context.get('grid_anchor', today)

        last_month = (fields.Datetime.from_string(grid_anchor) - timedelta(days=30)).date()

        rules = [rule for rule in domain if len(rule) == 3 and rule[0] != 'date']

        domain_rule = expression.AND([[('project_id', '!=', False), ('date', '>=', last_month), ('date', '<=', grid_anchor)], rules])

        return self.search(domain_rule).employee_id

    # ----------------------------------------------------
    # Timer Methods
    # ----------------------------------------------------
    
    def action_timer_start(self):
        """ Action start the timer of current timesheet

            * Override method of hr_timesheet module.
        """
        if self.validated:
            raise UserError(_('Sorry, you cannot use a timer for a validated timesheet'))
        super(AnalyticLine, self).action_timer_start()

    def action_timer_stop(self):
        """ Action stop the timer of the current timesheet

            * Override method of hr_timesheet module.
        """
        if self.validated:
            raise UserError(_('Sorry, you cannot use a timer for a validated timesheet'))
        super(AnalyticLine, self).action_timer_stop()

    @api.model
    def create_timesheet_with_timer(self, vals):
        """ Create timesheet when user launch timer in grid view.
            :param vals: dictionary contains task_id or project_id for the timesheet
            Return:
                a dictionary contains the information required
                about the timesheet created for grid view.
        """
        record = {'name': _('Timesheet Adjustment')}
        if 'task_id' in vals:
            task = self.env['project.task'].browse(vals.get('task_id'))
            record.update(task_id=task.id, project_id=task.project_id.id)
        elif 'project_id' in vals:
            record.update(project_id=vals.get('project_id'))
        else:
            return

        line = self.create(record)
        # Start the timer
        line.action_timer_start()
        return {
            'id': line.id,
            'task_id': line.task_id.id,
            'project_id': line.project_id.id,
            'unit_amount': line.unit_amount
        }

    def _action_open_to_validate_timesheet_view(self, type_view='week'):
        """ search the oldest non-validated timesheet to display in grid view

            When the user want to validate the timesheet, we want to be sure
            that before the range date of grid view, all timesheets have
            already been validated.
            Thus, we display to the user, the grid view contains the oldest
            timesheet that isn't validated yet.
        """
        oldest_timesheet = self.search(self._get_domain_for_validation_timesheets(), order="date asc", limit=1)
        name = ''
        context = {
            'search_default_nonvalidated': True,
            'search_default_my_team_timesheet': True,
            'group_expand': True,
        }

        if oldest_timesheet:  # check if exists a timesheet to validate
            context.update(grid_anchor=oldest_timesheet.date)

        if (type_view == 'week'):
            name = 'Timesheets from Last Week to Validate'
        elif type_view == 'month':
            name = 'Timesheets from Last Month to Validate'
            context['grid_range'] = 'month'

        action = self.env.ref('hr_timesheet.act_hr_timesheet_report').read()[0]
        action.update({
            "name": name,
            "display_name": name,
            "views": [
                [self.env.ref('timesheet_grid.timesheet_view_grid_by_employee_validation').id, 'grid'],
                [self.env.ref('hr_timesheet.timesheet_view_tree_user').id, 'tree'],
                [self.env.ref('timesheet_grid.timesheet_view_form').id, 'form']
            ],
            "view_mode": 'grid,tree',
            "domain": [('is_timesheet', '=', True)],
            "search_view_id": [self.env.ref('timesheet_grid.timesheet_view_search').id, 'search'],
            "context": context,

        })
        return action

    def _get_domain_for_validation_timesheets(self):
        """ Get the domain to check if the user can validate which timesheets

            2 access rights give access to validate timesheets:

            1. See all timesheets: in this access right, the user can't validate all timesheets,
            he can validate the timesheets where he is the manager or timesheet responsible of the
            employee who is assigned to this timesheets or the user is the owner of the project.
            Furthermore, the user can validate his own timesheets.

            2. Manager (Administrator): with this access right, the user can validate all timesheets.
        """
        domain = [('validated', '=', False)]

        if not self.user_has_groups('hr_timesheet.group_timesheet_manager'):
            return expression.AND([domain, ['|', ('employee_id.timesheet_manager_id', '=', self.env.user.id),
                      '|', ('employee_id.parent_id.user_id', '=', self.env.user.id),
                      '|', ('project_id.user_id', '=', self.env.user.id), ('user_id', '=', self.env.user.id)]])
        return domain
