# Part of Odoo. See LICENSE file for full copyright and licensing details.
# -*- coding: utf-8 -*-

import odoo.tests
from odoo import Command
from lxml import etree


@odoo.tests.tagged('post_install', '-at_install')
class TestUi(odoo.tests.HttpCase):

    def test_new_app_and_report(self):
        self.start_tour("/web", 'web_studio_new_app_tour', login="admin")

        # the report tour is based on the result of the former tour
        self.start_tour("/web?debug=tests", 'web_studio_new_report_tour', login="admin")
        self.start_tour("/web?debug=tests", "web_studio_new_report_basic_layout_tour", login="admin")

    def test_optional_fields(self):
        self.start_tour("/web?debug=tests", 'web_studio_hide_fields_tour', login="admin")

    def test_model_option_value(self):
        self.start_tour("/web?debug=tests", 'web_studio_model_option_value_tour', login="admin")

    def test_rename(self):
        self.start_tour("/web?debug=tests", 'web_studio_tests_tour', login="admin", timeout=200)

    def test_approval(self):
        self.start_tour("/web?debug=tests", 'web_studio_approval_tour', login="admin")

    def test_background(self):
        attachment = self.env['ir.attachment'].create({
            'datas': b'R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=',
            'name': 'testFilename.gif',
            'public': True,
            'mimetype': 'image/gif'
        })
        self.env.company.background_image = attachment.datas
        self.start_tour("/web?debug=tests", 'web_studio_custom_background_tour', login="admin")


def _get_studio_view(view):
    domain = [('inherit_id', '=', view.id), ('name', '=', "Odoo Studio: %s customization" % (view.name))]
    return view.search(domain, order='priority desc, name desc, id desc', limit=1)

def _transform_arch_for_assert(arch_string):
    parser = etree.XMLParser(remove_blank_text=True)
    arch_string = etree.fromstring(arch_string, parser=parser)
    return etree.tostring(arch_string, pretty_print=True, encoding='unicode')

def assertViewArchEqual(test, original, expected):
    if original:
        original = _transform_arch_for_assert(original)
    if expected:
        expected = _transform_arch_for_assert(expected)
    test.assertEqual(original, expected)


@odoo.tests.tagged('post_install', '-at_install')
class TestStudioUIUnit(odoo.tests.HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.testView = cls.env["ir.ui.view"].create({
            "name": "simple partner",
            "model": "res.partner",
            "type": "form",
            "arch": '''
                <form>
                    <field name="name" />
                </form>
            '''
        })
        cls.testAction = cls.env["ir.actions.act_window"].create({
            "name": "simple partner",
            "res_model": "res.partner",
            "view_ids": [Command.create({"view_id": cls.testView.id, "view_mode": "form"})]
        })
        cls.testActionXmlId = cls.env["ir.model.data"].create({
            "name": "studio_test_partner_action",
            "model": "ir.actions.act_window",
            "module": "web_studio",
            "res_id": cls.testAction.id,
        })
        cls.testMenu = cls.env["ir.ui.menu"].create({
            "name": "Studio Test Partner",
            "action": "ir.actions.act_window,%s" % cls.testAction.id
        })
        cls.testMenuXmlId = cls.env["ir.model.data"].create({
            "name": "studio_test_partner_menu",
            "model": "ir.ui.menu",
            "module": "web_studio",
            "res_id": cls.testMenu.id,
        })

    def test_form_view_not_altered_by_studio_xml_edition(self):
        self.start_tour("/web?debug=tests", 'web_studio_test_form_view_not_altered_by_studio_xml_edition', login="admin", timeout=200)

    def test_edit_with_xml_editor(self):
        studioView = self.env["ir.ui.view"].create({
            'type': self.testView.type,
            'model': self.testView.model,
            'inherit_id': self.testView.id,
            'mode': 'extension',
            'priority': 99,
            'arch': "<data><xpath expr=\"//field[@name='name']\" position=\"after\"> <div class=\"someDiv\"/></xpath></data>",
            'name': "Odoo Studio: %s customization" % (self.testView.name)
        })

        self.start_tour("/web?debug=tests", 'web_studio_test_edit_with_xml_editor', login="admin", timeout=200)
        self.assertEqual(studioView.arch, "<data/>")

    def test_enter_x2many_edition_and_add_field(self):
        doesNotHaveGroup = self.env["res.groups"].create({
            "name": "studio does not have"
        })
        doesNotHaveGroupXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_doesnothavegroup",
            "model": "res.groups",
            "module": "web_studio",
            "res_id": doesNotHaveGroup.id,
        })

        userView = self.env["ir.ui.view"].create({
            "name": "simple user",
            "model": "res.users",
            "type": "form",
            "arch": '''
                <form>
                    <t groups="{doesnothavegroup}" >
                        <div class="condition_group" />
                    </t>
                    <group>
                        <field name="name" />
                    </group>
                </form>
            '''.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name)
        })

        userViewXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_user_view",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": userView.id,
        })

        self.testView.arch = '''<form><field name="user_ids" context="{'form_view_ref': '%s'}" /></form>''' % userViewXmlId.complete_name
        studioView = _get_studio_view(self.testView)
        self.assertFalse(studioView.exists())

        self.start_tour("/web?debug=tests", 'web_studio_enter_x2many_edition_and_add_field', login="admin", timeout=200)
        studioView = _get_studio_view(self.testView)

        assertViewArchEqual(self, studioView.arch, """
            <data>
               <xpath expr="//field[@name='user_ids']" position="inside">
                 <form>
                   <t groups="{doesnothavegroup}" >
                     <div class="condition_group" />
                   </t>
                   <group>
                     <field name="name"/>
                     <field name="log_ids"/>
                   </group>
                 </form>
               </xpath>
             </data>
            """.format(doesnothavegroup=doesNotHaveGroupXmlId.complete_name))

    def test_enter_x2many_auto_inlined_subview(self):
        userView = self.env["ir.ui.view"].create({
            "name": "simple user",
            "model": "res.users",
            "type": "tree",
            "arch": '''
                <tree>
                    <field name="display_name" />
                </tree>
            '''
        })

        userViewXmlId = self.env["ir.model.data"].create({
            "name": "studio_test_user_view",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": userView.id,
        })

        self.testView.arch = '''<form><field name="user_ids" context="{'tree_view_ref': '%s'}" /></form>''' % userViewXmlId.complete_name
        studioView = _get_studio_view(self.testView)
        self.assertFalse(studioView.exists())

        self.start_tour("/web?debug=tests", 'web_studio_enter_x2many_auto_inlined_subview', login="admin", timeout=200)
        studioView = _get_studio_view(self.testView)

        assertViewArchEqual(self, studioView.arch, """
            <data>
               <xpath expr="//field[@name='user_ids']" position="inside">
                 <tree>
                   <field name="display_name" />
                   <field name="log_ids" optional="show" />
                 </tree>
               </xpath>
             </data>
            """)
