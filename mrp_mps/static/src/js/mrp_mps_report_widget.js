odoo.define('mrp_mps.mrp_mps_report', function (require) {
'use strict';

var AbstractAction = require('web.AbstractAction');
var core = require('web.core');
var field_utils = require('web.field_utils');
var session = require('web.session');

var QWeb = core.qweb;
var _t = core._t;

var mrp_mps_report = AbstractAction.extend({
    hasControlPanel: true,
    loadControlPanel: true,
    withSearchBar: true,
    custom_events: {
        search: '_onSearch',
    },
    events:{
        'change .o_mps_save_input_text': 'mps_forecast_save',
        'change .o_mps_save_input_supply': 'on_change_quantity',
        'click .open_forecast_wizard': 'mps_open_forecast_wizard',
        'click .o_mps_apply': 'mps_apply',
        'click .o_mps_add_product': 'add_product_wizard',
        'click .o_mps_auto_mode': 'mps_change_auto_mode',
        'click .o_mps_generate_procurement': 'mps_generate_procurement',
        'mouseover .o_mps_visible_procurement': 'visible_procurement_button',
        'mouseout .o_mps_visible_procurement': 'invisible_procurement_button',
        'click .o_mps_product_name': 'open_mps_product',
    },
    init: function(parent, action) {
        this._super.apply(this, arguments);

        this.actionManager = parent;
        this.action = action;
        this.context = action.context;
        this.domain = [];

        this.controlPanelParams.modelName = 'product.product';
        // TODO: disable_groupby: true,
    },
    willStart: function () {
        var self = this;
        var _super = this._super.bind(this);
        var args = arguments;
        var def1 = this._rpc({
            model: 'ir.model.data',
            method: 'get_object_reference',
            args: ['product', 'product_template_search_view'],
            kwargs: {context: session.user_context},
        })
        .then(function (viewId) {
            self.controlPanelParams.viewId = viewId[1];
        });
        var def2 = this.get_html();
        return $.when(def1, def2).then(function () {
            return _super.apply(self, args);
        });
    },
    start: function() {
        var self = this;
        return this._super.apply(this, arguments).then(function () {
            self.update_cp();
            self.re_renderElement();
        });
    },
    on_change_quantity: function(e) {
        var self = this;
        var $input = $(e.target);
        var target_value;
        try {
            target_value = field_utils.parse.integer($input.val().replace(String.fromCharCode(8209), '-'));
        } catch(err) {
            return this.do_warn(_t("Wrong value entered!"), err);
        }
        return this._rpc({
            model: 'sale.forecast',
            method: 'save_forecast_data',
            args: [parseInt($input.data('product')), target_value, $input.data('date'), $input.data('date_to'), $input.data('name')],
            kwargs: {context: session.user_context},
        })
        .then(function() {
            self.get_html().then(function() {
                self.re_renderElement();
            });
        });
    },
    visible_procurement_button: function(e){
        clearTimeout(this.hover_element);
        $(e.target).find('.o_mps_generate_procurement').removeClass('o_invisible_modifier');
    },
    invisible_procurement_button: function(e){
        clearTimeout(this.hover_element);
        this.hover_element = setTimeout(function() {
            $(e.target).find('.o_mps_generate_procurement').addClass('o_invisible_modifier');
        }, 100);
    },
    mps_generate_procurement: function(e){
        var self = this;
        var target = $(e.target);
        return this._rpc({
                model: 'sale.forecast',
                method: 'generate_procurement',
                args: [parseInt(target.data('product')), 1],
                kwargs: {context: session.user_context},
            })
            .then(function(result){
                if (result){
                    self.get_html().then(function() {
                        self.re_renderElement();
                    });
                }
            });
    },
    mps_change_auto_mode: function(e){
        var self = this;
        var target = $(e.target);
        return this._rpc({
                model: 'sale.forecast',
                method: 'change_forecast_mode',
                args: [parseInt(target.data('product')), target.data('date'), target.data('date_to'), parseInt(target.data('value'))],
                kwargs: {context: session.user_context},
            })
            .then(function () {
                self.get_html().then(function() {
                    self.re_renderElement();
                });
            });
    },
    mps_show_line: function(e){
        var classes = $(e.target).data('value');
        if(!$(e.target).is(':checked')){
            $('.'+classes).hide();
        }
        else{
            $('.'+classes).show();
        }
    },
    re_renderElement: function() {
        this.$('.o_content').html(this.html);
    },
    option_mps_period: function(e){
        var self = this;
        this.period = $(e.target).data('value');
        return this._rpc({
                model: 'mrp.mps.report',
                method: 'search',
                args: [[]],
                kwargs: {context: session.user_context},
            })
            .then(function(res){
                return self._rpc({
                        model: 'mrp.mps.report',
                        method: 'write',
                        args: [res, {'period': self.period}],
                        kwargs: {context: session.user_context},
                    })
                    .done(function () {
                        self.get_html().then(function() {
                            self.update_cp();
                            self.re_renderElement();
                        });
                    });
        });
    },
    add_product_wizard: function () {
        var self = this;
        return this._rpc({
                model: 'ir.model.data',
                method: 'get_object_reference',
                args: ['mrp_mps', 'mrp_mps_report_view_form'],
                kwargs: {context: session.user_context},
            })
            .then(function(data){
                return self.do_action({
                    name: _t('Add a Product'),
                    type: 'ir.actions.act_window',
                    res_model: 'mrp.mps.report',
                    views: [[data[1] || false, 'form']],
                    target: 'new',
                });
            });
    },
    open_mps_product: function(e){
        this.do_action({
            type: 'ir.actions.act_window',
            res_model: "product.product",
            res_id: parseInt($(e.target).data('product')),
            views: [[false, 'form']],
        });
    },
    mps_open_forecast_wizard: function(e){
        var self = this;
        var product = $(e.target).data('product') || $(e.target).parent().data('product');
        return this._rpc({
                model: 'ir.model.data',
                method: 'get_object_reference',
                args: ['mrp_mps', 'product_product_view_form_mps'],
                kwargs: {context: session.user_context},
            })
            .then(function(data){
                return self.do_action({
                    name: _t('Forecast Product'),
                    type: 'ir.actions.act_window',
                    res_model: 'product.product',
                    views: [[data[1] || false, 'form']],
                    target: 'new',
                    res_id: product,
                });
            });
    },
    mps_forecast_save: function(e){
        var self = this;
        var $input = $(e.target);
        var target_value;
        try {
            target_value = field_utils.parse.integer($input.val().replace(String.fromCharCode(8209), '-'));
        } catch(err) {
            return this.do_warn(_t("Wrong value entered!"), err);
        }
        return this._rpc({
            model: 'sale.forecast',
            method: 'save_forecast_data',
            args: [parseInt($input.data('product')), target_value, $input.data('date'), $input.data('date_to'), $input.data('name')],
            kwargs: {context: session.user_context},
        })
        .done(function () {
            self.get_html().then(function() {
                self.re_renderElement();
            });
        });
    },
    mps_apply: function(e){
        var self = this;
        var product = parseInt($(e.target).data('product'));
        return this._rpc({
                model: 'mrp.mps.report',
                method: 'update_indirect',
                args: [product],
                kwargs: {context: session.user_context},
            })
            .then(function () {
                self.get_html().then(function() {
                    self.re_renderElement();
                });
        });
    },
    // Fetches the html and is previous report.context if any, else create it
    get_html: function() {
        var self = this;
        return this._rpc({
                model: 'mrp.mps.report',
                method: 'get_html',
                args: [this.domain],
                kwargs: {context: session.user_context},
            })
            .then(function (result) {
                self.html = result.html;
                self.report_context = result.report_context;
                self.renderButtons();
            });
    },
    // Updates the control panel and render the elements that have yet to be rendered
    update_cp: function() {
        var self = this;
        if (!this.$buttons) {
            this.renderButtons();
        }
        this.$searchview_buttons = $(QWeb.render("MPS.optionButton", {period: self.report_context.period}));
        this.$searchview_buttons.find('.o_mps_option_mps_period').bind('click', function (event) {
            self.option_mps_period(event);
        });
        this.$searchview_buttons.find('.o_mps_option_mps_columns').bind('click', function (event) {
            self.mps_show_line(event);
        });
        this.updateControlPanel({
            cp_content: {
                $buttons: this.$buttons,
                $searchview_buttons: this.$searchview_buttons
            },
        });
    },
    do_show: function() {
        this._super();
        this.update_cp();
    },
    renderButtons: function() {
        var self = this;
        this.$buttons = $(QWeb.render("MPS.buttons", {}));
        this.$buttons.on('click', function(){
            self._rpc({
                    model: 'sale.forecast',
                    method: 'generate_procurement_all',
                    args: [],
                    kwargs: {context: session.user_context},
                })
                .then(function () {
                    self.get_html().then(function() {
                        self.re_renderElement();
                    });
                });
        });
        return this.$buttons;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} event
     */
    _onSearch: function (event) {
        event.stopPropagation();
        this.domain = event.data.domain;
        this.get_html().then(this.re_renderElement.bind(this));
    },
});

core.action_registry.add("mrp_mps_report", mrp_mps_report);
return mrp_mps_report;
});
