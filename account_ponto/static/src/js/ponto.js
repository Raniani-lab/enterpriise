odoo.define('account_ponto.acc_config_widget', function(require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var _t = core._t;
var AbstractAction = require('web.AbstractAction');
var OnlineSyncAccountInstitutionSelector = require('account_online_sync.acc_config_widget').OnlineSyncAccountInstitutionSelector

var QWeb = core.qweb;

var OnlineSyncAccountInstitutionSelector = OnlineSyncAccountInstitutionSelector.include({
    renderButtons: function($node) {
        var self = this;
        this._super($node);
        if (self.country !== 'BE') {
            this.$buttons.find('.link_ponto_account').addClass('d-none');
        }
        this.$buttons.find('.link_ponto_account').click(function(e) {
            e.preventDefault();
            self.do_action({
                'type': 'ir.actions.client',
                'tag': 'ponto_online_sync_widget',
                'name': _t('Link your Ponto account'),
                'target': 'new',
                'context': self.context,
            });
        });
    },

});

var PontoAccountConfigurationWidget = AbstractAction.extend({
    template: 'PontoTemplate',

    init: function(parent, context) {
        this._super(parent, context);
        this.create = context.context.method === 'add';
        this.context = context.context;
    },

    renderButtons: function($node) {
        var self = this;
        this.$buttons = $(QWeb.render("PontoTemplateFooter", {'widget': this}));
        this.$buttons.find('.js_ponto_continue').click(function (e) {
            var token = $('.ponto_token').val()
            if (token) {
                self._rpc({
                    model: 'account.online.provider',
                    method: 'success_callback',
                    args: [[], token],
                    context: self.context,
                }).then(function (result) {
                    self.do_action(result);
                });
            }
        });
        this.$buttons.find('.js_cancel').click(function(e) {
            self.do_action({type: 'ir.actions.act_window_close'});
        });
        this.$buttons.appendTo($node);
    },

});

core.action_registry.add('ponto_online_sync_widget', PontoAccountConfigurationWidget);

});
