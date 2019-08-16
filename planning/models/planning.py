# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from ast import literal_eval
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import json
import logging
import pytz
import uuid

from odoo import api, fields, models, _
from odoo.exceptions import UserError, AccessError
from odoo.osv import expression
from odoo.tools.safe_eval import safe_eval
from odoo.tools import format_time

_logger = logging.getLogger(__name__)


class Planning(models.Model):
    _name = 'planning.slot'
    _description = 'Planning Shift'
    _order = 'start_datetime,id desc'
    _rec_name = 'name'

    def _default_employee_id(self):
        return self.env.user.employee_id

    def _default_start_datetime(self):
        return fields.Datetime.to_string(datetime.combine(fields.Datetime.now(), datetime.min.time()))

    def _default_end_datetime(self):
        return fields.Datetime.to_string(datetime.combine(fields.Datetime.now(), datetime.max.time()))

    name = fields.Text('Note')
    employee_id = fields.Many2one('hr.employee', "Employee", default=_default_employee_id)
    user_id = fields.Many2one('res.users', string="User", related='employee_id.user_id', store=True, readonly=True)
    company_id = fields.Many2one('res.company', string="Company", required=True, default=lambda self: self.env.company)
    role_id = fields.Many2one('planning.role', string="Role")
    color = fields.Integer("Color", related='role_id.color')
    was_copied = fields.Boolean("This shift was copied from previous week", default=False, readonly=True)

    recurrency_id = fields.Many2one('planning.recurrency', readonly=True, index=True, copy=False)

    start_datetime = fields.Datetime("Start Date", required=True, default=_default_start_datetime)
    end_datetime = fields.Datetime("End Date", required=True, default=_default_end_datetime)

    # UI fields and warnings
    allow_self_unassign = fields.Boolean('Let employee unassign themselves', related='company_id.planning_allow_self_unassign')
    is_assigned_to_me = fields.Boolean('Is this shift assigned to the current user', compute='_compute_is_assigned_to_me')
    overlap_slot_count = fields.Integer('Overlapping slots', compute='_compute_overlap_slot_count')

    # forecast allocation
    allocated_hours = fields.Float("Allocated hours", default=0)
    allocated_percentage = fields.Float("Allocated Time (%)", compute='_compute_allocated_percentage', compute_sudo=True, store=True, help="Expressed in the Unit of Measure of the project company")

    # publication and sending
    is_published = fields.Boolean("Is the shift sent", default=False, readonly=True, help="If checked, this means the planning entry has been sent to the employee. Modifying the planning entry will mark it as not sent.")
    publication_warning = fields.Boolean("Modified since last publication", default=False, readonly=True, help="If checked, it means that the shift contains has changed since its last publish.", copy=False)

    _sql_constraints = [
        ('check_start_date_lower_end_date', 'CHECK(end_datetime > start_datetime)', 'Shift end date should be greater than its start date'),
        ('check_allocated_hours_positive', 'CHECK(allocated_hours >= 0)', 'You cannot have negative shift'),
    ]

    @api.depends('user_id')
    def _compute_is_assigned_to_me(self):
        for slot in self:
            slot.is_assigned_to_me = slot.user_id == self.env.user

    @api.depends('allocated_hours', 'start_datetime', 'end_datetime', 'employee_id.resource_calendar_id')
    def _compute_allocated_percentage(self):
        for planning in self:
            if planning.employee_id:
                hours = planning.employee_id._get_work_days_data(planning.start_datetime, planning.end_datetime, compute_leaves=True)['hours']
                if hours > 0:
                    planning.allocated_percentage = planning.allocated_hours * 100.0 / hours
                else:
                    planning.allocated_percentage = 0  # allow to create a forecast for a day you are not supposed to work
            else:
                planning.allocated_percentage = 0

    @api.depends('start_datetime', 'end_datetime', 'employee_id')
    def _compute_overlap_slot_count(self):
        if self.ids:
            query = """
                SELECT
                    S1.id, COUNT(S2.id)
                FROM
                    (
                        SELECT
                            S.id as id,
                            S.employee_id as employee_id,
                            S.start_datetime as start_datetime,
                            S.end_datetime as end_datetime
                        FROM planning_slot S
                        WHERE employee_id IS NOT NULL
                    ) S1
                INNER JOIN planning_slot S2
                    ON S1.id != S2.id
                        AND S1.employee_id = S2.employee_id
                        AND (S1.start_datetime::TIMESTAMP, S1.end_datetime::TIMESTAMP)
                            OVERLAPS (S2.start_datetime::TIMESTAMP, S2.end_datetime::TIMESTAMP)
                GROUP BY S1.id
            """
            self.env.cr.execute(query, (tuple(self.ids),))
            raw_data = self.env.cr.dictfetchall()
            overlap_mapping = dict(map(lambda d: d.values(), raw_data))
            for slot in self:
                slot.overlap_slot_count = overlap_mapping.get(slot.id, 0)
        else:
            self.overlap_slot_count = 0

    @api.onchange('employee_id')
    def _onchange_employee_id(self):
        if self.employee_id:
            start = self.start_datetime or datetime.combine(fields.Datetime.now(), datetime.min.time())
            end = self.end_datetime or datetime.combine(fields.Datetime.now(), datetime.max.time())
            work_interval = self.employee_id._get_work_interval(start, end)
            start_datetime, end_datetime = work_interval[self.employee_id.id]
            if start_datetime:
                self.start_datetime = start_datetime.astimezone(pytz.utc).replace(tzinfo=None)
            if end_datetime:
                self.end_datetime = end_datetime.astimezone(pytz.utc).replace(tzinfo=None)
        if self.recurrency_id:
            return {
                'warning': {
                    'title': _("Warning"),
                    'message': _("This action will remove the current shift from the recurrency. Are you sure you want to continue?"),
                }
            }

    @api.onchange('employee_id', 'start_datetime', 'end_datetime')
    def _onchange_employee_and_dates(self):
        if self.employee_id and self.start_datetime and self.end_datetime:
            self.allocated_hours = self.employee_id._get_work_days_data(self.start_datetime, self.end_datetime, compute_leaves=True)['hours']

    @api.onchange('start_datetime', 'end_datetime', 'employee_id')
    def _onchange_dates(self):
        if self.employee_id:
            self.publication_warning = True

    # ----------------------------------------------------
    # ORM overrides
    # ----------------------------------------------------

    def name_get(self):
        group_by = self.env.context.get('group_by', [])
        field_list = [fname for fname in self._name_get_fields() if fname not in group_by][:2]  # limit to 2 labels

        result = []
        for slot in self:
            # label part, depending on context `groupby`
            name = ' - '.join([self._fields[fname].convert_to_display_name(slot[fname], slot) for fname in field_list if slot[fname]])

            # date / time part
            destination_tz = pytz.timezone(self.env.user.tz or 'UTC')
            start_datetime = pytz.utc.localize(slot.start_datetime).astimezone(destination_tz).replace(tzinfo=None)
            end_datetime = pytz.utc.localize(slot.end_datetime).astimezone(destination_tz).replace(tzinfo=None)
            if slot.end_datetime - slot.start_datetime <= timedelta(hours=24):  # shift on a single day
                name = '%s - %s %s' % (
                    format_time(self.env, start_datetime.time(), time_format='short'),
                    format_time(self.env, end_datetime.time(), time_format='short'),
                    name
                )
            else:
                name = '%s - %s %s' % (
                    start_datetime.date(),
                    end_datetime.date(),
                    name
                )

            # add unicode bubble to tell there is a note
            if slot.name:
                name = u'%s \U0001F4AC' % name

            result.append([slot.id, name])
        return result

    def write(self, values):
        # detach planning entry from recurrency
        breaking_fields = self._get_fields_breaking_recurrency()
        for fieldname in breaking_fields:
            if fieldname in values and not values.get('recurrency_id'):
                values.update({'recurrency_id': False})
        # warning on published shifts
        if 'publication_warning' not in values and (set(values.keys()) & set(self._get_fields_breaking_publication())):
            values['publication_warning'] = True
        return super(Planning, self).write(values)

    # ----------------------------------------------------
    # Actions
    # ----------------------------------------------------

    def action_see_overlaping_slots(self):
        domain_map = self._get_overlap_domain()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'planning.slot',
            'name': _('Shifts in conflict'),
            'view_mode': 'gantt,list,form',
            'domain': domain_map[self.id],
        }

    def action_self_assign(self):
        """ Allow planning user to self assign open shift. """
        self.ensure_one()
        # user must at least 'read' the shift to self assign (Prevent any user in the system (portal, ...) to assign themselves)
        if not self.check_access_rights('read', raise_exception=False):
            raise AccessError(_("You don't the right to self assign."))
        if self.employee_id:
            raise UserError(_("You can not assign yourself to an already assigned shift."))
        return self.sudo().write({'employee_id': self.env.user.employee_id.id if self.env.user.employee_id else False})

    def action_self_unassign(self):
        """ Allow planning user to self unassign from a shift, if the feature is activated """
        self.ensure_one()
        # user must at least 'read' the shift to self unassign. (Prevent any user in the system (portal, ...) to unassign any shift)
        if not self.check_access_rights('read', raise_exception=False):
            raise AccessError(_("You don't the right to self unassign."))
        if not self.allow_self_unassign:
            raise UserError(_("The company does not allow you to self unassign."))
        if self.employee_id != self.env.user.employee_id:
            raise UserError(_("You can not unassign another employee than yourself."))
        return self.sudo().write({'employee_id': False})

    # ----------------------------------------------------
    # Gantt view
    # ----------------------------------------------------

    @api.model
    def gantt_unavailability(self, start_date, end_date, scale, group_bys=None, rows=None):
        start_datetime = fields.Datetime.from_string(start_date.replace('T', ' '))
        end_datetime = fields.Datetime.from_string(end_date.replace('T', ' '))
        employee_ids = set()
        for toplevel_row in rows:
            if toplevel_row.get('records') and 'employee_id' in toplevel_row.get('groupedBy', []):
                for slot in toplevel_row.get('records'):
                    if slot.get('employee_id'):
                        employee_ids.add(slot.get('employee_id')[0])
                        toplevel_row['employee_id'] = slot.get('employee_id')[0]
            elif toplevel_row.get('groupedBy', []) == ['employee_id'] and toplevel_row.get('resId'):
                employee_ids.add(toplevel_row.get('resId'))
                toplevel_row['employee_id'] = toplevel_row.get('resId')

        employees = self.env['hr.employee'].browse(employee_ids)
        leaves_mapping = employees._get_unavailable_intervals(start_datetime, end_datetime)

        # function to recursively replace subrows with the ones returned by func
        def traverse(func, row):
            new_row = dict(row)
            if new_row.get('employee_id'):
                for sub_row in new_row.get('rows'):
                    sub_row['employee_id'] = new_row['employee_id']
            new_row['rows'] = [traverse(func, row) for row in new_row.get('rows')]
            return func(new_row)

        cell_dt = timedelta(hours=1) if scale == 'day' else timedelta(days=1)

        # for a single row, inject unavailability data
        def inject_unavailability(row):
            new_row = dict(row)

            if (not row.get('groupedBy') or row.get('groupedBy')[0] == 'employee_id'):
                employee_id = row.get('employee_id')
                if employee_id:
                    # remove intervals smaller than a cell, as they will cause half a cell to turn grey
                    # ie: when looking at a week, a employee start everyday at 8, so there is a unavailability
                    # like: 2019-05-22 20:00 -> 2019-05-23 08:00 which will make the first half of the 23's cell grey
                    notable_intervals = filter(lambda interval: interval[1] - interval[0] >= cell_dt, leaves_mapping[employee_id])
                    new_row['unavailabilities'] = [{'start': interval[0], 'stop': interval[1]} for interval in notable_intervals]
            return new_row

        return [traverse(inject_unavailability, row) for row in rows]

    # ----------------------------------------------------
    # Period Duplication
    # ----------------------------------------------------

    @api.model
    def action_copy_previous_week(self, date_start_week):
        date_end_copy = datetime.combine(fields.Date.from_string(date_start_week), datetime.max.time())
        date_start_copy = datetime.combine(date_end_copy.date(), datetime.min.time()) - relativedelta(days=7)
        domain = [
            ('start_datetime', '>=', date_start_copy),
            ('end_datetime', '<=', date_end_copy),
            ('recurrency_id', '=', False),
            ('was_copied', '=', False)
        ]
        slots_to_copy = self.search(domain)

        new_slot_values = []
        for slot in slots_to_copy:
            if not slot.was_copied:
                values = slot.copy_data()[0]
                if values.get('start_datetime'):
                    values['start_datetime'] += relativedelta(days=7)
                if values.get('end_datetime'):
                    values['end_datetime'] += relativedelta(days=7)
                new_slot_values.append(values)
        slots_to_copy.write({'was_copied': True})
        return self.create(new_slot_values)

    # ----------------------------------------------------
    # Sending Shifts
    # ----------------------------------------------------

    def action_send(self):
        group_planning_user = self.env.ref('planning.group_planning_user')
        template = self.env.ref('planning.email_template_slot_single')
        # update context to build a link for view in the slot
        view_context = dict(self._context)
        view_context.update({
            'menu_id': str(self.env.ref('planning.planning_menu_root').id),
            'action_id': str(self.env.ref('planning.planning_action_my').id),
            'dbname': self.env.cr.dbname,
            'render_link': self.employee_id.user_id and self.employee_id.user_id in group_planning_user.users,
            'unavailable_path': '/planning/myshifts/',
        })
        slot_template = template.with_context(view_context)

        mails_to_send = self.env['mail.mail']
        for slot in self:
            if slot.employee_id and slot.employee_id.work_email:
                mail_id = slot_template.with_context(view_context).send_mail(slot.id, notif_layout='mail.mail_notification_light')
                current_mail = self.env['mail.mail'].browse(mail_id)
                mails_to_send |= current_mail

        if mails_to_send:
            mails_to_send.send()

        self.write({
            'is_published': True,
            'publication_warning': False,
        })
        return mails_to_send

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------
    @api.model
    def _name_get_fields(self):
        """ List of fields that can be displayed in the name_get """
        return ['employee_id', 'role_id']

    @api.model
    def _get_fields_breaking_publication(self):
        """ Fields list triggering the `publication_warning` to True when updating shifts """
        return [
            'employee_id',
            'start_datetime',
            'end_datetime'
        ]

    @api.model
    def _get_fields_breaking_recurrency(self):
        """Returns the list of field which when changed should break the relation of the forecast
            with it's recurrency
        """
        return [
            'employee_id',
            'role_id',
        ]

    def _get_overlap_domain(self):
        """ get overlapping domain for current shifts
            :returns dict : map with slot id as key and domain as value
        """
        domain_mapping = {}
        for slot in self:
            domain_mapping[slot.id] = [
                '&',
                    '&',
                        ('employee_id', '!=', False),
                        ('employee_id', '=', slot.employee_id.id),
                    '&',
                        ('start_datetime', '<', slot.end_datetime),
                        ('end_datetime', '>', slot.start_datetime)
            ]
            current_id = slot.id
            if current_id:
                domain_mapping[slot.id] = expression.AND([domain_mapping[slot.id], [('id', '!=', current_id)]])
        return domain_mapping

