# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models


class MailActivity(models.Model):
    _inherit = 'mail.activity'

    phone = fields.Char('Phone', compute='_compute_phone_numbers', readonly=False, store=True)
    mobile = fields.Char('Mobile', compute='_compute_phone_numbers', readonly=False, store=True)
    voip_phonecall_id = fields.Many2one('voip.phonecall', 'Linked Voip Phonecall')

    @api.depends('res_model', 'res_id', 'activity_type_id')
    def _compute_phone_numbers(self):
        phonecall_activities = self.filtered(
            lambda act: act.id and act.res_model and act.res_id and act.activity_category == 'phonecall'
        )
        (self - phonecall_activities).phone = False
        (self - phonecall_activities).mobile = False

        if phonecall_activities:
            voip_info = phonecall_activities._get_customer_phone_info()
            for activity in phonecall_activities:
                activity.mobile = voip_info[activity.id]['mobile']
                activity.phone = voip_info[activity.id]['phone']

    @api.model_create_multi
    def create(self, values_list):
        activities = super(MailActivity, self).create(values_list)

        phonecall_activities = activities.filtered(
            lambda act: (act.phone or act.mobile) and act.activity_category == 'phonecall'
        )
        for activity in phonecall_activities:
            phonecall = self.env['voip.phonecall'].create_from_activity(activity)
            activity.voip_phonecall_id = phonecall.id

        users_to_notify = phonecall_activities.user_id
        if users_to_notify:
            self.env['bus.bus']._sendmany([
                [user.partner_id, 'refresh_voip', {}]
                for user in users_to_notify
            ])
        return activities

    def write(self, values):
        if 'date_deadline' in values:
            self.mapped('voip_phonecall_id').write({'date_deadline': values['date_deadline']})
            for user in self.mapped('user_id'):
                self.env['bus.bus']._sendone(user.partner_id, 'refresh_voip', {})
        return super(MailActivity, self).write(values)

    def _get_customer_phone_info(self):
        """ Batch compute customer as well as mobile / phone information used
        to fill activities fields. This is used notably by voip to create
        phonecalls.

        :return dict: for each activity ID, get an information dict containing
          * partner: a res.partner record (maybe void) that is the customer
            related to the activity record;
          * mobile: mobile number (coming from activity record or partner);
          * phone: phone numbe (coming from activity record or partner);
        """
        activity_voip_info = {}
        data_by_model = self._classify_by_model()

        for model, data in data_by_model.items():
            records = self.env[model].browse(data['record_ids'])
            for record, activity in zip(records, data['activities']):
                customer = self.env['res.partner']
                mobile = record.mobile if 'mobile' in record else False
                phone = record.phone if 'phone' in record else False
                if not phone and not mobile:
                    # take only the first found partner if multiple customers are
                    # related to the record; anyway we will create only one phonecall
                    if hasattr(record, '_mail_get_partner_fields'):
                        customer = next(
                            (partner
                             for partner in record._mail_get_partners()[record.id]
                             if partner and (partner.phone or partner.mobile)),
                            self.env['res.partner']
                        )
                    else:
                        # find relational fields linking to partners if model does not
                        # inherit from mail.thread, just to have a fallback
                        partner_fnames = [
                            fname for fname, fvalue in records._fields.items()
                            if fvalue.type == 'many2one' and fvalue.comodel_name == 'res.partner'
                        ]
                        customer = next(
                            (record[fname] for fname in partner_fnames
                             if record[fname] and (record[fname].phone or record[fname].mobile)),
                            self.env['res.partner']
                        )
                    phone = customer.phone
                    mobile = customer.mobile
                activity_voip_info[activity.id] = {
                    'mobile': mobile,
                    'partner': customer,
                    'phone': phone,
                }
        return activity_voip_info

    def _action_done(self, feedback=False, attachment_ids=None):
        # extract potential required data to update phonecalls
        phonecall_values_to_keep = {}  # mapping index of self and acitivty value to keep {index: {key1: value1, key2: value2}}
        for index, activity in enumerate(self):
            if activity.voip_phonecall_id:
                phonecall_values_to_keep[index] = {
                    'note': activity.note,
                    'voip_phonecall_id': activity.voip_phonecall_id,
                    'call_date': activity.voip_phonecall_id.call_date,
                    'partner_id': activity.user_id.partner_id.id
                }

        # call super, and unlink `self`
        messages, activities = super(MailActivity, self)._action_done(feedback=feedback, attachment_ids=attachment_ids)

        # update phonecalls and broadcast refresh notifications on bus
        if phonecall_values_to_keep:
            bus_notifications = []
            for index, message in enumerate(messages):
                if index in phonecall_values_to_keep:
                    values_to_keep = phonecall_values_to_keep[index]
                    phonecall = values_to_keep['voip_phonecall_id']
                    values_to_write = {
                        'state': 'done',
                        'mail_message_id': message.id,
                        'note': feedback if feedback else values_to_keep['note'],
                    }
                    if not values_to_keep['call_date']:
                        values_to_write['call_date'] = fields.Datetime.now()
                    phonecall.write(values_to_write)

                    partner = self.env['res.partner'].browse(values_to_keep['partner_id'])
                    bus_notifications.append([partner, 'refresh_voip', {}])

            self.env['bus.bus']._sendmany(bus_notifications)

        return messages, activities
