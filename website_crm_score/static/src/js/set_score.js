odoo.define('website_crm_score.set_score', function (require) {
"use strict";

var ajax = require('web.ajax');
var seo = require('website.seo');
var base = require('web_editor.base');
var core = require('web.core');

var qweb = core.qweb;

ajax.loadXML('/website_crm_score/static/src/xml/track_page.xml', qweb);

seo.Configurator.include({
    track: null,
    start: function() {
        var def = this._super.apply(this, arguments);
        var self = this;
        var obj = seo.Configurator.prototype.getMainObject();
        // only display checkbox for website page
        if (obj && obj.model === 'ir.ui.view') {
            this.is_tracked().then(function(data){
                var add = $('<input type="checkbox" required="required"/>');
                if (data[0]['track']) {
                    add.attr('checked','checked');
                    self.track = true;
                }
                else {
                    self.track = false;
                }
                self.$('h3[class="track-page"]').append(add);
            });
        }
        return def;
    },
    is_tracked: function(val) {
        var obj = seo.Configurator.prototype.getMainObject();
        if (!obj) {
            return $.Deferred().reject();
        } else {
            return this.performModelRPC(obj.model, 'read', [[obj.id], ['track'], base.get_context()]);
        }
    },
    update: function () {
        var self = this;
        var mysuper = this._super;
        var checkbox_value = this.$('input[type="checkbox"]').is(':checked');
        if (checkbox_value != self.track) {
            this.trackPage(checkbox_value).then(function() {
                mysuper.call(self);
            });
        }
        else {
            mysuper.call(self);
        }
    },
    trackPage: function(val) {
        var obj = seo.Configurator.prototype.getMainObject();
        if (!obj) {
            return $.Deferred().reject();
        } else {
            return this.performModelRPC(obj.model, 'write', [[obj.id], { track: val }, base.get_context()]);
        }
    },
});

});
