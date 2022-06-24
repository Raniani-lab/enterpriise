odoo.define('website_appointment.editor', function (require) {
'use strict';

const core = require('web.core');
const Dialog = require('web.Dialog');
const WebsiteNewMenu = require('website.newMenu');

var _t = core._t;

const NewAppointmentDialog = Dialog.extend({
    template: 'website_appointment.new_appointment_type_dialog',
    xmlDependencies: (Dialog.prototype.xmlDependencies || [])
        .concat(['/website_appointment/static/src/xml/website_appointment_templates.xml']),

    /**
     * @override
     */
    init: function (parent, options) {
        options = _.defaults(options || {}, {
            title: _t("New Appointment Type"),
            size: 'medium',
            buttons: [{
                text: _t("Create"),
                classes: 'btn-primary',
                click: this._onCreateClick.bind(this),
            }, {
                text: _t("Cancel"),
                close: true
            }]
        });
        this._super(...arguments);
    },

    /**
     * @override
     */
    willStart: function () {
        return this._super(...arguments).then(async () => {
            this.currentUser = await this._rpc({
                model: 'res.users',
                method: 'search_read',
                fields: ['name'],
                domain: [['id', '=', this.getSession().user_id]],
            });
        });
    },

    /**
     * @override
     */
    start: function () {
        const self = this;
        return this._super(...arguments).then(() => {
            const $input = self.$('#user_ids');
            $input.select2({
                width: '100%',
                multiple: true,
                selection_data: false,
                fill_data: function (query, data) {
                    const that = this;
                    const users = {results: []};
                    _.each(data, (user) => {
                        if (that.matcher(query.term, user.name)) {
                            users.results.push({
                                id: user.id,
                                text: user.name,
                            });
                        }
                    });
                    query.callback(users);
                },
                query: function (query) {
                    const that = this;
                    self._rpc({
                        model: 'res.users',
                        method: 'search_read',
                        fields: ['name'],
                        domain: [['share', '=', false], ['name', 'ilike', query.term]],
                        limit: 8,
                    }).then((data) => {
                        that.fill_data(query, data);
                        that.selection_data = data;
                    });
                }
            });
            $input.select2('data', {
                id: self.currentUser[0].id,
                text: self.currentUser[0].name,
            }, true);
        });
    },

    _onCreateClick: function () {
        const name = $('#appointment_name').val();
        if (!name) {
            $('#appointment_name').addClass('border-danger');
            $('#name-required').removeClass('d-none');
            return;
        }
        const staff_user_ids = $('#user_ids').select2('data').map(user => user.id);
        return this._rpc({
            model: 'appointment.type',
            method: 'create_and_get_website_url',
            args: [[]],
            kwargs: {
                name: name,
                staff_user_ids: staff_user_ids,
                is_published: true,
            },
        }).then(url => {
            window.location.href = url;
        });
    },
});

WebsiteNewMenu.include({
    actions: _.extend({}, WebsiteNewMenu.prototype.actions || {}, {
        new_appointment: '_createNewAppointment',
    }),

    //--------------------------------------------------------------------------
    // Actions
    //--------------------------------------------------------------------------

    /**
     * Asks the user information about a new appointment type to create,
     * then creates it and redirects the user to this new appointment type.
     *
     * @private
     * @returns {Promise} Unresolved if there is a redirection
     */
    _createNewAppointment: function () {
        const self = this;
        return new Promise(function (resolve) {
            const dialog = new NewAppointmentDialog(self, {});
            dialog.open();
            dialog.on('closed', self, resolve);
        });
    },
});

});
