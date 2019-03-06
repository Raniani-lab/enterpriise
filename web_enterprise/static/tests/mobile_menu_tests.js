odoo.define('web_enterprise.mobile_menu_tests', function (require) {
"use strict";

var Menu = require('web_enterprise.Menu');
var testUtils = require('web.test_utils');
var SystrayMenu = require('web.SystrayMenu');
var UserMenu = require('web.UserMenu');

/**
 * create a menu from given parameters.
 *
 * @param {Object} params This object will be given to addMockEnvironment, so
 *   any parameters from that method applies
 * @param {Object} params.menuData This object will define the menu's data
 *   structure to render
 * @param {Widget[]} [params.systrayMenuItems=[]] This array will define the systray
 *  items to use. Will at least contain and default to UserMenu
 * @returns {Menu}
 */
async function createMenu(params) {
    var parent = testUtils.createParent({});

    var systrayMenuItems = params.systrayMenuItems || [];
    if (params.systrayMenuItems) {
        delete params.systrayMenuItems;
    }

    var initialSystrayMenuItems = _.clone(SystrayMenu.Items);
    SystrayMenu.Items = _.union([UserMenu], systrayMenuItems);

    var menuData = params.menuData || {};
    if (params.menuData) {
        delete params.menuData;
    }

    var menu = new Menu(parent, menuData);
    testUtils.mock.addMockEnvironment(menu, params);
    return menu.appendTo($('#qunit-fixture')).then(function(){
        var menuDestroy = menu.destroy;
        menu.destroy = function () {
            SystrayMenu.Items = initialSystrayMenuItems;
            menuDestroy.call(this);
            parent.destroy();
        };

        return menu;
    });
}

QUnit.module('web_enterprise mobile_menu_tests', {
    beforeEach: function () {
        this.data = {
            all_menu_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            name: "root",
            children: [{
                id: 1,
                name: "Discuss",
                children: [],
             }, {
                 id: 2,
                 name: "Calendar",
                 children: []
             }, {
                id: 3,
                name: "Contacts",
                children: [{
                    id: 4,
                    name: "Contacts",
                    children: [],
                }, {
                    id: 5,
                    name: "Configuration",
                    children: [{
                        id: 6,
                        name: "Contact Tags",
                        children: [],
                    }, {
                        id: 7,
                        name: "Contact Titles",
                        children: [],
                    }, {
                        id: 8,
                        name: "Localization",
                        children: [{
                            id: 9,
                            name: "Countries",
                            children: [],
                        }, {
                            id: 10,
                            name: "Fed. States",
                            children: [],
                        }],
                    }],
                 }],
           }],
        };
    }
}, function () {

    QUnit.module('Burger Menu');

    QUnit.test('Burger Menu on home menu', async function (assert) {
        assert.expect(1);

        var mobileMenu = await createMenu({ menuData: this.data });

        testUtils.dom.click(mobileMenu.$('.o_mobile_menu_toggle'));
        assert.isVisible($(".o_burger_menu"),
            "Burger menu should be opened on button click");
        testUtils.dom.click($('.o_burger_menu_close'));

        mobileMenu.destroy();
    });

    QUnit.test('Burger Menu on an App', async function (assert) {
        assert.expect(4);

        var mobileMenu = await createMenu({ menuData: this.data });

        mobileMenu.change_menu_section(3);
        mobileMenu.toggle_mode(false);

        testUtils.dom.click(mobileMenu.$('.o_mobile_menu_toggle'));
        assert.isVisible($(".o_burger_menu"),
            "Burger menu should be opened on button click");
        assert.strictEqual($('.o_burger_menu .o_burger_menu_app .o_menu_sections > *').length, 2,
            "Burger menu should contains top levels menu entries");
        testUtils.dom.click($('.o_burger_menu_topbar'));
        assert.doesNotHaveClass($(".o_burger_menu_content"), 'o_burger_menu_dark',
            "Toggle to usermenu on header click");
        testUtils.dom.click($('.o_burger_menu_topbar'));
        assert.hasClass($(".o_burger_menu_content"),'o_burger_menu_dark',
            "Toggle back to main sales menu on header click");

        mobileMenu.destroy();
    });
});
});
