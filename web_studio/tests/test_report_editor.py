import json

from odoo.addons.web_studio.controllers.main import WebStudioController
from odoo.addons.web_studio.controllers.report import WebStudioReportController
from odoo.addons.web.controllers.report import ReportController
from odoo.http import _request_stack, route
from odoo.tests.common import HttpCase, TransactionCase
from odoo.tests import tagged
from odoo.tools import DotDict, mute_logger

class TestReportEditor(TransactionCase):

    def setUp(self):
        super(TestReportEditor, self).setUp()
        self.session = DotDict({'debug': ''})
        self.is_frontend = False
        _request_stack.push(self)  # crappy hack to use a fake Request
        self.WebStudioController = WebStudioController()

    def test_copy_inherit_report(self):
        report = self.env['ir.actions.report'].create({
            'name': 'test inherit report user',
            'report_name': 'web_studio.test_inherit_report_user',
            'model': 'res.users',
        })
        self.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'web_studio.test_inherit_report_hi',
            'key': 'web_studio.test_inherit_report_hi',
            'arch': '''
                <t t-name="web_studio.test_inherit_report_hi">
                    hi
                </t>
            ''',
        })
        parent_view = self.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'web_studio.test_inherit_report_user_parent',
            'key': 'web_studio.test_inherit_report_user_parent',
            'arch': '''
                <t t-name="web_studio.test_inherit_report_user_parent_view_parent">
                    <t t-call="web_studio.test_inherit_report_hi"/>!
                </t>
            ''',
        })
        self.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'web_studio.test_inherit_report_user',
            'key': 'web_studio.test_inherit_report_user',
            'arch': '''
                <xpath expr="." position="inside">
                    <t t-call="web_studio.test_inherit_report_hi"/>!!
                </xpath>
            ''',
            'inherit_id': parent_view.id,

        })

        # check original report render to expected output
        report_html = report._render_template(report.report_name).decode()
        self.assertEqual(''.join(report_html.split()), 'hi!hi!!')

        # duplicate original report
        report.copy_report_and_template()
        copy_report = self.env['ir.actions.report'].search([
            ('report_name', '=', 'web_studio.test_inherit_report_user_copy_1'),
        ])

        # check duplicated report render to expected output
        copy_report_html = copy_report._render_template(copy_report.report_name).decode()
        self.assertEqual(''.join(copy_report_html.split()), 'hi!hi!!')

        # check that duplicated view is inheritance combination of original view
        copy_view = self.env['ir.ui.view'].search([
            ('key', '=', copy_report.report_name),
        ])
        self.assertFalse(copy_view.inherit_id, 'copied view does not inherit another one')
        found = len(copy_view.arch_db.split('test_inherit_report_hi_copy_1')) - 1
        self.assertEqual(found, 2, 't-call is duplicated one time and used 2 times')


    def test_duplicate(self):
        # Inheritance during an upgrade work only with loaded views
        # The following force the inheritance to work for all views
        # so the created view is correctly inherited
        self.env = self.env(context={'load_all_views': True})


        # Create a report/view containing "foo"
        report = self.env['ir.actions.report'].create({
            'name': 'test duplicate',
            'report_name': 'web_studio.test_duplicate_foo',
            'model': 'res.users',})

        self.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'test_duplicate_foo',
            'key': 'web_studio.test_duplicate_foo',
            'arch': "<t t-name='web_studio.test_duplicate_foo'>foo</t>",})

        duplicate_domain = [('report_name', '=like', 'web_studio.test_duplicate_foo_copy_%')]

        # Duplicate the report and retrieve the duplicated view
        report.copy_report_and_template()
        copy1 = self.env['ir.actions.report'].search(duplicate_domain)
        copy1.ensure_one()  # watchdog
        copy1_view = self.env['ir.ui.view'].search([
            ('key', '=', copy1.report_name)])
        copy1_view.ensure_one()  # watchdog

        # Inherit the view to replace "foo" by "bar"
        self.env['ir.ui.view'].create({
            'inherit_id': copy1_view.id,
            'key': copy1.report_name,
            'arch': '''
                <xpath expr="." position="replace">
                    <t t-name='%s'>bar</t>
                </xpath>
            ''' % copy1.report_name,})

        # Assert the duplicated view renders "bar" then unlink the report
        copy1_html = copy1._render_template(copy1.report_name).decode()
        self.assertEqual(''.join(copy1_html.split()), 'bar')
        copy1.unlink()

        # Re-duplicate the original report, it must renders "foo"
        report.copy_report_and_template()
        copy2 = self.env['ir.actions.report'].search(duplicate_domain)
        copy2.ensure_one()
        copy2_html = copy2._render_template(copy2.report_name).decode()
        self.assertEqual(''.join(copy2_html.split()), 'foo')

    def test_copy_custom_model_rendering(self):
        report = self.env['ir.actions.report'].search([('report_name', '=', 'base.report_irmodulereference')])
        report.copy_report_and_template()
        copy = self.env['ir.actions.report'].search([('report_name', '=', 'base.report_irmodulereference_copy_1')])
        report_model = self.env['ir.actions.report']._get_rendering_context_model(copy)
        self.assertIsNotNone(report_model)

    def test_duplicate_keep_translations(self):
        def create_view(name, **kwargs):
            arch = '<div>{}</div>'.format(name)
            if kwargs.get('inherit_id'):
                arch = '<xpath expr="." path="inside">{}</xpath>'.format(arch)
            name = 'web_studio.test_keep_translations_{}'.format(name)
            return self.env['ir.ui.view'].create(dict({
                'type': 'qweb',
                'name': name,
                'key': name,
                'arch': arch,
            }, **kwargs))

        report = self.env['ir.actions.report'].create({
            'name': 'test inherit report user',
            'report_name': 'web_studio.test_keep_translations_ab',
            'model': 'res.users',
        }).with_context(load_all_views=True)

        self.env.ref('base.lang_fr').active = True
        views = report.env['ir.ui.view']
        views += create_view("a_")
        root = views[-1]
        views += create_view("b_")
        views += create_view("aa", inherit_id=root.id, mode="primary")
        views += create_view("ab", inherit_id=root.id)
        target = views[-1]
        views += create_view("aba", inherit_id=target.id)
        views[-1].arch = views[-1].arch.replace('aba', 'a_</div>aba<div>ab')
        views += create_view("abb", inherit_id=target.id, mode="primary")

        for view in views.with_context(lang='fr_FR'):
            terms = view._fields['arch_db'].get_trans_terms(view.arch_db)
            view.update_field_translations('arch_db', {'fr_FR': {term: '%s in fr' % term for term in terms}})

        combined_arch = '<div>a_<div>ab</div><div>a_</div>aba<div>ab</div></div>'
        self.assertEqual(target._read_template(target.id), combined_arch)

        # duplicate original report, views will be combined into one
        report.copy_report_and_template()
        copy_view = self.env['ir.ui.view'].search([
            ('key', '=', 'web_studio.test_keep_translations_ab_copy_1'),
        ])
        self.assertEqual(copy_view.arch, combined_arch)

        # translations of combined views have been copied to the new view
        new_arch = '<div>a_ in fr<div>ab in fr</div><div>a_ in fr</div>aba in fr<div>ab in fr</div></div>'
        self.assertEqual(copy_view.with_context(lang='fr_FR').arch, new_arch)

    def tearDown(self):
        super(TestReportEditor, self).tearDown()
        _request_stack.pop()