class PlanningRole(models.Model):
    _name = 'planning.role'
    _description = "Planning Role"
    _order = 'name,id desc'
    _rec_name = 'name'

    name = fields.Char('Name', required=True)
    color = fields.Integer("Color", default=0)


class PlanningPlanning(models.Model):
    _name = 'planning.planning'
    _description = 'Planning sent by email'

    @api.model
    def _default_access_token(self):
        return str(uuid.uuid4())

    name = fields.Char("Name")
    start_datetime = fields.Datetime("Start Date", required=True)
    end_datetime = fields.Datetime("Stop Date", required=True)
    include_unassigned = fields.Boolean("Includes Open shifts", default=True)
    access_token = fields.Char("Security Token", default=_default_access_token, required=True, copy=False, readonly=True)
    last_sent_date = fields.Datetime("Last sent date")
    slot_ids = fields.Many2many('planning.slot', "Shifts", compute='_compute_slot_ids')
    company_id = fields.Many2one('res.company', "Company", required=True, default=lambda self: self.env.user.company_id)

    _sql_constraints = [
        ('check_start_date_lower_stop_date', 'CHECK(end_datetime > start_datetime)', 'Planning end date should be greater than its start date'),
    ]

    @api.depends('start_datetime', 'end_datetime', 'include_unassigned')
    def _compute_slot_ids(self):
        domain_map = self._get_domain_slots()
        for planning in self:
            domain = domain_map[planning.id]
            if not planning.include_unassigned:
                domain = expression.AND([domain, [('employee_id', '!=', False)]])
            planning.slot_ids = self.env['planning.slot'].search(domain)

    # ----------------------------------------------------
    # Business Methods
    # ----------------------------------------------------

    def _get_domain_slots(self):
        result = {}
        for planning in self:
            domain = ['&', '&', ('start_datetime', '<=', planning.end_datetime), ('end_datetime', '>', planning.start_datetime), ('company_id', '=', planning.company_id.id)]
            result[planning.id] = domain
        return result

    def send_planning(self, message=None):
        email_from = self.env.user.email or self.env.user.company_id.email or ''
        sent_slots = self.env['planning.slot']
        for planning in self:
            # prepare planning urls, recipient employees, ...
            slots = planning.slot_ids
            slots_open = slots.filtered(lambda slot: not slot.employee_id)

            # extract planning URLs
            employees = slots.mapped('employee_id')
            employee_url_map = employees._planning_get_url(planning)

            # send planning email template with custom domain per employee
            template = self.env.ref('planning.email_template_planning_planning', raise_if_not_found=False)
            template_context = {
                'slot_unassigned_count': len(slots_open),
                'slot_total_count': len(slots),
                'message': message,
            }
            if template:
                # /!\ For security reason, we only given the public employee to render mail template
                for employee in self.env['hr.employee.public'].browse(employees.ids):
                    if employee.work_email:
                        template_context['employee'] = employee
                        template_context['planning_url'] = employee_url_map[employee.id]
                        template.with_context(**template_context).send_mail(planning.id, email_values={'email_to': employee.work_email, 'email_from': email_from}, notif_layout='mail.mail_notification_light')
            sent_slots |= slots
        # mark as sent
        self.write({'last_sent_date': fields.Datetime.now()})
        sent_slots.write({
            'is_published': True,
            'publication_warning': False
        })
        return True