@tagged('post_install', '-at_install')
class TestReportEditorUIUnit(HttpCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.testAction = cls.env["ir.actions.act_window"].create({
            "name": "simple partner",
            "res_model": "res.partner",
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


        cls.report = cls.env['ir.actions.report'].create({
            'name': 'test report',
            'report_name': 'web_studio.test_report',
            'model': 'res.partner',
        })
        cls.report_xml_id = cls.env["ir.model.data"].create({
            "name": "studio_test_report",
            "model": "ir.actions.report",
            "module": "web_studio",
            "res_id": cls.report.id,
        })

        cls.main_view = cls.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'web_studio.test_report',
            'key': 'web_studio.test_report',
            'arch': '''
                <t t-name="web_studio.test_report">
                    <t t-call="web.html_container">
                        <div><p><br/></p></div>
                        <t t-foreach="docs" t-as="doc">
                            <t t-call="web_studio.test_report_document" />
                        </t>
                    </t>
                </t>
            ''',
        })
        cls.main_view_xml_id = cls.env["ir.model.data"].create({
            "name": "studio_test_report_view",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": cls.main_view.id,
        })

        cls.main_view_document = cls.env['ir.ui.view'].create({
            'type': 'qweb',
            'name': 'web_studio.test_report_document',
            'key': 'web_studio.test_report_document',
            'arch': '''
                <t t-name="web_studio.test_report_document">
                    <div><p t-field="doc.name" /></div>
                    <p><br/></p>
                </t>
            ''',
        })
        cls.main_view_document_xml_id = cls.env["ir.model.data"].create({
            "name": "test_report_document",
            "model": "ir.ui.view",
            "module": "web_studio",
            "res_id": cls.main_view_document.id,
        })

    @property
    def tour_url(self):
        return f"/web#action=studio&mode=editor&_action={self.testAction.id}&_tab=reports&_report_id={self.report.id}&menu_id={self.testMenu.id}"

    def _clear_routing(self):
        self.env.registry.clear_cache('routing')

    def test_basic_report_edition(self):
        self.start_tour(self.tour_url, "web_studio.test_basic_report_edition", login="admin")
        self.assertEqual(self.report.name, "modified in test")
        self.assertTrue(self.main_view_xml_id.noupdate)
        self.assertTrue(self.main_view_document_xml_id.noupdate)
        self.assertTrue(self.report_xml_id.noupdate)

        self.assertXMLEqual(self.main_view.arch, """
            <t t-name="web_studio.test_report">
               <t t-call="web.html_container">
                 <div class="">
                   <p>edited with odoo editor</p>
                 </div>
                 <t t-foreach="docs" t-as="doc">
                   <t t-call="web_studio.test_report_document"/>
                 </t>
               </t>
             </t>
        """)

         # Not sure about this one. Due to the absence of relevant branding
         # The entire view is replaced (case "entire_view" in report.py)
        self.assertXMLEqual(self.main_view_document.arch, """
            <t t-name="web_studio.test_report_document" class="">
               <div>
                 <p t-field="doc.name"/>
               </div>
               <p>edited with odoo editor 2</p>
             </t>
        """)

    def test_basic_report_edition_xml(self):
        self.start_tour(self.tour_url, "web_studio.test_basic_report_edition_xml", login="admin")
        self.assertTrue(self.main_view_xml_id.noupdate)
        self.assertTrue(self.main_view_document_xml_id.noupdate)
        self.assertTrue(self.report_xml_id.noupdate)

        self.assertXMLEqual(self.main_view.arch, """
            <t t-name="web_studio.test_report">
              <t t-call="web.html_container">
                <span class="test-added-1">in main view</span>
                <div>
                  <p>
                    <br/>
                  </p>
                </div>
                <t t-foreach="docs" t-as="doc">
                  <t t-call="web_studio.test_report_document"/>
                </t>
              </t>
            </t>
        """)

        self.assertXMLEqual(self.main_view_document.arch, """
            <t t-name="web_studio.test_report_document">
                <div>
                  <p t-field="doc.name"/>
                </div>
                <span class="test-added-0">in document view</span>
                <p>
                    <br/>
                </p>
             </t>
        """)

    def test_basic_report_edition_rollback(self):
        save_report = WebStudioReportController.save_report
        self._clear_routing()
        self.addCleanup(self._clear_routing)

        error = None
        @route('/web_studio/save_report', type='json', auth='user')
        def save_report_mocked(*args, **kwargs):
            try:
                return save_report(*args, **kwargs)
            except Exception as e:
                nonlocal error
                error = e
                raise e

        self.patch(WebStudioReportController, "save_report", save_report_mocked)

        main_view_arch = self.main_view.arch
        document_view_arch = self.main_view_document.arch

        with mute_logger("odoo.http"):
            self.start_tour(self.tour_url, "web_studio.test_basic_report_edition_rollback", login="admin")

        self.assertTrue(error)
        self.assertFalse(self.main_view_xml_id.noupdate)
        self.assertFalse(self.main_view_document_xml_id.noupdate)
        self.assertFalse(self.report_xml_id.noupdate)

        self.assertXMLEqual(self.main_view.arch, main_view_arch)
        self.assertXMLEqual(self.main_view_document.arch, document_view_arch)

    def test_basic_report_edition_xml_rollback(self):
        save_report = WebStudioReportController.save_report
        self._clear_routing()
        self.addCleanup(self._clear_routing)

        error = None
        @route('/web_studio/save_report', type='json', auth='user')
        def save_report_mocked(*args, **kwargs):
            try:
                return save_report(*args, **kwargs)
            except Exception as e:
                nonlocal error
                error = e
                raise e

        self.patch(WebStudioReportController, "save_report", save_report_mocked)

        main_view_arch = self.main_view.arch
        document_view_arch = self.main_view_document.arch

        with mute_logger("odoo.http"):
            self.start_tour(self.tour_url, "web_studio.test_basic_report_edition_xml_rollback", login="admin")

        self.assertTrue(error)
        self.assertFalse(self.main_view_xml_id.noupdate)
        self.assertFalse(self.main_view_document_xml_id.noupdate)
        self.assertFalse(self.report_xml_id.noupdate)

        self.assertXMLEqual(self.main_view.arch, main_view_arch)
        self.assertXMLEqual(self.main_view_document.arch, document_view_arch)

    def test_report_reset_archs(self):
        self.main_view_document.arch_fs = "web_studio/tests/test_report_editor.xml"
        self.start_tour(self.tour_url, "web_studio.test_report_reset_archs", login="admin")
        self.assertXMLEqual(self.main_view_document.arch, """<p>from file</p>""")

    def test_print_preview(self):
        self._clear_routing()
        self.addCleanup(self._clear_routing)

        report_download_context = None
        @route(['/report/download'], type='http', auth="user")
        def report_download(self, data, context=None, token=None):
            nonlocal report_download_context
            report_download_context = json.loads(context)
            return None

        self.patch(ReportController, "report_download", report_download)
        self.start_tour(self.tour_url, "web_studio.test_print_preview", login="admin")
        self.assertTrue(report_download_context["report_pdf_no_attachment"])
        self.assertTrue(report_download_context["discard_logo_check"])
        self.assertTrue(report_download_context["active_ids"])

    def test_table_rendering(self):
        self.main_view_document.arch = """
            <t t-name="web_studio.test_report_document">
                <p><br/></p>
                <table class="valid_table">
                    <tr><td>I am valid</td></tr>
                </table>

                <table class="invalid_table">
                    <t t-foreach="doc.child_ids" t-as="child">
                        <tr><td>I am not valid</td></tr>
                    </t>
                </table>
            </t>
        """

        self.start_tour(self.tour_url, "web_studio.test_table_rendering", login="admin")
        self.assertXMLEqual(self.main_view_document.arch, """
            <t t-name="web_studio.test_report_document" class="">
               <p>p edited with odooEditor</p>
               <table class="valid_table">
                 <tbody>
                   <tr>
                     <td>I am valid</td>
                   </tr>
                 </tbody>
               </table>
               <table class="invalid_table">
                 <t t-foreach="doc.child_ids" t-as="child">
                   <tr>
                     <td>edited with odooEditor</td>
                   </tr>
                 </t>
               </table>
             </t>
        """)

    def test_field_placeholder(self):
        self.start_tour(self.tour_url, "web_studio.test_field_placeholder", login="admin")
        self.assertXMLEqual(self.main_view.arch, """
            <t t-name="web_studio.test_report">
               <t t-call="web.html_container">
                 <div class="">
                   <p><br/>edited with odooEditor</p>
                 </div>
                 <t t-foreach="docs" t-as="doc">
                   <t t-call="web_studio.test_report_document"/>
                 </t>
               </t>
             </t>
        """)
        self.assertXMLEqual(self.main_view_document.arch, """
            <t t-name="web_studio.test_report_document" class="">
               <div>
                 <p t-field="doc.name"/>
               </div>
               <p>
                 <span t-field="doc.function">some default value</span>
                 <br/>
               </p>
             </t>
        """)

    def test_edition_without_lang(self):
        self.env["res.lang"]._activate_lang("fr_FR")
        self.env["res.users"].browse(2).lang = "fr_FR"
        self.main_view_document.arch = """
            <t t-name="web_studio.test_report_document">
                <p>original term</p>
            </t>
        """

        translations = {
            "fr_FR": {
                "original term": "translated term"
            }
        }
        self.main_view_document.update_field_translations("arch_db", translations)
        self.start_tour(self.tour_url, "web_studio.test_edition_without_lang", login="admin")
        self.assertXMLEqual(self.main_view_document.arch, """
            <t t-name="web_studio.test_report_document" class="">
              <p>original term edited</p>
            </t>
        """)

        new_translations = self.main_view_document.get_field_translations("arch_db")
        new_translations_values = {k["lang"]: k for k in new_translations[0]}
        self.assertEqual(
            new_translations_values["en_US"]["source"],
            "original term edited"
        )
        self.assertEqual(
            new_translations_values["en_US"]["value"],
            ""
        )
        self.assertEqual(
            new_translations_values["fr_FR"]["source"],
            "original term edited"
        )
        self.assertEqual(
            new_translations_values["fr_FR"]["value"],
            "translated edited term"
        )

    def test_report_xml_other_record(self):
        ResPartner = self.env["res.partner"]
        p1 = ResPartner.create({'name': "partner_1"})
        p2 = ResPartner.create({'name': "partner_2"})

        def mock_search(*args, **kwargs):
            return (p1 | p2).ids
        self.patch(type(ResPartner), "search", mock_search)

        self.start_tour(self.tour_url, "web_studio.test_report_xml_other_record", login="admin")

    def test_partial_eval(self):
        self.main_view_document.arch = """
            <t t-name="web_studio.test_report_document">
                <t t-set="my_children" t-value="doc.child_ids" />
                <t t-set="some_var" t-value="'some_value'" />
                <t t-foreach="my_children" t-as="child">
                    <div t-att-class="'lol' if report_type != 'html' else 'notlol'">lol</div>
                    <div t-attf-class="{{ 'couic' }}" >couic</div>
                </t>
            </t>
        """
        self.start_tour(self.tour_url, "web_studio.test_partial_eval", login="admin")
